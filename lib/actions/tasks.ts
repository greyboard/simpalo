"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Erstellt automatisch eine Task "Lead kontaktieren" für einen neuen Lead
 * Wird aufgerufen, wenn ein Lead mit Status NEW erstellt wird
 * Kann auch ohne Session aufgerufen werden (z.B. bei Webhooks)
 */
export async function createContactTaskForLead(leadId: string) {
  try {
    // Prüfe, ob Lead existiert
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        account: true,
      },
    });

    if (!lead) {
      return { success: false, error: "Lead nicht gefunden" };
    }

    const accountId = lead.accountId;

    // Prüfe, ob bereits eine Task für diesen Lead existiert
    const existingTask = await prisma.task.findFirst({
      where: {
        leadId: leadId,
        accountId: accountId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        title: {
          contains: "kontaktieren",
          mode: "insensitive",
        },
      },
    });

    if (existingTask) {
      // Task existiert bereits
      return { success: true, taskId: existingTask.id };
    }

    // Erstelle Task nur wenn Lead Status NEW ist
    if (lead.status === "NEW") {
      const task = await prisma.task.create({
        data: {
          leadId: leadId,
          accountId: accountId,
          title: `${lead.name} kontaktieren`,
          description: `Kontaktiere ${lead.name}${lead.email ? ` (${lead.email})` : lead.phone ? ` (${lead.phone})` : ""}`,
          status: "PENDING",
          priority: "MEDIUM",
        },
      });

      revalidatePath("/dashboard");
      return { success: true, taskId: task.id };
    }

    return { success: true };
  } catch (error) {
    console.error("Error creating contact task:", error);
    return { success: false, error: "Fehler beim Erstellen der Aufgabe" };
  }
}

/**
 * Markiert alle "Lead kontaktieren" Tasks als COMPLETED, wenn ein Lead kontaktiert wurde
 * Wird aufgerufen, wenn ein Lead Status von NEW zu CONTACTED ändert
 * Kann auch ohne Session aufgerufen werden (z.B. bei automatischen Updates)
 */
export async function completeContactTasksForLead(leadId: string) {
  try {
    // Prüfe, ob Lead existiert
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return { success: false, error: "Lead nicht gefunden" };
    }

    const accountId = lead.accountId;

    // Markiere alle offenen "kontaktieren" Tasks für diesen Lead als COMPLETED
    const result = await prisma.task.updateMany({
      where: {
        leadId: leadId,
        accountId: accountId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        title: {
          contains: "kontaktieren",
          mode: "insensitive",
        },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    if (result.count > 0) {
      revalidatePath("/dashboard");
    }

    return { success: true, completedCount: result.count };
  } catch (error) {
    console.error("Error completing contact tasks:", error);
    return { success: false, error: "Fehler beim Abschließen der Aufgaben" };
  }
}

/**
 * Prüft, ob ein Lead offene Tasks hat
 */
export async function hasOpenTasks(leadId: string): Promise<boolean> {
  try {
    const openTasks = await prisma.task.findFirst({
      where: {
        leadId: leadId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    return !!openTasks;
  } catch (error) {
    console.error("Error checking open tasks:", error);
    return false;
  }
}

/**
 * Holt alle offenen "Lead kontaktieren" Tasks für den aktuellen User
 */
export async function getContactTasks() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return { success: false, error: "Nicht authentifiziert", data: [] };
    }

    const accountId = session.user.accountId;

    // Hole alle offenen "kontaktieren" Tasks
    // WICHTIG: leadId muss nicht null sein, damit Tasks mit Lead angezeigt werden
    const tasks = await prisma.task.findMany({
      where: {
        accountId: accountId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        title: {
          contains: "kontaktieren",
          mode: "insensitive",
        },
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

    // Debug: Log Anzahl gefundener Tasks
    console.log(`[getContactTasks] Found ${tasks.length} tasks for account ${accountId}`);
    if (tasks.length > 0) {
      console.log(`[getContactTasks] Sample task:`, {
        id: tasks[0].id,
        title: tasks[0].title,
        status: tasks[0].status,
        hasLead: !!tasks[0].lead,
        leadId: tasks[0].leadId,
      });
    }

    // Konvertiere alle Prisma-Objekte zu plain objects für Server Action Serialisierung
    // WICHTIG: Alle Date-Objekte müssen zu Strings konvertiert werden
    const serializedTasks = tasks
      .filter((task) => task.lead !== null) // Filtere Tasks ohne Lead bereits hier
      .map((task) => {
        // Erstelle plain object - alle Werte müssen serialisierbar sein
        const plainTask = {
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
        };
        
        // Verwende JSON.parse(JSON.stringify()) um sicherzustellen, dass alle Objekte serialisierbar sind
        // Dies entfernt alle nicht-serialisierbaren Eigenschaften
        return JSON.parse(JSON.stringify(plainTask));
      });

    return {
      success: true,
      data: serializedTasks,
    };
  } catch (error) {
    console.error("Error getting contact tasks:", error);
    return { success: false, error: "Fehler beim Laden der Aufgaben", data: [] };
  }
}

/**
 * Erstellt eine Task "Kontakt anrufen" für einen Lead
 * Wird aufgerufen, wenn ein Anruf nicht erreicht wurde
 */
export async function createCallTaskForLead(leadId: string) {
  try {
    // Prüfe, ob Lead existiert
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        account: true,
      },
    });

    if (!lead) {
      return { success: false, error: "Lead nicht gefunden" };
    }

    const accountId = lead.accountId;

    // Zähle alle bisherigen "anrufen" Tasks für diesen Lead (inklusive abgeschlossene)
    const allCallTasks = await prisma.task.findMany({
      where: {
        leadId: leadId,
        accountId: accountId,
        title: {
          contains: "anrufen",
          mode: "insensitive",
        },
      },
    });

    const attemptCount = allCallTasks.length + 1; // +1 für die gerade erstellte Task

    // Wenn bereits 3 Versuche vorhanden sind, markiere als "Nicht erreichbar" und schließe alle Tasks ab
    if (attemptCount >= 3) {
      // Erstelle oder finde Tag "Nicht erreichbar"
      const tag = await prisma.tag.upsert({
        where: {
          accountId_name: {
            accountId: accountId,
            name: "Nicht erreichbar",
          },
        },
        update: {},
        create: {
          name: "Nicht erreichbar",
          color: "#EF4444",
          accountId: accountId,
        },
      });

      // Prüfe, ob Tag bereits zugeordnet ist
      const existingLeadTag = await prisma.leadTag.findUnique({
        where: {
          leadId_tagId: {
            leadId: leadId,
            tagId: tag.id,
          },
        },
      });

      if (!existingLeadTag) {
        // Füge Tag zu Lead hinzu
        await prisma.leadTag.create({
          data: {
            leadId: leadId,
            tagId: tag.id,
          },
        });
      }

      // Markiere alle offenen Tasks für diesen Lead als COMPLETED
      await prisma.task.updateMany({
        where: {
          leadId: leadId,
          accountId: accountId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/leads/${leadId}`);
      return { success: true, attemptCount, isThirdAttempt: true, taskCompleted: true };
    }

    // Prüfe, ob bereits eine offene "anrufen" Task für diesen Lead existiert
    const existingTask = await prisma.task.findFirst({
      where: {
        leadId: leadId,
        accountId: accountId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        title: {
          contains: "anrufen",
          mode: "insensitive",
        },
      },
    });

    if (existingTask) {
      // Task existiert bereits
      return { success: true, taskId: existingTask.id, attemptCount };
    }

    // Erstelle Task
    const task = await prisma.task.create({
      data: {
        leadId: leadId,
        accountId: accountId,
        title: `${lead.name} anrufen`,
        description: `Kontakt ${lead.name}${lead.phone ? ` unter ${lead.phone}` : ""} anrufen (Versuch ${attemptCount})`,
        status: "PENDING",
        priority: "MEDIUM",
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/leads/${leadId}`);
    return { success: true, taskId: task.id, attemptCount, isThirdAttempt: false };
  } catch (error) {
    console.error("Error creating call task:", error);
    return { success: false, error: "Fehler beim Erstellen der Aufgabe" };
  }
}

/**
 * Markiert alle offenen Tasks (kontaktieren und anrufen) für einen Lead als COMPLETED
 * Wird aufgerufen, wenn ein Kontakt erreicht wurde
 */
export async function completeAllTasksForLead(leadId: string) {
  try {
    // Prüfe, ob Lead existiert
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return { success: false, error: "Lead nicht gefunden" };
    }

    const accountId = lead.accountId;

    // Markiere alle offenen Tasks für diesen Lead als COMPLETED
    const result = await prisma.task.updateMany({
      where: {
        leadId: leadId,
        accountId: accountId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    if (result.count > 0) {
      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/leads/${leadId}`);
    }

    return { success: true, completedCount: result.count };
  } catch (error) {
    console.error("Error completing tasks:", error);
    return { success: false, error: "Fehler beim Abschließen der Aufgaben" };
  }
}

/**
 * Löscht alle "anrufen" Tasks für einen Lead (setzt Zähler auf 0 zurück)
 * Wird aufgerufen, wenn ein Anruf erfolgreich war
 * Entfernt auch den Tag "Nicht erreichbar", falls vorhanden
 */
export async function resetCallTaskCounter(leadId: string) {
  try {
    // Prüfe, ob Lead existiert
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return { success: false, error: "Lead nicht gefunden" };
    }

    const accountId = lead.accountId;

    // Lösche alle "anrufen" Tasks für diesen Lead (inklusive abgeschlossene)
    const result = await prisma.task.deleteMany({
      where: {
        leadId: leadId,
        accountId: accountId,
        title: {
          contains: "anrufen",
          mode: "insensitive",
        },
      },
    });

    // NOTE: Call-Logging (inkl. Notiz) wird bewusst unter /api/leads/[id]/communications gespeichert,
    // damit es im Bereich "Kommunikation" erscheint und lead.updatedAt aktualisiert wird.

    // Finde Tag "Nicht erreichbar" für diesen Account
    const tag = await prisma.tag.findFirst({
      where: {
        accountId: accountId,
        name: "Nicht erreichbar",
      },
    });

    if (tag) {
      // Prüfe, ob Tag diesem Lead zugeordnet ist und entferne ihn
      const leadTag = await prisma.leadTag.findUnique({
        where: {
          leadId_tagId: {
            leadId: leadId,
            tagId: tag.id,
          },
        },
      });

      if (leadTag) {
        await prisma.leadTag.delete({
          where: {
            leadId_tagId: {
              leadId: leadId,
              tagId: tag.id,
            },
          },
        });
      }
    }

    if (result.count > 0) {
      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/leads/${leadId}`);
    }

    return { success: true, deletedCount: result.count };
  } catch (error) {
    console.error("Error resetting call task counter:", error);
    return { success: false, error: "Fehler beim Zurücksetzen des Zählers" };
  }
}
