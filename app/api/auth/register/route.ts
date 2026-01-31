import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sendEmailViaMailgun, replaceTemplateVariables, getMailgunConfig } from "@/lib/mailgun";
import crypto from "crypto";
import { getSuperadminEmail } from "@/lib/superadmin";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein"),
  accountName: z.string().min(2, "Firmenname muss mindestens 2 Zeichen lang sein"),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Prüfe ob E-Mail bereits existiert
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert" },
        { status: 400 }
      );
    }

    // Erstelle Account-Slug
    let accountSlug = generateSlug(validatedData.accountName);
    let slugExists = await prisma.account.findUnique({
      where: { slug: accountSlug },
    });

    // Falls Slug bereits existiert, füge Zufallszahl hinzu
    if (slugExists) {
      accountSlug = `${accountSlug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Hash Passwort
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Erstelle Account und ersten User (Owner)
    const account = await prisma.account.create({
      data: {
        name: validatedData.accountName,
        slug: accountSlug,
        email: validatedData.email,
        users: {
          create: {
            email: validatedData.email,
            name: validatedData.name,
            password: hashedPassword,
            role: "OWNER",
            isActive: true,
          },
        },
        settings: {
          create: {},
        },
      },
      include: {
        users: true,
      },
    });

    const user = account.users[0];

    // Erstelle UserSettings
    await prisma.userSettings.create({
      data: {
        userId: user.id,
      },
    });

    // Erstelle Lead für die neue Registrierung im Superadmin Account
    // Finde Superadmin Account
    const superadminEmail = getSuperadminEmail();
    if (superadminEmail) {
      const greyboardUser = await prisma.user.findUnique({
        where: { email: superadminEmail },
        include: {
          account: true,
        },
      });

      if (greyboardUser && greyboardUser.account) {
      // Erstelle Company für die neue Firma im Greyboard Account
      const dummyPlaceId = `registration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const company = await prisma.company.create({
        data: {
          name: validatedData.accountName,
          businessName: validatedData.accountName,
          googlePlaceId: dummyPlaceId,
          country: "DE",
        },
      });

      // Teile Name in Vor- und Nachname
      const nameParts = validatedData.name.trim().split(/\s+/);
      const firstName = nameParts[0] || validatedData.name;
      const lastName = nameParts.slice(1).join(" ") || null;

      // Erstelle Lead im Greyboard Account (nicht im eigenen Account!)
      const lead = await prisma.lead.create({
        data: {
          name: validatedData.name,
          firstName: firstName,
          lastName: lastName,
          email: validatedData.email,
          accountId: greyboardUser.account.id, // WICHTIG: Lead gehört zum Greyboard Account
          companyId: company.id,
          source: "Simpalo", // Quelle: Simpalo
          type: "CONTACT",
          status: "NEW",
          priority: "MEDIUM",
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

      console.log("[REGISTER] Lead erstellt im Greyboard Account:", {
        leadId: lead.id,
        leadName: lead.name,
        accountId: lead.accountId,
        greyboardAccountId: greyboardUser.account.id,
      });

      // Erstelle Communication für die Registrierung
      await prisma.communication.create({
        data: {
          leadId: lead.id,
          type: "NOTE",
          direction: "INBOUND",
          subject: "Account-Registrierung",
          content: `Neuer Account wurde registriert.\nFirmenname: ${validatedData.accountName}\nE-Mail: ${validatedData.email}`,
        },
      });
      } else {
        console.warn("[REGISTER] Superadmin Account nicht gefunden - Lead wird nicht erstellt");
      }
    } else {
      console.warn("[REGISTER] SUPERADMIN_EMAIL nicht konfiguriert, überspringe Lead-Erstellung");
    }

    // Sende E-Mail an den neuen User mit Aktivierungs-Link (asynchron, nicht blockierend)
    setImmediate(() => {
      (async () => {
        try {
          // Finde Superadmin-Account
          const superadminEmail = getSuperadminEmail();
          if (!superadminEmail) {
            console.log("SUPERADMIN_EMAIL nicht konfiguriert, keine E-Mail wird gesendet");
            return;
          }
          const greyboardUser = await prisma.user.findUnique({
            where: { email: superadminEmail },
            include: { account: true },
          });

          if (!greyboardUser) {
            console.log("Greyboard-Account nicht gefunden, keine E-Mail wird gesendet");
            return;
          }

          // Lade Account-Einstellungen des Greyboard-Accounts für E-Mail-Vorlage
          const greyboardSettings = await prisma.accountSettings.findUnique({
            where: { accountId: greyboardUser.accountId },
          });

          if (!greyboardSettings) {
            console.log("Greyboard-Settings nicht gefunden, keine E-Mail wird gesendet");
            return;
          }

          const settings = (greyboardSettings.settings as any) || {};
          const activationEmailSettings = settings.activationEmailSettings || {};

          // Prüfe, ob Aktivierungs-E-Mail aktiviert ist
          if (activationEmailSettings.enabled === false) {
            console.log("Aktivierungs-E-Mail ist deaktiviert");
            return;
          }

          if (!activationEmailSettings.subject || !activationEmailSettings.content) {
            console.log("Aktivierungs-E-Mail-Vorlage nicht konfiguriert");
            return;
          }

          // Hole Mailgun-Konfiguration (aus Greyboard-Account oder Environment)
          const mailgunConfig = getMailgunConfig(
            settings.mailgunApiKey || undefined,
            settings.mailgunDomain || undefined,
            settings.mailgunRegion || undefined
          );

          if (!mailgunConfig) {
            console.log("Mailgun nicht konfiguriert, keine E-Mail wird gesendet");
            return;
          }

          // Erstelle Aktivierungs-Token für den Account
          const secret = process.env.NEXTAUTH_SECRET || "";
          const timestamp = Date.now().toString();
          const signature = crypto
            .createHmac("sha256", secret)
            .update(`${account.id}:${timestamp}`)
            .digest("hex");
          const activationToken = `${account.id}:${timestamp}:${signature}`;

          // Erstelle Aktivierungs-Link
          const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const activationLink = `${baseUrl}/api/auth/activate/${activationToken}`;

          // Ersetze Platzhalter in Betreff und Inhalt
          const variables: Record<string, string> = {
            userName: validatedData.name,
            accountName: validatedData.accountName,
            userEmail: validatedData.email,
            activationLink: activationLink,
          };

          const subject = replaceTemplateVariables(activationEmailSettings.subject, variables);
          const content = replaceTemplateVariables(activationEmailSettings.content, variables);

          // Absender-E-Mail
          const fromEmail = activationEmailSettings.senderEmail || process.env.MAILGUN_FROM_EMAIL || "";
          if (!fromEmail) {
            console.log("Absenderadresse (From) ist nicht konfiguriert");
            return;
          }

          // Sende E-Mail via Mailgun
          await sendEmailViaMailgun(mailgunConfig, {
            to: validatedData.email,
            from: fromEmail,
            fromName: activationEmailSettings.senderName || "Simpalo",
            subject: subject,
            html: content.replace(/\n/g, "<br>"),
            text: content,
            replyTo: activationEmailSettings.replyTo || activationEmailSettings.senderEmail || fromEmail,
            metadata: {
              accountId: account.id,
              userId: user.id,
              type: "registration-activation",
            },
          });

          console.log(`Registrierungs-E-Mail erfolgreich gesendet an ${validatedData.email}`);
        } catch (emailError: any) {
          console.error("Error in registration email sending logic:", emailError?.message || emailError);
          // Nicht kritisch - Lead wurde bereits erstellt
        }
      })().catch((error: any) => {
        console.error("Unhandled error in registration email sending:", error?.message || error);
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registrierung erfolgreich",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountId: account.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingaben", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Registrierung" },
      { status: 500 }
    );
  }
}
