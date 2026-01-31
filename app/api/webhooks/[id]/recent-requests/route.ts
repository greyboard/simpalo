import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/[id]/recent-requests
 * Ruft die letzten eingehenden Webhook-Requests aus der Datenbank ab
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

    // Hole die letzten Requests für diesen Webhook aus der Datenbank
    const logs = await prisma.webhookLog.findMany({
      where: { webhookId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Konvertiere zu dem Format, das die UI erwartet
    const recentRequests = logs.map((log) => ({
      id: log.id,
      webhookId: log.webhookId,
      timestamp: log.createdAt,
      payload: log.payload,
      success: log.success,
      error: log.error || undefined,
      leadId: log.leadId || undefined,
    }));

    return NextResponse.json({
      webhookId: params.id,
      requests: recentRequests,
      count: recentRequests.length,
    });
  } catch (error) {
    console.error("Error fetching recent webhook requests:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Webhook-Requests" },
      { status: 500 }
    );
  }
}
