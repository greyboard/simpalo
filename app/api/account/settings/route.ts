import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/settings
 * Gibt die Account-Einstellungen zurück
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

    let accountSettings = await prisma.accountSettings.findUnique({
      where: { accountId },
    });

    // Erstelle Settings, falls noch nicht vorhanden
    if (!accountSettings) {
      accountSettings = await prisma.accountSettings.create({
        data: {
          accountId,
          settings: {},
        },
      });
    }

    return NextResponse.json(accountSettings);
  } catch (error) {
    console.error("Error fetching account settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Einstellungen" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/account/settings
 * Aktualisiert die Account-Einstellungen
 * Optional: ?accountId=... für Superadmin (um andere Account-Settings zu aktualisieren)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    // Nur OWNER, ADMIN und SUPERADMIN können Einstellungen ändern
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Superadmin kann andere Account-Settings aktualisieren
    const { searchParams } = new URL(request.url);
    const requestedAccountId = searchParams.get("accountId");
    
    let accountId = session.user.accountId;
    
    if (requestedAccountId && session.user.role === "SUPERADMIN") {
      accountId = requestedAccountId;
    } else if (requestedAccountId && session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    } else if (!session.user.accountId) {
      return NextResponse.json(
        { error: "Account-ID fehlt" },
        { status: 400 }
      );
    }
    const body = await request.json();

    // Hole bestehende Settings
    let accountSettings = await prisma.accountSettings.findUnique({
      where: { accountId },
    });

    const currentSettings = (accountSettings?.settings as any) || {};

    // Starte mit den aktuellen Settings
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
    if (accountSettings) {
      accountSettings = await prisma.accountSettings.update({
        where: { accountId },
        data: {
          settings: updatedSettings,
        },
      });
    } else {
      accountSettings = await prisma.accountSettings.create({
        data: {
          accountId,
          settings: updatedSettings,
        },
      });
    }

    return NextResponse.json(accountSettings);
  } catch (error) {
    console.error("Error updating account settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Einstellungen" },
      { status: 500 }
    );
  }
}
