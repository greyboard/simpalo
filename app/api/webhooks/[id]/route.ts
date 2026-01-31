import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logSecurityEvent, getClientIp, getUserAgent } from "@/lib/security-events";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/[id]
 * Ruft einen einzelnen Webhook ab
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: params.id },
    });

    if (!webhook) {
      return NextResponse.json(
        { error: "Webhook nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(webhook);
  } catch (error) {
    console.error("Error fetching webhook:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen des Webhooks" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/webhooks/[id]
 * Aktualisiert einen Webhook
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Secret sollte nicht über PUT aktualisiert werden können
    const { secret, ...updateData } = body;

    const webhook = await prisma.webhook.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(webhook);
  } catch (error: any) {
    console.error("Error updating webhook:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Webhook nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Webhooks" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/[id]
 * Löscht einen Webhook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Hole Webhook-Informationen vor dem Löschen
    const existingWebhook = await prisma.webhook.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        accountId: true,
      },
    });

    if (!existingWebhook) {
      return NextResponse.json(
        { error: "Webhook nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.webhook.delete({
      where: { id: params.id },
    });

    // Log Security Event (nicht-blockierend)
    if (session?.user) {
      logSecurityEvent({
        userId: session.user.id,
        accountId: existingWebhook.accountId,
        eventType: "WEBHOOK_DELETED",
        entityType: "Webhook",
        entityId: params.id,
        description: `Webhook gelöscht: ${existingWebhook.name || params.id}`,
        metadata: {
          webhookName: existingWebhook.name,
        },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      }).catch((err) => console.error("Error logging security event:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting webhook:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Webhook nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Löschen des Webhooks" },
      { status: 500 }
    );
  }
}
