import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getMailgunConfig, checkMailgunDomainVerification } from "@/lib/mailgun";

export const dynamic = "force-dynamic";

/**
 * GET /api/mailgun/domain-status-global
 * Prüft den Verifizierungsstatus der globalen Mailgun-Domain (aus ENV-Variablen)
 * Nur für Superadmins verfügbar
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    // Für alle authentifizierten User verfügbar (Self-Hosting)

    // Hole Mailgun-Config aus ENV-Variablen
    const mailgunConfig = getMailgunConfig(
      process.env.MAILGUN_API_KEY,
      process.env.MAILGUN_DOMAIN,
      process.env.MAILGUN_REGION as "us" | "eu" | undefined
    );

    if (!mailgunConfig) {
      return NextResponse.json(
        { error: "Mailgun ist nicht in den ENV-Variablen konfiguriert" },
        { status: 400 }
      );
    }

    // Prüfe Domain-Verifizierung
    const status = await checkMailgunDomainVerification(mailgunConfig);

    return NextResponse.json(status);
  } catch (error: any) {
    console.error("Error checking global domain status:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Prüfen der Domain-Verifizierung" },
      { status: 500 }
    );
  }
}
