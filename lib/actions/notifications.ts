"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Zod Schema für Notification-Erstellung
const createNotificationSchema = z.object({
  userId: z.string().uuid("Ungültige User-ID"),
  title: z
    .string()
    .min(1, "Titel ist erforderlich")
    .max(200, "Titel ist zu lang")
    .trim(),
  message: z
    .string()
    .min(1, "Nachricht ist erforderlich")
    .max(5000, "Nachricht ist zu lang")
    .trim(),
  type: z.enum([
    "lead",
    "task",
    "campaign",
    "system",
    "email",
    "note",
    "comment",
    "mention",
  ]),
  link: z.string().url().max(500).optional().or(z.literal("")),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}

export interface GetNotificationsResult {
  success: boolean;
  data?: Notification[];
  unreadCount?: number;
  error?: string;
}

/**
 * Holt alle Benachrichtigungen für den aktuell eingeloggten User
 * Sicherheits-Check: User darf nur eigene Notifications sehen
 */
export async function getNotifications(): Promise<GetNotificationsResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Nicht authentifiziert",
      };
    }

    const userId = session.user.id;

    // Sichere Abfrage: Nur eigene Notifications
    const notifications = await prisma.notification.findMany({
      where: {
        userId: userId, // Sicherheits-Check: Nur eigene Notifications
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Begrenze auf die letzten 50
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: userId,
        isRead: false,
      },
    });

    return {
      success: true,
      data: notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        message: n.message,
        type: n.type,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      unreadCount,
    };
  } catch (error) {
    console.error("Error getting notifications:", error);
    return {
      success: false,
      error: "Fehler beim Laden der Benachrichtigungen",
    };
  }
}

/**
 * Markiert eine Benachrichtigung als gelesen
 * Sicherheits-Check: User darf nur eigene Notifications markieren
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Nicht authentifiziert",
      };
    }

    const userId = session.user.id;

    // Prüfe, ob Notification existiert und zum User gehört
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return {
        success: false,
        error: "Benachrichtigung nicht gefunden",
      };
    }

    // Sicherheits-Check: User darf nur eigene Notifications markieren
    if (notification.userId !== userId) {
      return {
        success: false,
        error: "Zugriff verweigert",
      };
    }

    // Markiere als gelesen
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return {
      success: false,
      error: "Fehler beim Markieren der Benachrichtigung",
    };
  }
}

/**
 * Markiert alle Benachrichtigungen des aktuellen Users als gelesen
 * Sicherheits-Check: User kann nur eigene Notifications markieren
 */
export async function markAllNotificationsAsRead() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Nicht authentifiziert",
      };
    }

    const userId = session.user.id;

    // Markiere alle ungelesenen Notifications des Users als gelesen
    await prisma.notification.updateMany({
      where: {
        userId: userId, // Sicherheits-Check: Nur eigene Notifications
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return {
      success: false,
      error: "Fehler beim Markieren aller Benachrichtigungen",
    };
  }
}

/**
 * Erstellt eine neue Benachrichtigung
 * Diese Funktion kann von anderen Server Actions aufgerufen werden
 * Sicherheits-Check: Nur authentifizierte User können Notifications erstellen
 */
export async function createNotification(
  input: unknown
): Promise<{ success: boolean; error?: string; data?: Notification }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Nicht authentifiziert",
      };
    }

    // Strikte Validierung
    const validatedData = createNotificationSchema.parse(input);

    // Sicherheits-Check: User kann nur Notifications für sich selbst oder für andere User im selben Account erstellen
    // Prüfe, ob der Ziel-User im selben Account ist
    const targetUser = await prisma.user.findUnique({
      where: { id: validatedData.userId },
      select: { accountId: true },
    });

    if (!targetUser) {
      return {
        success: false,
        error: "Ziel-User nicht gefunden",
      };
    }

    // Prüfe, ob beide User im selben Account sind
    if (targetUser.accountId !== session.user.accountId) {
      return {
        success: false,
        error: "Zugriff verweigert: User gehört zu einem anderen Account",
      };
    }

    // Erstelle die Notification
    const notification = await prisma.notification.create({
      data: {
        userId: validatedData.userId,
        title: validatedData.title,
        message: validatedData.message,
        type: validatedData.type,
        link: validatedData.link || null,
        isRead: false,
      },
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      data: {
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError?.message || "Ungültige Eingaben",
      };
    }

    console.error("Error creating notification:", error);
    return {
      success: false,
      error: "Fehler beim Erstellen der Benachrichtigung",
    };
  }
}
