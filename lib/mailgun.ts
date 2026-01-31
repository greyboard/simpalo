import formData from "form-data";
import Mailgun from "mailgun.js";

export interface SendEmailOptions {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  html: string;
  text?: string;
  delayMinutes?: number;
  replyTo?: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{ filename: string; data: Buffer | string }>;
  metadata?: Record<string, string>;
}

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  region?: "us" | "eu"; // Mailgun region (default: "us")
}

/**
 * Send email via Mailgun API
 * @param config Mailgun configuration (API key and domain)
 * @param options Email options (to, from, subject, content, etc.)
 * @returns Mailgun message ID
 */
export async function sendEmailViaMailgun(
  config: MailgunConfig,
  options: SendEmailOptions
): Promise<{ id: string; message: string }> {
  const mailgun = new Mailgun(formData);
  
  // Configure client - mailgun.js automatically uses the correct region based on the API key
  // For EU region, use: https://api.eu.mailgun.net
  const clientConfig: any = { 
    username: "api", 
    key: config.apiKey 
  };
  
  // For EU region, we need to use the EU endpoint
  if (config.region === "eu") {
    clientConfig.url = "https://api.eu.mailgun.net";
  }
  
  const client = mailgun.client(clientConfig);

  const messageData: any = {
    from: options.fromName
      ? `${options.fromName} <${options.from}>`
      : options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    "h:Reply-To": options.replyTo || options.from,
  };

  // Add CC if provided
  if (options.cc) {
    messageData.cc = options.cc;
  }

  // Add BCC if provided
  if (options.bcc) {
    messageData.bcc = options.bcc;
  }

  // Add text version if provided
  if (options.text) {
    messageData.text = options.text;
  }

  // Add attachments if provided
  if (options.attachments && options.attachments.length > 0) {
    messageData.attachment = options.attachments.map((att) => ({
      filename: att.filename,
      data: att.data,
    }));
  }

  // Add scheduled delivery time if delay is specified
  if (options.delayMinutes && options.delayMinutes > 0) {
    const deliveryTime = new Date();
    deliveryTime.setMinutes(deliveryTime.getMinutes() + options.delayMinutes);
    // Mailgun uses RFC2822 format
    const deliveryTimeString = deliveryTime.toUTCString();
    messageData["o:deliverytime"] = deliveryTimeString;
    console.log("[MAILGUN] Scheduled email delivery:", {
      delayMinutes: options.delayMinutes,
      deliveryTime: deliveryTimeString,
      currentTime: new Date().toUTCString(),
    });
  }

  // Add metadata for tracking
  if (options.metadata) {
    Object.entries(options.metadata).forEach(([key, value]) => {
      messageData[`v:${key}`] = value;
    });
  }

  try {
    console.log("[MAILGUN] Sending email:", {
      to: options.to,
      from: options.from,
      subject: options.subject,
      domain: config.domain,
      region: config.region,
      hasDelay: !!(options.delayMinutes && options.delayMinutes > 0),
      delayMinutes: options.delayMinutes,
      hasAttachments: !!(options.attachments && options.attachments.length > 0),
      attachmentCount: options.attachments?.length || 0,
    });
    
    const response = await client.messages.create(config.domain, messageData);
    
    console.log("[MAILGUN] Email sent successfully:", {
      mailgunId: response.id,
      message: response.message,
      domain: config.domain,
      region: config.region,
    });
    
    return {
      id: response.id || "",
      message: response.message || "Email sent successfully",
    };
  } catch (error: any) {
    console.error("Mailgun error details:", {
      message: error.message,
      status: error.status || error.statusCode,
      statusText: error.statusText,
      response: error.response?.data || error.response,
      config: {
        domain: config.domain,
        region: config.region || "us",
        apiKeyPrefix: config.apiKey?.substring(0, 20) + "...",
      },
    });
    
    // Provide more detailed error messages
    let errorMessage = error.message || "Failed to send email via Mailgun";
    
    if (error.status === 401 || error.statusCode === 401) {
      errorMessage = "Unautorisiert: Bitte überprüfe den Mailgun API Key und die Domain. Stelle sicher, dass Du den korrekten Private API Key aus dem Mailgun Dashboard verwendest und die richtige Region (US/EU) gewählt hast.";
    } else if (error.status === 403 || error.statusCode === 403) {
      errorMessage = "Zugriff verweigert: Bitte überprüfe die IP-Whitelist in Deinen Mailgun-Einstellungen oder verwende einen API-Key mit den richtigen Berechtigungen.";
    } else if (error.status === 400 || error.statusCode === 400) {
      const errorDetails = error.response?.data?.message || error.response?.body?.message || "";
      errorMessage = `Bad Request: ${errorDetails || "Bitte überprüfe die E-Mail-Parameter (From, To, Subject, Content)"}`;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Replace template variables in content
 * @param template Template string with placeholders like {{vorname}}
 * @param variables Object with variable values
 * @returns Replaced template string
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | undefined>
): string {
  let result = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    result = result.replace(regex, value || "");
  });

  return result;
}

/**
 * Get Mailgun configuration from environment variables (priority) or account settings (fallback)
 * @param accountMailgunApiKey Optional account-specific Mailgun API key (fallback)
 * @param accountMailgunDomain Optional account-specific Mailgun domain (fallback)
 * @param accountMailgunRegion Optional account-specific Mailgun region (us/eu)
 * @returns Mailgun configuration
 */
export function getMailgunConfig(
  accountMailgunApiKey?: string,
  accountMailgunDomain?: string,
  accountMailgunRegion?: "us" | "eu"
): MailgunConfig | null {
  // Priority: Environment variables first, then account settings
  const apiKey =
    process.env.MAILGUN_API_KEY || accountMailgunApiKey || null;
  const domain =
    process.env.MAILGUN_DOMAIN || accountMailgunDomain || null;
  
  // Default to EU region if not specified (most European accounts use EU)
  const envRegion = process.env.MAILGUN_REGION === "us" ? "us" : process.env.MAILGUN_REGION === "eu" ? "eu" : undefined;
  const region = envRegion || accountMailgunRegion || "eu";

  if (!apiKey || !domain) {
    return null;
  }

  return {
    apiKey,
    domain,
    region,
  };
}

export interface DomainVerificationStatus {
  domain: string;
  isVerified: boolean;
  spfStatus: "valid" | "invalid" | "not_set" | "unknown";
  dkimStatus: "valid" | "invalid" | "not_set" | "unknown";
  dmarcStatus: "valid" | "invalid" | "not_set" | "unknown";
  receivingRecordsStatus?: "valid" | "invalid" | "not_set" | "unknown";
  sendingRecordsStatus?: "valid" | "invalid" | "not_set" | "unknown";
  error?: string;
}

/**
 * Check Mailgun domain verification status
 * @param config Mailgun configuration
 * @returns Domain verification status
 */
export async function checkMailgunDomainVerification(
  config: MailgunConfig
): Promise<DomainVerificationStatus> {
  try {
    const mailgun = new Mailgun(formData);
    const clientConfig: any = {
      username: "api",
      key: config.apiKey,
    };

    if (config.region === "eu") {
      clientConfig.url = "https://api.eu.mailgun.net";
    }

    const client = mailgun.client(clientConfig);

    // Get domain information from Mailgun API with DNS records
    const domainInfo = await client.domains.get(config.domain, {
      extended: true,
      with_dns: true,
    });

    // Parse verification status from Mailgun response
    const state = domainInfo.state || "unverified";
    const sendingDNSRecords = ((domainInfo as any).sending_dns_records || []) as any[];
    const receivingDNSRecords = ((domainInfo as any).receiving_dns_records || []) as any[];

    // Helper function to find record by type
    const findRecord = (records: any[], recordType: string) => {
      return records.find((r: any) => 
        r.record_type === recordType || 
        r.type === recordType ||
        (r.name && r.name.toLowerCase().includes(recordType.toLowerCase()))
      );
    };

    // Check SPF status
    const spfRecord = findRecord(sendingDNSRecords, "TXT") || 
                      findRecord(sendingDNSRecords, "SPF") ||
                      sendingDNSRecords.find((r: any) => r.value && r.value.includes("v=spf1"));
    let spfStatus: "valid" | "invalid" | "not_set" | "unknown" = "not_set";
    if (spfRecord) {
      if (spfRecord.valid === "valid" || spfRecord.valid === true) {
        spfStatus = "valid";
      } else if (spfRecord.valid === "unknown") {
        spfStatus = "unknown";
      } else {
        spfStatus = "invalid";
      }
    }

    // Check DKIM status
    const dkimRecord = findRecord(sendingDNSRecords, "TXT") ||
                       sendingDNSRecords.find((r: any) => 
                         r.name && r.name.includes("_domainkey") ||
                         r.value && r.value.includes("v=DKIM1")
                       );
    let dkimStatus: "valid" | "invalid" | "not_set" | "unknown" = "not_set";
    if (dkimRecord) {
      if (dkimRecord.valid === "valid" || dkimRecord.valid === true) {
        dkimStatus = "valid";
      } else if (dkimRecord.valid === "unknown") {
        dkimStatus = "unknown";
      } else {
        dkimStatus = "invalid";
      }
    }

    // Check DMARC status
    const dmarcRecord = findRecord(sendingDNSRecords, "TXT") ||
                        sendingDNSRecords.find((r: any) => 
                          r.name && r.name.includes("_dmarc") ||
                          r.value && r.value.includes("v=DMARC1")
                        );
    let dmarcStatus: "valid" | "invalid" | "not_set" | "unknown" = "not_set";
    if (dmarcRecord) {
      if (dmarcRecord.valid === "valid" || dmarcRecord.valid === true) {
        dmarcStatus = "valid";
      } else if (dmarcRecord.valid === "unknown") {
        dmarcStatus = "unknown";
      } else {
        dmarcStatus = "invalid";
      }
    }

    // Check receiving records (for incoming emails)
    let receivingStatus: "valid" | "invalid" | "not_set" | "unknown" = "not_set";
    if (receivingDNSRecords && receivingDNSRecords.length > 0) {
      const allValid = receivingDNSRecords.every((r: any) => r.valid === "valid" || r.valid === true);
      receivingStatus = allValid ? "valid" : "invalid";
    }

    // Overall verification status
    const isVerified =
      state === "active" &&
      (spfStatus === "valid" || spfStatus === "unknown") &&
      (dkimStatus === "valid" || dkimStatus === "unknown");

    return {
      domain: config.domain,
      isVerified,
      spfStatus,
      dkimStatus,
      dmarcStatus,
      receivingRecordsStatus: receivingStatus,
      sendingRecordsStatus:
        spfStatus === "valid" && dkimStatus === "valid" ? "valid" : "invalid",
    };
  } catch (error: any) {
    console.error("Error checking Mailgun domain verification:", error);
    return {
      domain: config.domain,
      isVerified: false,
      spfStatus: "unknown",
      dkimStatus: "unknown",
      dmarcStatus: "unknown",
      error: error.message || "Fehler beim Abrufen der Domain-Informationen",
    };
  }
}
