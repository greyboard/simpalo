import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailViaMailgun, replaceTemplateVariables, getMailgunConfig } from "@/lib/mailgun";
import { logSecurityEvent } from "@/lib/security-events";
import { z } from "zod";
import crypto from "crypto";
import { getSuperadminEmail } from "@/lib/superadmin";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

const processRegistrationSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  userName: z.string(),
  userEmail: z.string().email(),
  userPhone: z.string().nullable().optional(),
  utmSource: z.string().nullable().optional(),
  utmMedium: z.string().nullable().optional(),
  utmCampaign: z.string().nullable().optional(),
  utmTerm: z.string().nullable().optional(),
  utmContent: z.string().nullable().optional(),
});

/**
 * Generiert einen signierten Aktivierungs-Token
 * Format: accountId:timestamp:signature
 */
function generateActivationToken(accountId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET ist nicht gesetzt");
  }

  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${accountId}:${timestamp}`)
    .digest("hex");

  return `${accountId}:${timestamp}:${signature}`;
}

/**
 * POST /api/admin/accounts/[id]/process-registration
 * Wird von der Landingpage aufgerufen, um Lead zu erstellen und E-Mail zu senden
 * Keine Authentifizierung erforderlich (wird von Landingpage intern aufgerufen)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("[PROCESS-REGISTRATION] Route aufgerufen mit params:", params);
  
  try {
    const body = await request.json();
    console.log("[PROCESS-REGISTRATION] Request body:", {
      accountId: body.accountId,
      accountName: body.accountName,
      userName: body.userName,
      userEmail: body.userEmail,
    });
    
    const validatedData = processRegistrationSchema.parse(body);
    console.log("[PROCESS-REGISTRATION] Validierte Daten:", validatedData);

    // Finde Account - mit Retry, falls Account noch nicht in DB verfügbar ist
    let account = await prisma.account.findUnique({
      where: { id: validatedData.accountId },
      include: {
        users: {
          where: { role: "OWNER" },
          take: 1,
        },
      },
    });

    // Retry-Mechanismus: Falls Account noch nicht verfügbar ist, warte kurz und versuche es erneut
    if (!account) {
      console.log("[PROCESS-REGISTRATION] Account nicht gefunden, warte 500ms und versuche erneut...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      account = await prisma.account.findUnique({
        where: { id: validatedData.accountId },
        include: {
          users: {
            where: { role: "OWNER" },
            take: 1,
          },
        },
      });
    }

    if (!account) {
      console.error("[PROCESS-REGISTRATION] Account nach Retry immer noch nicht gefunden:", validatedData.accountId);
      return NextResponse.json(
        { error: "Account nicht gefunden" },
        { status: 404 }
      );
    }

    // Finde Superadmin Account
    const superadminEmail = getSuperadminEmail();
    if (!superadminEmail) {
      return NextResponse.json(
        { error: "SUPERADMIN_EMAIL nicht konfiguriert" },
        { status: 500 }
      );
    }
    const greyboardUser = await prisma.user.findUnique({
      where: { email: superadminEmail },
      include: {
        account: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!greyboardUser || !greyboardUser.account) {
      console.error("[PROCESS-REGISTRATION] Greyboard Account nicht gefunden");
      return NextResponse.json(
        { error: "Greyboard Account nicht gefunden" },
        { status: 500 }
      );
    }

    const greyboardAccount = greyboardUser.account;

    console.log("[PROCESS-REGISTRATION] Greyboard Account gefunden:", {
      accountId: greyboardAccount.id,
      accountName: greyboardAccount.name,
    });

    // Prüfe, ob Lead bereits existiert (Duplikat-Prüfung)
    const existingLead = await prisma.lead.findFirst({
      where: {
        email: validatedData.userEmail,
        accountId: greyboardAccount.id,
      },
    });

    let lead;
    let company;

    if (existingLead) {
      console.log("[PROCESS-REGISTRATION] Lead existiert bereits:", existingLead.id);
      lead = existingLead;
      company = await prisma.company.findUnique({
        where: { id: existingLead.companyId },
      });
    } else {
      // Erstelle Company für die neue Firma im Greyboard Account
      company = await prisma.company.create({
        data: {
          name: validatedData.accountName,
          businessName: validatedData.accountName,
          phone: validatedData.userPhone || null,
          address: null,
          city: null,
          state: null,
          zipCode: null,
          country: "DE",
          website: null,
          googlePlaceId: `manual-${account.id}-${Date.now()}`,
        },
      });

      console.log("[PROCESS-REGISTRATION] Company erstellt:", {
        companyId: company.id,
        companyName: company.name,
      });

      // Teile Name in Vor- und Nachname
      const nameParts = validatedData.userName.trim().split(/\s+/);
      const firstName = nameParts[0] || validatedData.userName;
      const lastName = nameParts.slice(1).join(" ") || null;

      // Erstelle Lead (Kontakt) für den neuen Account-Besitzer im Greyboard Account
      lead = await prisma.lead.create({
        data: {
          name: validatedData.userName,
          firstName: firstName,
          lastName: lastName,
          email: validatedData.userEmail,
          phone: validatedData.userPhone || null,
          accountId: greyboardAccount.id, // WICHTIG: Lead gehört zum Greyboard Account
          companyId: company.id,
          status: "NEW",
          type: "CONTACT",
          source: "Simpalo", // Quelle: Simpalo
          priority: "MEDIUM",
          utmSource: validatedData.utmSource || null,
          utmMedium: validatedData.utmMedium || null,
          utmCampaign: validatedData.utmCampaign || null,
          utmTerm: validatedData.utmTerm || null,
          utmContent: validatedData.utmContent || null,
        },
      });

      // Erstelle automatisch eine Task "Lead kontaktieren" für neue CONTACT-Leads
      if (lead.status === "NEW" && lead.type === "CONTACT") {
        try {
          const { createContactTaskForLead } = await import("@/lib/actions/tasks");
          await createContactTaskForLead(lead.id);
        } catch (taskError) {
          // Fehler beim Erstellen der Task sollte Lead-Erstellung nicht blockieren
          console.error("Error creating contact task from registration:", taskError);
        }
      }

      console.log("[PROCESS-REGISTRATION] ✅ Lead erstellt im Greyboard Account:", {
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: lead.email,
        source: lead.source,
        accountId: lead.accountId,
        greyboardAccountId: greyboardAccount.id,
        greyboardAccountName: greyboardAccount.name,
        companyId: lead.companyId,
        type: lead.type,
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        utmCampaign: lead.utmCampaign,
        utmTerm: lead.utmTerm,
        utmContent: lead.utmContent,
        createdAt: lead.createdAt,
      });

      // Verifiziere, dass der Lead wirklich im Greyboard-Account erstellt wurde
      const verificationLead = await prisma.lead.findUnique({
        where: { id: lead.id },
        include: { account: true },
      });
      
      if (verificationLead) {
        console.log("[PROCESS-REGISTRATION] ✅ Verifikation: Lead gefunden in Account:", {
          leadId: verificationLead.id,
          accountId: verificationLead.accountId,
          accountName: verificationLead.account.name,
          accountIsActive: verificationLead.account.isActive,
        });
      } else {
        console.error("[PROCESS-REGISTRATION] ❌ FEHLER: Lead konnte nicht verifiziert werden!");
      }
    }

    // Erstelle Communication für die Registrierung (nur wenn Lead neu erstellt wurde)
    if (!existingLead) {
      await prisma.communication.create({
        data: {
          leadId: lead.id,
          type: "NOTE",
          direction: "INBOUND",
          subject: "Account-Registrierung",
          content: `Neuer Account wurde registriert.\nFirmenname: ${validatedData.accountName}\nE-Mail: ${validatedData.userEmail}${validatedData.userPhone ? `\nTelefon: ${validatedData.userPhone}` : ""}`,
        },
      });
      console.log("[PROCESS-REGISTRATION] Communication-Eintrag für Registrierung erstellt");
    }

    // WICHTIG: Lead ist jetzt erstellt - auch wenn E-Mail fehlschlägt, wird der Lead zurückgegeben
    console.log("[PROCESS-REGISTRATION] ✅ Lead erfolgreich erstellt:", {
      leadId: lead.id,
      leadName: lead.name,
      accountId: lead.accountId,
      greyboardAccountId: greyboardAccount.id,
    });

    // Sende Aktivierungs-E-Mail (nicht-blockierend - Fehler blockieren nicht die Response)
    // Der Lead wurde bereits erstellt, daher kann die E-Mail auch fehlschlagen
    try {
      const greyboardSettings = (greyboardAccount.settings?.settings as any) || {};
      const activationEmailSettings = greyboardSettings.activationEmailSettings || {};

      console.log("[PROCESS-REGISTRATION] Greyboard Settings:", {
        hasSettings: !!greyboardAccount.settings,
        hasActivationEmailSettings: !!activationEmailSettings,
        activationEmailEnabled: activationEmailSettings.enabled,
        hasMailgunApiKey: !!greyboardSettings.mailgunApiKey,
        hasMailgunDomain: !!greyboardSettings.mailgunDomain,
      });

      // Hole Mailgun-Config (aus Environment Variables oder Greyboard Account Settings)
      const mailgunConfig = getMailgunConfig(
        greyboardSettings.mailgunApiKey,
        greyboardSettings.mailgunDomain,
        greyboardSettings.mailgunRegion
      );

      console.log("[PROCESS-REGISTRATION] Mailgun Config:", {
        hasConfig: !!mailgunConfig,
        hasDomain: !!mailgunConfig?.domain,
        region: mailgunConfig?.region,
      });

      // E-Mail versenden wenn Mailgun konfiguriert ist und nicht explizit deaktiviert
      if (mailgunConfig && activationEmailSettings.enabled !== false) {
        // Generiere Aktivierungs-Token (CRM generiert den Token selbst, da es NEXTAUTH_SECRET hat)
        const activationToken = generateActivationToken(account.id);
        
        // Hole App-URL und entferne eventuelle Tippfehler oder doppelte Slashes
        let appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.simpalo.de";
        // Entferne trailing slash und korrigiere Tippfehler
        appUrl = appUrl.trim().replace(/\/$/, "").replace(/simpalo\.dee/i, "simpalo.de");
        // Token muss im Pfad sein, nicht als Query-Parameter (Route: /api/auth/activate/[token])
        // Token URL-encoden, da er Doppelpunkte enthält
        const encodedToken = encodeURIComponent(activationToken);
        const activationLink = `${appUrl}/api/auth/activate/${encodedToken}`;
        
        console.log("[PROCESS-REGISTRATION] Activation token generated and link:", {
          originalUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.simpalo.de",
          cleanedUrl: appUrl,
          token: activationToken.substring(0, 50) + "...",
          encodedToken: encodedToken.substring(0, 50) + "...",
          activationLink: activationLink.substring(0, 100) + "...",
        });

        // Template-Variablen
        const variables: Record<string, string> = {
          accountName: validatedData.accountName,
          userName: validatedData.userName,
          userEmail: validatedData.userEmail,
          activationLink: activationLink,
        };

        // Hole E-Mail-Vorlage aus Greyboard Account Settings
        const subject = activationEmailSettings.subject || "Aktiviere Deinen Simpalo Account";
        const content = activationEmailSettings.content || `
Hallo {{userName}},

vielen Dank für Deine Registrierung bei Simpalo!

Dein Firmenaccount "{{accountName}}" wurde erfolgreich erstellt. Um Deinen Account zu aktivieren, klicke bitte auf den folgenden Link:

{{activationLink}}

Der Link ist 7 Tage gültig.

Bei Fragen stehen wir Dir gerne zur Verfügung.

Mit freundlichen Grüßen
Dein Simpalo Team
        `.trim();

        const replacedSubject = replaceTemplateVariables(subject, variables);
        const replacedContent = replaceTemplateVariables(content, variables);

        // Bestimme Absenderadresse basierend auf verwendeter Mailgun-Domain
        // Priorität: Wenn Account-spezifische Domain verwendet wird, Account-Absenderadresse hat Vorrang
        //            Wenn globale Domain verwendet wird, globale Absenderadresse hat Vorrang
        const mailgunDomain = mailgunConfig.domain;
        const isUsingAccountDomain = (greyboardSettings.mailgunApiKey || greyboardSettings.mailgunDomain) && !process.env.MAILGUN_DOMAIN;
        
        let fromEmail: string;
        if (isUsingAccountDomain) {
          // Account verwendet eigene Mailgun-Domain → Account-Absenderadresse hat Vorrang
          fromEmail = activationEmailSettings.senderEmail || greyboardSettings.emailSettings?.senderEmail || process.env.MAILGUN_FROM_EMAIL || "";
        } else {
          // Globale Mailgun-Domain wird verwendet → Globale Absenderadresse hat Vorrang
          fromEmail = process.env.MAILGUN_FROM_EMAIL || activationEmailSettings.senderEmail || greyboardSettings.emailSettings?.senderEmail || "";
        }
        
        // Falls keine Absenderadresse konfiguriert, verwende info@ statt noreply@ (bessere Deliverability)
        if (!fromEmail) {
          fromEmail = `info@${mailgunDomain}`;
          console.log("[PROCESS-REGISTRATION] Keine Absenderadresse konfiguriert, verwende info@:", fromEmail);
        } else {
          // Prüfe, ob die konfigurierte Absenderadresse zur verwendeten Mailgun-Domain passt
          const fromDomain = fromEmail.split("@")[1];
          
          // Wenn die Absenderadresse nicht von der verifizierten Mailgun-Domain ist, verwende info@
          if (fromDomain !== mailgunDomain) {
            console.log("[PROCESS-REGISTRATION] Absenderadresse passt nicht zur Mailgun-Domain, verwende info@:", {
              configured: fromEmail,
              mailgunDomain: mailgunDomain,
              using: `info@${mailgunDomain}`,
            });
            fromEmail = `info@${mailgunDomain}`;
          }
        }
        
        const fromName = activationEmailSettings.senderName || greyboardSettings.emailSettings?.senderName || "Simpalo";

        console.log("[PROCESS-REGISTRATION] Sending activation email to:", validatedData.userEmail);

        // E-Mail mit 2 Minuten Verzögerung versenden
        const emailResult = await sendEmailViaMailgun(mailgunConfig, {
          to: validatedData.userEmail,
          from: fromEmail,
          fromName: fromName,
          subject: replacedSubject,
          html: replacedContent.replace(/\n/g, "<br>"),
          text: replacedContent,
          replyTo: activationEmailSettings.replyTo || fromEmail,
          delayMinutes: 2, // 2 Minuten Verzögerung
          metadata: {
            accountId: account.id,
            type: "account-activation",
          },
        });

        console.log("[PROCESS-REGISTRATION] Activation email sent successfully, mailgunId:", emailResult.id);

        // Erstelle Communication-Eintrag für die gesendete E-Mail
        await prisma.communication.create({
          data: {
            leadId: lead.id,
            type: "EMAIL",
            direction: "OUTBOUND",
            subject: replacedSubject,
            content: replacedContent,
            status: "scheduled", // Status: scheduled, da E-Mail mit Verzögerung versendet wird
            mailgunId: emailResult.id,
            metadata: {
              type: "account-activation",
              recipientEmail: validatedData.userEmail,
              delayMinutes: 2,
              sentAt: new Date().toISOString(),
            },
          },
        });

        console.log("[PROCESS-REGISTRATION] Communication entry created for activation email");
      } else {
        console.warn("[PROCESS-REGISTRATION] Activation email not sent:", {
          hasMailgunConfig: !!mailgunConfig,
          activationEmailEnabled: activationEmailSettings.enabled,
          reason: !mailgunConfig ? "No Mailgun config" : "Email disabled",
        });
      }
    } catch (emailError) {
      // Logge Fehler, aber blockiere nicht die Lead-Erstellung
      console.error("[PROCESS-REGISTRATION] Fehler beim Versenden der Aktivierungs-E-Mail:", emailError);
      console.error("[PROCESS-REGISTRATION] Error details:", {
        message: emailError instanceof Error ? emailError.message : String(emailError),
        stack: emailError instanceof Error ? emailError.stack : undefined,
      });
    }

    // Logge Security Event (nicht-blockierend)
    if (account.users[0]) {
      logSecurityEvent({
        userId: account.users[0].id,
        accountId: account.id,
        eventType: "ACCOUNT_ACTIVATED",
        entityType: "Account",
        entityId: account.id,
        description: `Account "${account.name}" wurde registriert - Lead erstellt und E-Mail gesendet`,
        metadata: {
          accountName: account.name,
          leadId: lead.id,
        },
        ipAddress: undefined,
        userAgent: undefined,
      }).catch((err) => console.error("Error logging security event:", err));
    }

    console.log("[PROCESS-REGISTRATION] Erfolgreich abgeschlossen:", {
      leadId: lead.id,
      leadName: lead.name,
      accountId: lead.accountId,
    });

    // Finale Verifikation: Prüfe, ob Lead im Greyboard-Account existiert
    const finalVerification = await prisma.lead.findFirst({
      where: {
        id: lead.id,
        accountId: greyboardAccount.id,
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    console.log("[PROCESS-REGISTRATION] ✅ Finale Verifikation:", {
      leadExists: !!finalVerification,
      leadId: lead.id,
      leadAccountId: finalVerification?.accountId,
      greyboardAccountId: greyboardAccount.id,
      accountName: finalVerification?.account.name,
      accountIsActive: finalVerification?.account.isActive,
      match: finalVerification?.accountId === greyboardAccount.id,
    });

    return NextResponse.json({
      success: true,
      message: "Registrierung verarbeitet",
      leadId: lead.id,
      leadName: lead.name,
      leadEmail: lead.email,
      accountId: lead.accountId,
      greyboardAccountId: greyboardAccount.id,
      greyboardAccountName: greyboardAccount.name,
      verification: {
        leadExists: !!finalVerification,
        accountMatch: finalVerification?.accountId === greyboardAccount.id,
        accountIsActive: finalVerification?.account.isActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[PROCESS-REGISTRATION] Validierungsfehler:", error.errors);
      return NextResponse.json(
        { error: "Ungültige Daten", details: error.errors },
        { status: 400 }
      );
    }

    console.error("[PROCESS-REGISTRATION] Unerwarteter Fehler:", error);
    console.error("[PROCESS-REGISTRATION] Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { 
        error: "Fehler bei der Verarbeitung der Registrierung",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
