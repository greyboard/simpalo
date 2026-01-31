import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/contact
 * Holt alle offenen "Lead kontaktieren" Tasks für den aktuellen User
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert", data: [] },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;

    // Hole alle offenen "kontaktieren" und "anrufen" Tasks
    const tasks = await prisma.task.findMany({
      where: {
        accountId: accountId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        OR: [
          {
            title: {
              contains: "kontaktieren",
              mode: "insensitive",
            },
          },
          {
            title: {
              contains: "anrufen",
              mode: "insensitive",
            },
          },
        ],
        leadId: { not: null }, // Nur Tasks mit Lead
      },
      include: {
        lead: {
          include: {
            company: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // Konvertiere alle Prisma-Objekte zu plain objects für Serialisierung
    const serializedTasks = tasks
      .filter((task) => task.lead !== null) // Filtere Tasks ohne Lead bereits hier
      .map((task) => ({
        id: task.id,
        leadId: task.leadId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        // Konvertiere Date-Objekte zu ISO-Strings für Serialisierung
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        createdAt: task.createdAt.toISOString(),
        lead: task.lead
          ? {
              id: task.lead.id,
              name: task.lead.name,
              email: task.lead.email,
              phone: task.lead.phone,
              status: task.lead.status,
              source: task.lead.source,
              company: task.lead.company
                ? {
                    id: task.lead.company.id,
                    name: task.lead.company.name,
                  }
                : null,
            }
          : null,
      }));

    return NextResponse.json({
      success: true,
      data: serializedTasks,
    });
  } catch (error) {
    console.error("Error getting contact tasks:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden der Aufgaben", data: [] },
      { status: 500 }
    );
  }
}
