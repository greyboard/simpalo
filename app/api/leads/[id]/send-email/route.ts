import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailViaMailgun, getMailgunConfig } from "@/lib/mailgun";

export const dynamic = "force-dynamic";

// Zod Schema für E-Mail-Versand
const sendEmailSchema = z.object({
  subject: z
    .string()
    .min(1, "Betreff ist erforderlich")
    .max(200, "Betreff ist zu lang (max. 200 Zeichen)")
    .trim(),
  content: z
    .string()
    .min(1, "E-Mail-Inhalt ist erforderlich")
    .max(50000, "E-Mail-Inhalt ist zu lang (max. 50000 Zeichen)")
    .trim(),
  cc: z
    .string()
    .email("Ungültige CC E-Mail-Adresse")
    .max(255)
    .optional()
    .or(z.literal("")),
  bcc: z
    .string()
    .email("Ungültige BCC E-Mail-Adresse")
    .max(255)
    .optional()
    .or(z.literal("")),
});

/**
 * POST /api/leads/[id]/send-email
 * Sendet eine manuelle E-Mail an einen Lead
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId || !session?.user?.email) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;
    const userEmail = session.user.email;
    
    // Parse FormData (for attachments)
    const formData = await request.formData();
    
    // Extract attachments (vor Validierung, da nicht Teil des Schemas)
    const attachments: Array<{ filename: string; data: Buffer }> = [];
    let attachmentIndex = 0;
    while (formData.has(`attachment_${attachmentIndex}`)) {
      const file = formData.get(`attachment_${attachmentIndex}`) as File;
      if (file && file.size > 0 && file.size <= 10 * 1024 * 1024) { // Max 10MB pro Datei
        const buffer = Buffer.from(await file.arrayBuffer());
        attachments.push({
          filename: file.name.substring(0, 255), // Max Dateinamen-Länge
          data: buffer,
        });
      }
      attachmentIndex++;
      if (attachmentIndex > 10) break; // Max 10 Anhänge
    }

    // Strikte Validierung - NUR validierte Daten verwenden
    const emailData = {
      subject: formData.get("subject") as string,
      content: formData.get("content") as string,
      cc: (formData.get("cc") as string) || "",
      bcc: (formData.get("bcc") as string) || "",
    };

    const validatedData = sendEmailSchema.parse(emailData);

    // Lade Lead
    const lead = await prisma.lead.findFirst({
      where: {
        id: params.id,
        accountId: accountId,
      },
      include: {
        account: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead nicht gefunden" },
        { status: 404 }
      );
    }

    if (!lead.email) {
      return NextResponse.json(
        { error: "Lead hat keine E-Mail-Adresse" },
        { status: 400 }
      );
    }

    // Lade Account-Einstellungen
    const accountSettings = lead.account.settings;
    const settings = (accountSettings?.settings as any) || {};
    const emailSettings = settings.emailSettings || {};

    // Hole Mailgun-Config
    // getMailgunConfig verwendet: Environment Variables haben Priorität, dann Account Settings
    const mailgunConfig = getMailgunConfig(
      settings.mailgunApiKey || undefined,
      settings.mailgunDomain || undefined,
      settings.mailgunRegion || undefined
    );

    if (!mailgunConfig) {
      return NextResponse.json(
        { error: "Mailgun ist nicht konfiguriert" },
        { status: 500 }
      );
    }

    // Verwende IMMER eine E-Mail-Adresse von der verifizierten Mailgun-Domain als Absender
    // Das verhindert Spoofing-Warnungen und Spam (SPF/DKIM/DMARC müssen übereinstimmen)
    // Priorität: Wenn Account-spezifische Domain verwendet wird, Account-Absenderadresse hat Vorrang
    //            Wenn globale Domain verwendet wird, globale Absenderadresse hat Vorrang
    const mailgunDomain = mailgunConfig.domain;
    const isUsingAccountDomain = settings.mailgunDomain && !process.env.MAILGUN_DOMAIN;
    
    // Bestimme Absenderadresse basierend auf verwendeter Domain
    let fromEmail: string;
    if (isUsingAccountDomain) {
      // Account verwendet eigene Mailgun-Domain → Account-Absenderadresse hat Vorrang
      fromEmail = emailSettings.senderEmail || process.env.MAILGUN_FROM_EMAIL || "";
    } else {
      // Globale Mailgun-Domain wird verwendet → Globale Absenderadresse hat Vorrang
      fromEmail = process.env.MAILGUN_FROM_EMAIL || emailSettings.senderEmail || "";
    }
    
    // Falls keine Absenderadresse konfiguriert, verwende info@ statt noreply@ (bessere Deliverability)
    if (!fromEmail) {
      fromEmail = `info@${mailgunDomain}`;
      console.log("[SEND-EMAIL] Keine Absenderadresse konfiguriert, verwende info@:", fromEmail);
    } else {
      // Prüfe, ob die konfigurierte Absenderadresse zur verwendeten Mailgun-Domain passt
      const fromDomain = fromEmail.split("@")[1];
      
      // Wenn die Absenderadresse nicht von der verifizierten Mailgun-Domain ist, verwende info@
      if (fromDomain !== mailgunDomain) {
        console.log("[SEND-EMAIL] Absenderadresse passt nicht zur Mailgun-Domain, verwende info@:", {
          configured: fromEmail,
          mailgunDomain: mailgunDomain,
          using: `info@${mailgunDomain}`,
        });
        fromEmail = `info@${mailgunDomain}`;
      }
    }

    // Verwende den Namen des Benutzers als fromName (Priorität: Benutzername > Account-Name > Konfigurierter Absendername)
    const userName = session.user.name || undefined;
    const accountName = lead.account.name;
    let fromName: string | undefined;
    if (userName) {
      fromName = userName;
    } else {
      fromName = accountName || emailSettings.senderName || undefined;
    }

    // Sende E-Mail via Mailgun
    // ReplyTo bleibt auf User-E-Mail, damit Antworten direkt an den User gehen
    // NUR validierte Daten verwenden
    const result = await sendEmailViaMailgun(mailgunConfig, {
      to: lead.email,
      from: fromEmail, // Immer verifizierte Mailgun-Domain
      fromName: fromName, // User-Name für Klarheit
      subject: validatedData.subject,
      html: validatedData.content.replace(/\n/g, "<br>"),
      text: validatedData.content,
      delayMinutes: 0,
      replyTo: userEmail, // Antworten gehen direkt an den User
      cc: validatedData.cc || undefined,
      bcc: validatedData.bcc || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      metadata: {
        leadId: lead.id,
        accountId: accountId,
        type: "manual",
        originalFromEmail: userEmail, // Speichere ursprüngliche User-E-Mail in Metadata
      },
    });

    // Erstelle Communication-Eintrag - NUR validierte Daten verwenden
    const communication = await prisma.communication.create({
      data: {
        leadId: lead.id,
        type: "EMAIL",
        direction: "OUTBOUND",
        subject: validatedData.subject,
        content: validatedData.content,
        status: "sent",
        mailgunId: result.id,
        metadata: {
          type: "manual",
          sentAt: new Date().toISOString(),
        },
      },
    });

    // Aktualisiere Lead-Status auf CONTACTED, wenn er noch NEW ist
    // Dies ist wichtig für die Kontaktquote-Berechnung im Dashboard
    if (lead.status === "NEW") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "CONTACTED" },
      });

      // Markiere alle "Lead kontaktieren" Tasks als COMPLETED
      try {
        const { completeContactTasksForLead } = await import("@/lib/actions/tasks");
        await completeContactTasksForLead(lead.id);
      } catch (taskError) {
        // Fehler beim Abschließen der Task sollte E-Mail-Versand nicht blockieren
        console.error("Error completing contact tasks:", taskError);
      }
    }

    return NextResponse.json({
      success: true,
      communicationId: communication.id,
      mailgunId: result.id,
      message: result.message,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Sichere Fehlerbehandlung - keine Systemdetails preisgeben
      const firstError = error.errors[0];
      return NextResponse.json(
        { error: firstError?.message || "Ungültige Eingaben" },
        { status: 400 }
      );
    }

    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Fehler beim Senden der E-Mail" },
      { status: 500 }
    );
  }
}
