import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMailgunConfig, checkMailgunDomainVerification, type MailgunConfig } from "@/lib/mailgun";

export const dynamic = "force-dynamic";

/**
 * GET /api/mailgun/domain-status
 * Prüft den Verifizierungsstatus der Mailgun-Domain
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;

    // Lade Account-Einstellungen
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        settings: true,
      },
    });

    if (!account?.settings) {
      return NextResponse.json(
        { error: "Account-Einstellungen nicht gefunden" },
        { status: 404 }
      );
    }

    const settings = (account.settings.settings as any) || {};

    // Prüfe ob Account-spezifische Mailgun-Einstellungen vorhanden sind
    const hasAccountSpecificConfig = settings.mailgunApiKey && settings.mailgunDomain;

    // Hole Mailgun-Config
    // Wenn Account-spezifische Einstellungen vorhanden sind, verwende diese (ohne ENV-Fallback)
    // Sonst verwende ENV-Variablen als Fallback
    let mailgunConfig: MailgunConfig | null;
    
    if (hasAccountSpecificConfig) {
      // Account-spezifische Konfiguration: Verwende nur Account-Einstellungen
      mailgunConfig = {
        apiKey: settings.mailgunApiKey,
        domain: settings.mailgunDomain,
        region: settings.mailgunRegion || "eu",
      };
    } else {
      // Keine Account-spezifische Konfiguration: Verwende ENV-Variablen
      mailgunConfig = getMailgunConfig();
    }

    if (!mailgunConfig || !mailgunConfig.apiKey || !mailgunConfig.domain) {
      return NextResponse.json(
        { error: "Mailgun ist nicht konfiguriert" },
        { status: 400 }
      );
    }

    // Prüfe Domain-Verifizierung
    const status = await checkMailgunDomainVerification(mailgunConfig);

    return NextResponse.json(status);
  } catch (error: any) {
    console.error("Error checking domain status:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Prüfen der Domain-Verifizierung" },
      { status: 500 }
    );
  }
}
