import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logSecurityEvent, getClientIp, getUserAgent } from "@/lib/security-events";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

// Zod Schema für Login-Log
const logLoginSchema = z.object({
  success: z.boolean(),
  email: z.string().email().max(255).optional(),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/auth/log-login
 * Speichert einen Login-Log-Eintrag (erfolgreich oder fehlgeschlagen)
 * Wird nach erfolgreichem Login aufgerufen, um IP-Adresse und User-Agent zu erfassen
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Strikte Validierung - NUR validierte Daten verwenden
    const validatedData = logLoginSchema.parse(body);
    const isFailedLogin = validatedData.success === false;

    if (isFailedLogin) {
      // Log failed login attempt - NUR validierte Daten verwenden
      const email = validatedData.email || "unknown";
      const reason = validatedData.reason || "Unknown error";
      
      // Try to find user by email to get accountId
      let accountId: string | null = null;
      let userId: string | null = null;
      
      try {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, accountId: true },
        });
        if (user) {
          accountId = user.accountId;
          userId = user.id;
        }
      } catch (error) {
        // User not found or other error - continue without accountId
        console.error("Error finding user for failed login:", error);
      }

      // If no accountId found, we can't log the event properly
      // This is acceptable for failed logins with invalid emails
      if (accountId) {
        const ipAddress = getClientIp(request);
        const userAgent = getUserAgent(request);
        
        await logSecurityEvent({
          userId: userId || undefined,
          accountId,
          eventType: "LOGIN_FAILED",
          entityType: "User",
          entityId: userId || undefined,
          description: `Fehlgeschlagene Anmeldung: ${email}`,
          metadata: {
            userEmail: email,
            reason: reason,
          },
          ipAddress: ipAddress,
          userAgent: userAgent,
        });
      }

      return NextResponse.json({ success: true });
    }

    // Successful login - update existing login event with IP and User-Agent
    // The login event was already created in the JWT callback, but without IP/User-Agent
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);
    
    // Debug logging
    console.log("[LOG-LOGIN] Extracted IP:", ipAddress);
    console.log("[LOG-LOGIN] Extracted User-Agent:", userAgent);
    console.log("[LOG-LOGIN] Request headers:", {
      "x-forwarded-for": request.headers.get("x-forwarded-for"),
      "x-real-ip": request.headers.get("x-real-ip"),
      "user-agent": request.headers.get("user-agent"),
    });

    // Find the most recent LOGIN_SUCCESS event for this user (created in JWT callback)
    const recentEvent = await prisma.securityEvent.findFirst({
      where: {
        userId: session.user.id,
        eventType: "LOGIN_SUCCESS",
        accountId: session.user.accountId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentEvent) {
      // Update the existing event with IP and User-Agent
      console.log("[LOG-LOGIN] Updating event:", recentEvent.id, "with IP:", ipAddress, "User-Agent:", userAgent);
      await prisma.securityEvent.update({
        where: { id: recentEvent.id },
        data: {
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
      console.log("[LOG-LOGIN] Event updated successfully");
    } else {
      // If no event found, create a new one (fallback)
      console.log("[LOG-LOGIN] No recent event found, creating new one");
      await logSecurityEvent({
        userId: session.user.id,
        accountId: session.user.accountId,
        eventType: "LOGIN_SUCCESS",
        entityType: "User",
        entityId: session.user.id,
        description: `Erfolgreiche Anmeldung: ${session.user.email}`,
        metadata: {
          userEmail: session.user.email,
          userRole: session.user.role,
        },
        ipAddress: ipAddress,
        userAgent: userAgent,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Sichere Fehlerbehandlung - keine Systemdetails preisgeben
      const firstError = error.errors[0];
      return NextResponse.json(
        { error: firstError?.message || "Ungültige Eingaben" },
        { status: 400 }
      );
    }

    console.error("Error logging login:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern des Login-Logs" },
      { status: 500 }
    );
  }
}
