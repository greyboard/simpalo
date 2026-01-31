import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/security-events
 * Ruft Security Events für den eigenen Account ab (für alle authentifizierten User)
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
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get("eventType") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    // Build where clause - nur Events für den eigenen Account
    const where: any = {
      accountId: accountId,
    };
    if (eventType) {
      where.eventType = eventType;
    }

    // Get security events with pagination
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

    return NextResponse.json({
      items: events,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error("Error fetching security events:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Security Events" },
      { status: 500 }
    );
  }
}
