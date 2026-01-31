import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

/**
 * POST /api/setup/migrate
 * Erstellt automatisch die Datenbank-Tabellen mit prisma db push
 * 
 * WICHTIG: Diese Route sollte nur einmal aufgerufen werden, wenn keine Tabellen existieren.
 * In Production sollte stattdessen 'npx prisma migrate deploy' verwendet werden.
 */
export async function POST(request: NextRequest) {
  try {
    // Prüfe, ob Tabellen bereits existieren
    let tablesExist = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Account" LIMIT 1`;
      tablesExist = true;
    } catch (tableError: any) {
      if (tableError.code === "P2021" || tableError.message?.includes("does not exist")) {
        tablesExist = false;
      } else {
        throw tableError;
      }
    }

    if (tablesExist) {
      return NextResponse.json({
        success: true,
        message: "Tabellen existieren bereits",
        tablesExist: true,
      });
    }

    // Versuche Tabellen zu erstellen
    try {
      console.log("[SETUP-MIGRATE] Erstelle Tabellen mit 'prisma db push'...");
      
      execSync("npx prisma db push --accept-data-loss", {
        stdio: "pipe",
        env: process.env,
        cwd: process.cwd(),
      });

      console.log("[SETUP-MIGRATE] ✅ Tabellen erfolgreich erstellt");

      return NextResponse.json({
        success: true,
        message: "Tabellen erfolgreich erstellt",
        tablesCreated: true,
      });
    } catch (migrateError: any) {
      console.error("[SETUP-MIGRATE] Fehler beim Erstellen der Tabellen:", migrateError);
      
      return NextResponse.json(
        {
          error: "Fehler beim Erstellen der Tabellen",
          message: migrateError.message || "Unbekannter Fehler",
          details: "Bitte führen Sie manuell 'npx prisma db push' oder 'npx prisma migrate deploy' aus",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[SETUP-MIGRATE] Fehler:", error);
    return NextResponse.json(
      {
        error: error.message || "Fehler bei der Migration",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/setup/migrate
 * Prüft, ob Tabellen existieren
 */
export async function GET(request: NextRequest) {
  try {
    let tablesExist = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Account" LIMIT 1`;
      tablesExist = true;
    } catch (tableError: any) {
      if (tableError.code === "P2021" || tableError.message?.includes("does not exist")) {
        tablesExist = false;
      } else {
        throw tableError;
      }
    }

    return NextResponse.json({
      tablesExist,
      message: tablesExist
        ? "Tabellen existieren bereits"
        : "Tabellen existieren noch nicht - rufen Sie POST /api/setup/migrate auf",
    });
  } catch (error: any) {
    console.error("[SETUP-MIGRATE] Fehler beim Prüfen:", error);
    return NextResponse.json(
      {
        error: error.message || "Fehler beim Prüfen der Tabellen",
      },
      { status: 500 }
    );
  }
}
