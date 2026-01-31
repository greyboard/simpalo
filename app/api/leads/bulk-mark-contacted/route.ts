import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/leads/bulk-mark-contacted
 * Markiert alle nicht kontaktierten Kontakte (type: CONTACT, status: NEW) als kontaktiert
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;

    // Hole alle Leads, die aktualisiert werden sollen
    const leadsToUpdate = await prisma.lead.findMany({
      where: {
        accountId,
        type: "CONTACT", // Nur Kontakte, keine Unternehmen
        status: "NEW", // Nur neue, nicht kontaktierte Leads
      },
      select: {
        id: true,
      },
    });

    const leadIds = leadsToUpdate.map((lead) => lead.id);

    // Aktualisiere alle nicht kontaktierten Kontakte (nur CONTACT, nicht COMPANY)
    const result = await prisma.lead.updateMany({
      where: {
        accountId,
        type: "CONTACT", // Nur Kontakte, keine Unternehmen
        status: "NEW", // Nur neue, nicht kontaktierte Leads
      },
      data: {
        status: "CONTACTED",
      },
    });

    // Markiere alle "Lead kontaktieren" Tasks für diese Leads als COMPLETED
    if (leadIds.length > 0) {
      try {
        const { completeContactTasksForLead } = await import("@/lib/actions/tasks");
        // Führe für jeden Lead die Task-Completion aus
        await Promise.all(
          leadIds.map((leadId) => completeContactTasksForLead(leadId))
        );
      } catch (taskError) {
        // Fehler beim Abschließen der Tasks sollte Bulk-Update nicht blockieren
        console.error("Error completing contact tasks in bulk:", taskError);
      }
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} Lead(s) wurden als kontaktiert markiert`,
    });
  } catch (error: any) {
    console.error("Error marking leads as contacted:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Markieren der Leads" },
      { status: 500 }
    );
  }
}
