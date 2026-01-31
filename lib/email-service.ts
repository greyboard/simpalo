import { prisma } from "@/lib/prisma";
import {
  sendEmailViaMailgun,
  replaceTemplateVariables,
  getMailgunConfig,
} from "@/lib/mailgun";

interface SendEmailToLeadOptions {
  leadId: string;
  type: "auto-reply" | "owner-notification";
  recipientEmail: string;
  recipientName?: string;
  accountId: string; // Required for server-side calls without session
}

/**
 * Send email to lead or lead owner (server-side function, can be called without session)
 */
export async function sendEmailToLead(options: SendEmailToLeadOptions) {
  const { leadId, type, recipientEmail, recipientName, accountId } = options;

  // Load lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      account: {
        include: {
          settings: true,
        },
      },
      company: true,
      communications: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!lead || lead.accountId !== accountId) {
    throw new Error("Lead nicht gefunden");
  }

  // Load account email settings
  const accountSettings = lead.account.settings;
  const settings = (accountSettings?.settings as any) || {};
  const emailSettings = settings.emailSettings || {};

  // Get Mailgun config: Environment variables have priority, then account settings (fallback)
  const accountMailgunApiKey = settings.mailgunApiKey || undefined;
  const accountMailgunDomain = settings.mailgunDomain || undefined;
  const accountMailgunRegion = settings.mailgunRegion || undefined;
  
  const mailgunConfig = getMailgunConfig(
    accountMailgunApiKey,
    accountMailgunDomain,
    accountMailgunRegion
  );

  if (!mailgunConfig) {
    throw new Error("Mailgun nicht konfiguriert");
  }

  // Determine email template and variables based on type
  let subject = "";
  let content = "";
  let delayMinutes = 0;

  if (type === "auto-reply") {
    if (!emailSettings.autoReplyEnabled) {
      throw new Error("Automatische Antwort ist nicht aktiviert");
    }

    subject = emailSettings.leadTemplate?.subject || "";
    content = emailSettings.leadTemplate?.content || "";
    delayMinutes = emailSettings.autoReplyDelayMinutes || 0;
  } else if (type === "owner-notification") {
    if (!emailSettings.ownerNotificationEnabled) {
      throw new Error("Benachrichtigung an Leadbesitzer ist nicht aktiviert");
    }

    subject = emailSettings.ownerTemplate?.subject || "";
    content = emailSettings.ownerTemplate?.content || "";
    delayMinutes = 0; // Owner notifications are sent immediately
  } else {
    throw new Error("Ungültiger E-Mail-Typ");
  }

  // Replace template variables
  const variables: Record<string, string | undefined> = {
    vorname: lead.firstName || lead.name?.split(" ")[0] || "",
    nachname: lead.lastName || lead.name?.split(" ").slice(1).join(" ") || "",
    name: lead.name || "",
    email: lead.email || "",
    telefon: lead.phone || "",
    firma: lead.company?.name || "",
    adresse: lead.company?.address || "",
    stadt: lead.company?.city || "",
    plz: lead.company?.zipCode || "",
    anfrage: lead.communications?.[0]?.content || "",
  };

  // For owner notification, also include recipient info
  if (type === "owner-notification" && recipientName) {
    variables.empfaenger = recipientName;
  }

  const replacedSubject = replaceTemplateVariables(subject, variables);
  const replacedContent = replaceTemplateVariables(content, variables);

  // Bestimme Absenderadresse basierend auf verwendeter Mailgun-Domain
  // Priorität: Wenn Account-spezifische Domain verwendet wird, Account-Absenderadresse hat Vorrang
  //            Wenn globale Domain verwendet wird, globale Absenderadresse hat Vorrang
  const mailgunDomain = mailgunConfig.domain;
  const isUsingAccountDomain = (accountMailgunApiKey || accountMailgunDomain) && !process.env.MAILGUN_DOMAIN;
  
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
    console.log("[EMAIL-SERVICE] Keine Absenderadresse konfiguriert, verwende info@:", fromEmail);
  } else {
    // Prüfe, ob die konfigurierte Absenderadresse zur verwendeten Mailgun-Domain passt
    const fromDomain = fromEmail.split("@")[1];
    
    // Wenn die Absenderadresse nicht von der verifizierten Mailgun-Domain ist, verwende info@
    if (fromDomain !== mailgunDomain) {
      console.log("[EMAIL-SERVICE] Absenderadresse passt nicht zur Mailgun-Domain, verwende info@:", {
        configured: fromEmail,
        mailgunDomain: mailgunDomain,
        using: `info@${mailgunDomain}`,
      });
      fromEmail = `info@${mailgunDomain}`;
    }
  }

  if (!replacedSubject || !replacedSubject.trim()) {
    throw new Error(
      "E-Mail-Betreff ist leer. Bitte konfigurieren Sie einen Betreff in den E-Mail-Einstellungen."
    );
  }

  if (!replacedContent || !replacedContent.trim()) {
    throw new Error(
      "E-Mail-Inhalt ist leer. Bitte konfiguriere einen Inhalt in den E-Mail-Einstellungen."
    );
  }

  if (!recipientEmail || !recipientEmail.trim()) {
    throw new Error("Empfängeradresse (To) ist nicht angegeben.");
  }

  // Send email via Mailgun
  const result = await sendEmailViaMailgun(mailgunConfig, {
    to: recipientEmail,
    from: fromEmail,
    fromName: emailSettings.senderName || undefined,
    subject: replacedSubject,
    html: replacedContent.replace(/\n/g, "<br>"),
    text: replacedContent,
    delayMinutes,
    replyTo: emailSettings.replyTo || emailSettings.senderEmail || undefined,
    metadata: {
      leadId: lead.id,
      accountId: accountId,
      type: type,
    },
  });

  // Create communication record ONLY for auto-reply emails (not for owner notifications)
  // Owner notifications are internal and should not appear in communication history
  let communicationId: string | null = null;
  if (type === "auto-reply") {
    const communication = await prisma.communication.create({
      data: {
        leadId: lead.id,
        type: "EMAIL",
        direction: "OUTBOUND",
        subject: replacedSubject,
        content: replacedContent,
        status: delayMinutes > 0 ? "scheduled" : "sent",
        mailgunId: result.id,
        metadata: {
          type: type,
          recipientEmail: recipientEmail,
          delayMinutes: delayMinutes,
          sentAt: new Date().toISOString(),
        },
      },
    });
    communicationId = communication.id;

    // NICHT: Auto-Reply E-Mails ändern den Lead-Status NICHT auf CONTACTED
    // Auto-Replies sind automatische Antworten und bedeuten nicht, dass jemand
    // die Anfrage wirklich bearbeitet hat. Der Status wird nur bei manuellen
    // E-Mails (z.B. in /api/leads/[id]/send-email) geändert.
  }

  return {
    success: true,
    communicationId: communicationId,
    mailgunId: result.id,
    message: result.message,
  };
}
