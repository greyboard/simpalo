import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/mailgun
 * Receives Mailgun webhook events (delivered, opened, clicked, bounced, etc.)
 * Updates communication status in database
 */
export async function POST(request: NextRequest) {
  try {
    // Log immediately when request is received
    console.log("=== Mailgun webhook: Request received ===");
    console.log("URL:", request.url);
    console.log("Method:", request.method);
    console.log("Headers:", Object.fromEntries(request.headers.entries()));
    
    const contentType = request.headers.get("content-type") || "";
    console.log("Mailgun webhook: Content-Type:", contentType);
    
    let body: any = {};

    // According to Mailgun docs: https://codehooks.io/docs/examples/webhooks/mailgun
    // Mailgun sends webhooks as JSON with nested structure: { signature: {...}, "event-data": {...} }
    // Can also be sent as application/x-www-form-urlencoded (legacy format)
    // Sometimes Mailgun sends JSON as a string in form-data, so we need to handle both cases
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      // Legacy format: URL-encoded form data
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
      
      // If body contains a single key with a JSON string value, parse it
      const keys = Object.keys(body);
      if (keys.length === 1 && typeof body[keys[0]] === "string") {
        try {
          const parsed = JSON.parse(body[keys[0]]);
          body = parsed;
        } catch {
          // Not JSON, keep as is
        }
      }
    } else {
      // Try JSON first (most common format)
      try {
        body = await request.json();
      } catch {
        // Fallback to form data
        const formData = await request.formData();
        body = Object.fromEntries(formData.entries());
        
        // If body contains a single key with a JSON string value, parse it
        const keys = Object.keys(body);
        if (keys.length === 1 && typeof body[keys[0]] === "string") {
          try {
            const parsed = JSON.parse(body[keys[0]]);
            body = parsed;
          } catch {
            // Not JSON, keep as is
          }
        }
      }
    }

    console.log("Mailgun webhook: Raw body keys:", Object.keys(body));
    console.log("Mailgun webhook: Body type:", typeof body);

    // Mailgun uses nested structure: { signature: {...}, "event-data": {...} }
    // Extract event data from nested structure or use body directly (legacy format)
    const eventData: any = body["event-data"] || body;
    const signature = body.signature || {};

    const eventType = eventData.event || eventData["event"];
    // Message ID is in eventData.message?.headers?.["message-id"] for new format
    const messageId = 
      eventData.message?.headers?.["message-id"] || 
      eventData.message?.headers?.["Message-Id"] ||
      eventData["message-id"] || 
      eventData["Message-Id"] || 
      eventData.messageId || 
      eventData["messageId"];
    const recipient = eventData.recipient || "";
    const timestamp = eventData.timestamp || signature.timestamp || "";

    console.log("Mailgun webhook received:", { eventType, messageId, recipient, timestamp });

    // For test webhooks from Mailgun, we might not have a messageId
    // In that case, we should return success without updating anything
    if (!eventType) {
      console.error("Mailgun webhook missing event type:", { body, eventData });
      return NextResponse.json(
        { error: "Missing required field: event" },
        { status: 400 }
      );
    }

    // If no messageId, this might be a test webhook - return success
    if (!messageId) {
      console.log("Mailgun webhook: No messageId found, treating as test webhook");
      return NextResponse.json({ received: true, test: true });
    }

    // Normalize message ID - Mailgun might send it in different formats
    // Remove angle brackets if present (e.g., <message-id@domain.com> -> message-id@domain.com)
    const normalizedMessageId = messageId.replace(/^<|>$/g, "");
    // Also create version with angle brackets for matching
    const messageIdWithBrackets = `<${normalizedMessageId}>`;

    console.log("Mailgun webhook: Searching for communication with messageId:", normalizedMessageId);
    console.log("Mailgun webhook: Original messageId:", messageId);
    console.log("Mailgun webhook: MessageId with brackets:", messageIdWithBrackets);

    // Find communication by Mailgun message ID
    // Try multiple formats: normalized (without brackets), with brackets, and original
    let communication = await prisma.communication.findFirst({
      where: {
        OR: [
          { mailgunId: normalizedMessageId },
          { mailgunId: messageIdWithBrackets },
          { mailgunId: messageId },
        ],
        type: "EMAIL",
        direction: "OUTBOUND",
      },
      include: {
        lead: true,
      },
    });

    // If still not found, try to find by partial match (in case of format differences)
    if (!communication) {
      // Log all communications with mailgunId for debugging
      const allCommunications = await prisma.communication.findMany({
        where: {
          type: "EMAIL",
          direction: "OUTBOUND",
          mailgunId: { not: null },
        },
        select: {
          id: true,
          mailgunId: true,
          createdAt: true,
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
      console.log("Mailgun webhook: Recent communications with mailgunId:", allCommunications);
    }

    if (!communication) {
      // Message ID not found - might be from different account or not tracked
      console.log("Mailgun webhook: Communication not found for messageId:", normalizedMessageId);
      console.log("Mailgun webhook: Full event data:", JSON.stringify(eventData, null, 2));
      // Return 200 to acknowledge receipt
      return NextResponse.json({ received: true });
    }

    console.log("Mailgun webhook: Found communication:", { communicationId: communication.id, currentStatus: communication.status, eventType });

    // Update communication status based on event type
    let newStatus = communication.status;
    const metadata = (communication.metadata as any) || {};

    switch (eventType) {
      case "delivered":
        newStatus = "delivered";
        metadata.deliveredAt = timestamp
          ? new Date(parseInt(timestamp) * 1000).toISOString()
          : new Date().toISOString();
        break;

      case "opened":
        newStatus = "opened";
        metadata.openedAt =
          metadata.openedAt ||
          (timestamp
            ? new Date(parseInt(timestamp) * 1000).toISOString()
            : new Date().toISOString());
        metadata.openedCount = (metadata.openedCount || 0) + 1;
        break;

      case "clicked":
        newStatus = "clicked";
        metadata.clickedAt =
          metadata.clickedAt ||
          (timestamp
            ? new Date(parseInt(timestamp) * 1000).toISOString()
            : new Date().toISOString());
        metadata.clickedCount = (metadata.clickedCount || 0) + 1;
        metadata.clickedUrl = eventData.url || eventData["url"] || metadata.clickedUrl;
        break;

      case "bounced":
      case "permanent_fail":
        newStatus = "bounced";
        metadata.bouncedAt = timestamp
          ? new Date(parseInt(timestamp) * 1000).toISOString()
          : new Date().toISOString();
        metadata.bounceCode = eventData.code || eventData["bounce-code"] || "";
        metadata.bounceReason = eventData.reason || eventData["bounce-reason"] || "";
        break;

      case "failed":
      case "temporary_fail":
        newStatus = "failed";
        metadata.failedAt = timestamp
          ? new Date(parseInt(timestamp) * 1000).toISOString()
          : new Date().toISOString();
        metadata.failureReason = eventData.reason || eventData["failure-reason"] || "";
        break;

      case "complained":
        newStatus = "complained";
        metadata.complainedAt = timestamp
          ? new Date(parseInt(timestamp) * 1000).toISOString()
          : new Date().toISOString();
        break;

      case "unsubscribed":
        newStatus = "unsubscribed";
        metadata.unsubscribedAt = timestamp
          ? new Date(parseInt(timestamp) * 1000).toISOString()
          : new Date().toISOString();
        break;

      default:
        // Unknown event type - log but don't update
        console.log("Unknown Mailgun event type:", eventType);
        return NextResponse.json({ received: true });
    }

    // Update communication record
    await prisma.communication.update({
      where: { id: communication.id },
      data: {
        status: newStatus,
        metadata: metadata,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing Mailgun webhook:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause,
    });
    return NextResponse.json(
      { 
        error: "Error processing webhook",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/mailgun
 * Mailgun webhook verification (sometimes used)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "ok" });
}
