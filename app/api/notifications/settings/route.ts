import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// Zod Schema für Notification-Einstellungen
const notificationSettingsSchema = z.object({
  leadCreated: z.boolean().optional(),
  leadUpdated: z.boolean().optional(),
  taskAssigned: z.boolean().optional(),
  taskCompleted: z.boolean().optional(),
  campaignStarted: z.boolean().optional(),
  campaignCompleted: z.boolean().optional(),
  emailReceived: z.boolean().optional(),
  commentMentioned: z.boolean().optional(),
  systemUpdates: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Hole UserSettings
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    const settings = (userSettings?.settings as any) || {};
    const notificationSettings = settings.notificationSettings || {};

    return NextResponse.json({
      settings: {
        leadCreated: notificationSettings.leadCreated ?? true,
        leadUpdated: notificationSettings.leadUpdated ?? true,
        taskAssigned: notificationSettings.taskAssigned ?? true,
        taskCompleted: notificationSettings.taskCompleted ?? true,
        campaignStarted: notificationSettings.campaignStarted ?? true,
        campaignCompleted: notificationSettings.campaignCompleted ?? true,
        emailReceived: notificationSettings.emailReceived ?? true,
        commentMentioned: notificationSettings.commentMentioned ?? true,
        systemUpdates: notificationSettings.systemUpdates ?? true,
      },
    });
  } catch (error) {
    console.error("Error getting notification settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Einstellungen" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    // Strikte Validierung
    const validatedData = notificationSettingsSchema.parse(body.settings || {});

    // Hole UserSettings
    let userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    const currentSettings = (userSettings?.settings as any) || {};

    // Aktualisiere Notification-Einstellungen
    if (!userSettings) {
      // Erstelle UserSettings, falls nicht vorhanden
      userSettings = await prisma.userSettings.create({
        data: {
          userId,
          settings: {
            ...currentSettings,
            notificationSettings: validatedData,
          },
        },
      });
    } else {
      // Aktualisiere bestehende UserSettings
      userSettings = await prisma.userSettings.update({
        where: { userId },
        data: {
          settings: {
            ...currentSettings,
            notificationSettings: validatedData,
          },
        },
      });
    }

    revalidatePath("/settings/notifications");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return NextResponse.json(
        { error: firstError?.message || "Ungültige Eingaben" },
        { status: 400 }
      );
    }

    console.error("Error updating notification settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Einstellungen" },
      { status: 500 }
    );
  }
}
