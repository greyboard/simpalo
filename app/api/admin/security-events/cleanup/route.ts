import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/security-events/cleanup
 * Löscht Security Events, die älter als die angegebene Anzahl von Tagen sind (nur für Superadmin)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

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
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    // Lösche alte Events
    const result = await prisma.securityEvent.deleteMany({
      where: {
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
 * GET /api/admin/security-events/cleanup
 * Gibt Statistiken über alte Security Events zurück (nur für Superadmin)
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
    const daysToCheck = parseInt(searchParams.get("days") || "30", 10);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToCheck);

    // Zähle Events, die gelöscht werden würden
    const [totalEvents, eventsToDelete, eventsToKeep] = await Promise.all([
      prisma.securityEvent.count(),
      prisma.securityEvent.count({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      }),
      prisma.securityEvent.count({
        where: {
          createdAt: {
            gte: cutoffDate,
          },
        },
      }),
    ]);

    // Schätzung des Speicherplatzbedarfs pro Event (ca. 500-1000 Bytes)
    // id: ~25 bytes, userId: ~25 bytes, accountId: ~25 bytes, eventType: ~20 bytes
    // description: ~100 bytes, metadata: ~200 bytes, ipAddress: ~50 bytes, userAgent: ~200 bytes
    // createdAt: ~8 bytes, Indizes: ~50 bytes
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
