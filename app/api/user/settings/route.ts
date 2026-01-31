import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/settings
 * Gibt die User Settings zurück
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json(userSettings || { settings: {} });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Einstellungen" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/settings
 * Aktualisiert die User Settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Hole bestehende Settings
    let userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    const currentSettings = (userSettings?.settings as any) || {};
    const updatedSettings = { ...currentSettings };

    // Verarbeite jedes Feld im Body
    Object.keys(body).forEach((key) => {
      const value = body[key];
      
      // Wenn der Wert undefined, null oder leerer String ist, entferne den Key
      if (value === undefined || value === null || value === "") {
        delete updatedSettings[key];
      } else {
        // Andernfalls setze den neuen Wert
        updatedSettings[key] = value;
      }
    });

    // Aktualisiere oder erstelle Settings
    if (userSettings) {
      userSettings = await prisma.userSettings.update({
        where: { userId: session.user.id },
        data: {
          settings: updatedSettings,
        },
      });
    } else {
      userSettings = await prisma.userSettings.create({
        data: {
          userId: session.user.id,
          settings: updatedSettings,
        },
      });
    }

    return NextResponse.json(userSettings);
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Einstellungen" },
      { status: 500 }
    );
  }
}
