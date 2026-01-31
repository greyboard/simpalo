import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * DELETE /api/security-events/cleanup
 * Löscht Security Events für den eigenen Account, die älter als die angegebene Anzahl von Tagen sind
 */
export async function DELETE(request: NextRequest) {
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
    const daysToKeep = parseInt(searchParams.get("days") || "30", 10);
    
    if (daysToKeep < 1 || daysToKeep > 365) {
      return NextResponse.json(
        { error: "Ungültige Anzahl von Tagen (1-365)" },
        { status: 400 }
      );
    }

    // Berechne das Datum, vor dem Events gelöscht werden sollen
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Zähle zuerst, wie viele Events gelöscht werden
    const countToDelete = await prisma.securityEvent.count({
      where: {
        accountId: accountId,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    // Lösche alte Events für den eigenen Account
    const result = await prisma.securityEvent.deleteMany({
      where: {
        accountId: accountId,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      estimatedCount: countToDelete,
      cutoffDate: cutoffDate.toISOString(),
      message: `${result.count} Security Events älter als ${daysToKeep} Tage wurden gelöscht`,
    });
  } catch (error: any) {
    console.error("Error cleaning up security events:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Security Events" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/security-events/cleanup
 * Gibt Statistiken über alte Security Events für den eigenen Account zurück
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
    const daysToCheck = parseInt(searchParams.get("days") || "30", 10);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToCheck);

    // Zähle Events für den eigenen Account
    const [totalEvents, eventsToDelete, eventsToKeep] = await Promise.all([
      prisma.securityEvent.count({
        where: { accountId: accountId },
      }),
      prisma.securityEvent.count({
        where: {
          accountId: accountId,
          createdAt: {
            lt: cutoffDate,
          },
        },
      }),
      prisma.securityEvent.count({
        where: {
          accountId: accountId,
          createdAt: {
            gte: cutoffDate,
          },
        },
      }),
    ]);

    // Schätzung des Speicherplatzbedarfs pro Event (ca. 500-1000 Bytes)
    const estimatedBytesPerEvent = 700;
    const estimatedTotalSizeMB = (totalEvents * estimatedBytesPerEvent) / (1024 * 1024);
    const estimatedSizeToDeleteMB = (eventsToDelete * estimatedBytesPerEvent) / (1024 * 1024);
    const estimatedSizeToKeepMB = (eventsToKeep * estimatedBytesPerEvent) / (1024 * 1024);

    return NextResponse.json({
      totalEvents,
      eventsToDelete,
      eventsToKeep,
      cutoffDate: cutoffDate.toISOString(),
      daysToCheck,
      estimatedSize: {
        totalMB: estimatedTotalSizeMB.toFixed(2),
        toDeleteMB: estimatedSizeToDeleteMB.toFixed(2),
        toKeepMB: estimatedSizeToKeepMB.toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("Error getting security events stats:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Statistiken" },
      { status: 500 }
    );
  }
}
