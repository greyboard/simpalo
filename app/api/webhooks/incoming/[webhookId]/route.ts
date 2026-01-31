import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAddress } from "@/lib/utils";
import { sendEmailToLead } from "@/lib/email-service";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

// Helper-Funktion für CORS-Header
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
  };
}

/**
 * OPTIONS handler für CORS Preflight-Requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/webhooks/incoming/[webhookId]
 * Empfängt eingehende Webhook-Daten und erstellt Leads
 * Funktioniert ohne Secret - nur die URL ist erforderlich (wie Zoho, GoHighLevel)
 * Unterstützt JSON, Form-Data und URL-encoded Daten
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  let payload: any = {};
  let webhookLogId: string | null = null;
  
  try {
    // Finde Webhook anhand der webhookId (ohne Secret erforderlich)
    const webhook = await prisma.webhook.findUnique({
      where: { webhookId: params.webhookId },
    });

    if (!webhook) {
      return NextResponse.json(
        { error: "Ungültiger Webhook" },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    if (!webhook.isActive) {
      return NextResponse.json(
        { error: "Webhook ist deaktiviert" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Optional: Secret-Validierung, falls vorhanden
    if (webhook.secret) {
      const authHeader = request.headers.get("authorization");
      const providedSecret = authHeader?.replace("Bearer ", "") || 
                            request.headers.get("x-webhook-secret");
      
      if (providedSecret !== webhook.secret) {
        return NextResponse.json(
          { error: "Ungültige Authentifizierung" },
          { status: 401, headers: getCorsHeaders() }
        );
      }
    }

    // Empfange Payload - unterstützt JSON, Form-Data und URL-encoded
    const contentType = request.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      // Fallback: Versuche JSON zu parsen
      try {
        payload = await request.json();
      } catch {
        // Falls JSON fehlschlägt, versuche Form-Data
        const formData = await request.formData();
        payload = Object.fromEntries(formData.entries());
      }
    }
    
    // Logge Payload SOFORT in der Datenbank, damit es im Monitoring sichtbar ist
    // Der Status wird später aktualisiert, wenn der Lead erfolgreich erstellt wurde
    try {
      const webhookLog = await prisma.webhookLog.create({
        data: {
          webhookId: webhook.id,
          payload: payload,
          success: false,
          error: "Wird verarbeitet...",
        },
      });
      webhookLogId = webhookLog.id;
      console.log("Webhook request logged in database:", webhookLog.id);
    } catch (logError) {
      // Ignoriere Log-Fehler, um die Lead-Erstellung nicht zu blockieren
      console.error("Error logging webhook request:", logError);
    }

    // Extrahiere Lead-Daten aus dem Payload
    // Unterstützt verschiedene Formate basierend auf Webhook-Settings
    const settings = webhook.settings as any || {};
    const fieldMapping = settings.fieldMapping || {};

    // Standard-Feld-Mapping (kann über Settings überschrieben werden)
    const getField = (fieldName: string, defaultValue: any = null) => {
      const mappedField = fieldMapping[fieldName] || fieldName;
      return payload[mappedField] || payload[fieldName] || defaultValue;
    };

    // Company-Daten zusammenstellen
    const companyData: any = {
      name: getField("businessName") || getField("company") || getField("name") || "Unbekannt",
      businessName: getField("businessName") || getField("company") || null,
      address: getField("address") || getField("formatted_address") || null,
      city: getField("city") || null,
      state: getField("state") || null,
      zipCode: getField("zipCode") || getField("zip") || getField("postalCode") || null,
      country: getField("country") || "DE",
      phone: getField("phone") || getField("telephone") || null,
      website: getField("website") || getField("url") || null,
      category: getField("category") || getField("type") || null,
      googlePlaceId: getField("googlePlaceId") || `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Adresse parsen, wenn nur address vorhanden
    if (companyData.address && !companyData.city) {
      const parsedAddress = parseAddress(companyData.address);
      companyData.city = companyData.city || parsedAddress.city;
      companyData.zipCode = companyData.zipCode || parsedAddress.zipCode;
      companyData.state = companyData.state || parsedAddress.state;
    }

    // Lead-Daten zusammenstellen
    const firstName = getField("firstName") || getField("first_name") || null;
    const lastName = getField("lastName") || getField("last_name") || null;
    const fullName = getField("name") || getField("fullName") || getField("full_name") || null;
    
    // Name zusammenstellen: Falls firstName/lastName vorhanden, kombinieren, sonst fullName oder Fallback
    let leadName = fullName;
    if (firstName && lastName) {
      leadName = `${firstName} ${lastName}`;
    } else if (firstName || lastName) {
      leadName = (firstName || "") + (lastName || "");
    }
    if (!leadName) {
      leadName = getField("businessName") || getField("company") || "Unbekannt";
    }
    
    const leadData: any = {
      name: leadName,
      firstName: firstName || null,
      lastName: lastName || null,
      email: getField("email") || null,
      phone: getField("phone") || getField("telephone") || null,
      source: webhook.source,
      status: getField("status") || "NEW",
      priority: getField("priority") || "MEDIUM",
      // UTM-Parameter
      utmSource: getField("utmSource") || getField("utm_source") || null,
      utmMedium: getField("utmMedium") || getField("utm_medium") || null,
      utmCampaign: getField("utmCampaign") || getField("utm_campaign") || null,
      utmTerm: getField("utmTerm") || getField("utm_term") || null,
      utmContent: getField("utmContent") || getField("utm_content") || null,
    };

    // Duplikat-Prüfung (optional, basierend auf E-Mail oder Telefon)
    if (settings.checkDuplicates !== false) {
      const duplicateCheck: any = {};
      
      if (leadData.email) {
        duplicateCheck.email = leadData.email;
      } else if (leadData.phone) {
        duplicateCheck.phone = leadData.phone;
      }

      if (Object.keys(duplicateCheck).length > 0) {
        const existingLead = await prisma.lead.findFirst({
          where: duplicateCheck,
        });

        if (existingLead) {
          return NextResponse.json(
            {
              error: "Lead existiert bereits",
              existingLeadId: existingLead.id,
              existingLead,
            },
            { status: 409, headers: getCorsHeaders() }
          );
        }
      }
    }

    // Company erstellen oder finden
    let company = await prisma.company.findUnique({
      where: { googlePlaceId: companyData.googlePlaceId },
    });

    if (!company) {
      company = await prisma.company.create({
        data: companyData,
      });
    }

    // Lead erstellen
    const lead = await prisma.lead.create({
      data: {
        ...leadData,
        accountId: webhook.accountId,
        companyId: company.id,
        type: "CONTACT", // Webhook = Kontakt
        status: leadData.status || "NEW", // Stelle sicher, dass Status gesetzt ist
      },
      include: {
        company: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    console.log(`Webhook: Lead erfolgreich erstellt - ID: ${lead.id}, Name: ${lead.name}`);

    // Erstelle automatisch eine Task "Lead kontaktieren" für neue CONTACT-Leads mit Status NEW
    if (lead.status === "NEW" && lead.type === "CONTACT") {
      try {
        const { createContactTaskForLead } = await import("@/lib/actions/tasks");
        await createContactTaskForLead(lead.id);
      } catch (taskError) {
        // Fehler beim Erstellen der Task sollte Lead-Erstellung nicht blockieren
        console.error("Error creating contact task from webhook:", taskError);
      }
    }

    // Kommunikation aus Webhook-Anfrage erstellen (Datum/Uhrzeit/Betreff/Nachricht)
    try {
      const subject = getField("subject") || getField("betreff") || "Anfrage per Webhook";
      const message = getField("message") || getField("nachricht") || getField("content") || getField("text") || null;
      
      let communicationContent = message || "Anfrage erhalten";
      if (!message) {
        communicationContent = "Anfrage erhalten\nDatenschutz akzeptiert: Ja (Standard)";
      } else {
        communicationContent = `${message}\n\nDatenschutz akzeptiert: Ja (Standard)`;
      }
      
      await prisma.communication.create({
        data: {
          leadId: lead.id,
          type: "NOTE", // CommunicationType.NOTE für Formular-Anfragen
          direction: "INBOUND",
          subject: subject,
          content: communicationContent,
        },
      });
    } catch (commError) {
      console.error("Error creating communication from webhook:", commError);
      // Nicht kritisch - Lead wurde bereits erstellt
    }

    // Optional: Automatische Tag-Zuweisung basierend auf Webhook-Settings
    if (settings.autoTags && Array.isArray(settings.autoTags)) {
      const accountId = webhook.accountId;
      for (const tagName of settings.autoTags) {
        try {
          // Finde oder erstelle Tag
          const tag = await prisma.tag.upsert({
            where: { 
              accountId_name: {
                accountId: accountId,
                name: tagName,
              },
            },
            update: {},
            create: {
              name: tagName,
              color: "#3B82F6",
              accountId: accountId,
            },
          });

          // Füge Tag zu Lead hinzu (wenn noch nicht vorhanden)
          await prisma.leadTag.upsert({
            where: {
              leadId_tagId: {
                leadId: lead.id,
                tagId: tag.id,
              },
            },
            update: {},
            create: {
              leadId: lead.id,
              tagId: tag.id,
            },
          });
        } catch (error) {
          console.error(`Error adding tag ${tagName}:`, error);
          // Weiter mit nächstem Tag
        }
      }
    }

    // Aktualisiere Log mit Erfolg-Status
    if (webhookLogId) {
      try {
        await prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            success: true,
            error: null,
            leadId: lead.id,
          },
        });
      } catch (logError) {
        console.error("Error updating webhook log:", logError);
      }
    }

    // E-Mail-Versand: Auto-Reply und Owner-Notification
    // WICHTIG: Diese Logik läuft NACH der erfolgreichen Antwort, vollständig asynchron
    // Fehler werden geloggt, aber stoppen nicht die Lead-Erstellung
    // Verwende setImmediate, um sicherzustellen, dass die Antwort zuerst gesendet wird
    setImmediate(() => {
      (async () => {
        try {
          // Load account settings for email configuration
          const accountSettings = await prisma.accountSettings.findUnique({
            where: { accountId: webhook.accountId },
          });

          if (!accountSettings) {
            return; // Keine E-Mail-Einstellungen vorhanden
          }

          const settings = (accountSettings.settings as any) || {};
          const emailSettings = settings.emailSettings || {};

          // Check if webhook is in the auto-reply webhook list
          const autoReplyWebhookIds = emailSettings.autoReplyWebhookIds || [];
          const shouldSendAutoReply =
            emailSettings.autoReplyEnabled &&
            autoReplyWebhookIds.includes(webhook.id) &&
            lead.email;

          // Send auto-reply email if enabled and webhook is selected
          if (shouldSendAutoReply) {
            sendEmailToLead({
              leadId: lead.id,
              type: "auto-reply",
              recipientEmail: lead.email!,
              recipientName: lead.name || undefined,
              accountId: webhook.accountId,
            }).catch((emailError: any) => {
              console.error("Error sending auto-reply email:", emailError?.message || emailError);
              // Nicht kritisch - Lead wurde bereits erstellt
            });
          }

          // Send owner notification if enabled
          if (emailSettings.ownerNotificationEnabled && emailSettings.ownerNotificationEmail) {
            // Use email address from settings (not from user database)
            sendEmailToLead({
              leadId: lead.id,
              type: "owner-notification",
              recipientEmail: emailSettings.ownerNotificationEmail,
              recipientName: undefined, // No name available from settings
              accountId: webhook.accountId,
            }).catch((emailError: any) => {
              console.error("Error sending owner notification:", emailError?.message || emailError);
              // Nicht kritisch - Lead wurde bereits erstellt
            });
          }
        } catch (emailError: any) {
          console.error("Error in email sending logic:", emailError?.message || emailError);
          // Nicht kritisch - Lead wurde bereits erstellt
        }
      })().catch((error: any) => {
        console.error("Unhandled error in email sending IIFE:", error?.message || error);
        // Absolut nicht kritisch - Lead wurde bereits erstellt, Webhook sollte erfolgreich sein
      });
    });

    return NextResponse.json(
      {
        success: true,
        lead,
        company: lead.company,
        message: "Lead erfolgreich erstellt",
      },
      { status: 201, headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    const errorMessage = error?.message || error?.toString() || "Unbekannter Fehler";
    
    // Aktualisiere Log mit Fehler-Status
    if (webhookLogId) {
      try {
        await prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            success: false,
            error: errorMessage,
          },
        });
      } catch (logError) {
        console.error("Error updating webhook log:", logError);
      }
    } else {
      // Falls kein Log existiert, erstelle einen (z.B. wenn Fehler vor dem Logging auftritt)
      try {
        const webhook = await prisma.webhook.findUnique({
          where: { webhookId: params.webhookId },
        });
        if (webhook) {
          await prisma.webhookLog.create({
            data: {
              webhookId: webhook.id,
              payload: payload,
              success: false,
              error: errorMessage,
            },
          });
        }
      } catch (logError) {
        console.error("Error creating error webhook log:", logError);
      }
    }
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Lead mit diesen Daten existiert bereits" },
        { status: 409, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      {
        error: "Fehler beim Verarbeiten des Webhooks",
        details: errorMessage,
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
