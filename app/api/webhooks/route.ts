import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks
 * Ruft alle Webhooks ab
 */
export async function GET(request: NextRequest) {
  try {
    // Authentifizierung prüfen
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;
    const webhooks = await prisma.webhook.findMany({
      where: {
        accountId: accountId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Secret wird zurückgegeben für die Verwaltungsseite
    return NextResponse.json(webhooks);
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Webhooks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks
 * Erstellt einen neuen Webhook
 */
export async function POST(request: NextRequest) {
  try {
    // Authentifizierung prüfen
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;
    const { name, source, url, settings } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Webhook-Name ist erforderlich" },
        { status: 400 }
      );
    }

    if (!source || !source.trim()) {
      return NextResponse.json(
        { error: "Lead-Quelle ist erforderlich" },
        { status: 400 }
      );
    }

    // Generiere eine eindeutige webhookId (ohne Secret erforderlich)
    const webhookId = crypto.randomBytes(16).toString("hex");
    
    // Optional: Secret für zusätzliche Authentifizierung (nicht erforderlich)
    const secret = null; // Kann später optional hinzugefügt werden

    const webhook = await prisma.webhook.create({
      data: {
        name: name.trim(),
        source: source.trim(),
        webhookId: webhookId,
        secret: secret || null,
        url: url || null,
        settings: settings || null,
        isActive: true,
        accountId: accountId,
      },
    });

    // Secret nur beim Erstellen zurückgeben
    return NextResponse.json(webhook, { status: 201 });
  } catch (error: any) {
    console.error("Error creating webhook:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Webhook mit dieser ID existiert bereits" },
        { status: 409 }
      );
    }

    // Detailliertere Fehlermeldung für Debugging
    return NextResponse.json(
      { 
        error: "Fehler beim Erstellen des Webhooks",
        details: error.message || "Unbekannter Fehler",
        code: error.code,
      },
      { status: 500 }
    );
  }
}
