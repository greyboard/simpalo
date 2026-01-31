import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/login-logs
 * Ruft Login-Logs ab, filterbar nach Account (nur für Superadmin)
 * Nutzt jetzt Security Events mit LOGIN_SUCCESS und LOGIN_FAILED
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    // Build where clause - nur Login-Events
    const where: any = {
      eventType: {
        in: ["LOGIN_SUCCESS", "LOGIN_FAILED"],
      },
    };
    if (accountId) {
      where.accountId = accountId;
    }

    // Get login events with pagination
    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.securityEvent.count({ where }),
    ]);

    // Transform to match old LoginLog format for backward compatibility
    const logs = events.map((event) => ({
      id: event.id,
      userId: event.userId || "",
      accountId: event.accountId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: String(event.eventType) === "LOGIN_SUCCESS",
      failureReason: String(event.eventType) === "LOGIN_FAILED" ? (event.metadata as any)?.reason || "Unbekannter Fehler" : null,
      createdAt: event.createdAt.toISOString(),
      user: event.user,
      account: event.account,
    }));

    return NextResponse.json({
      items: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error("Error fetching login logs:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Login-Logs" },
      { status: 500 }
    );
  }
}
