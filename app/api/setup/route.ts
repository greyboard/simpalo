import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase, needsInitialization } from "@/lib/db-init";
import { isSuperadminConfigured } from "@/lib/superadmin";
import { prisma } from "@/lib/prisma";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

/**
 * GET /api/setup
 * Prüft, ob Setup erforderlich ist
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSuperadminConfigured()) {
      return NextResponse.json({
        needsSetup: true,
        message: "SUPERADMIN_EMAIL und SUPERADMIN_PASSWORD müssen in ENV-Variablen gesetzt sein",
      });
    }

    const needsInit = await needsInitialization();
    
    return NextResponse.json({
      needsSetup: needsInit,
      message: needsInit 
        ? "Datenbank muss initialisiert werden" 
        : "Datenbank ist bereits initialisiert",
    });
  } catch (error: any) {
    console.error("[SETUP] Fehler beim Prüfen des Setup-Status:", error);
    return NextResponse.json(
      { 
        needsSetup: true,
        error: error.message || "Fehler beim Prüfen des Setup-Status",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/setup
 * Führt die Datenbank-Initialisierung durch
 */
export async function POST(request: NextRequest) {
  try {
    // Prüfe zuerst, ob Tabellen existieren
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

    if (!tablesExist) {
      // Versuche automatisch Tabellen zu erstellen mit db:push
      try {
        console.log("[SETUP] Tabellen existieren nicht - führe 'prisma db push' aus...");
        execSync("npx prisma db push --accept-data-loss", {
          stdio: "inherit",
          env: process.env,
          cwd: process.cwd(),
        });
        console.log("[SETUP] ✅ Tabellen erfolgreich erstellt");
      } catch (migrateError: any) {
        console.error("[SETUP] Fehler beim Erstellen der Tabellen:", migrateError);
        return NextResponse.json(
          { 
            error: "Tabellen konnten nicht automatisch erstellt werden",
            message: "Bitte führen Sie manuell 'npx prisma db push' oder 'npx prisma migrate deploy' aus",
            needsMigration: true,
            details: migrateError.message,
          },
          { status: 500 }
        );
      }
    }

    if (!isSuperadminConfigured()) {
      return NextResponse.json(
        { 
          error: "SUPERADMIN_EMAIL und SUPERADMIN_PASSWORD müssen in ENV-Variablen gesetzt sein",
        },
        { status: 400 }
      );
    }

    await initializeDatabase();

    return NextResponse.json({
      success: true,
      message: "Datenbank erfolgreich initialisiert",
    });
  } catch (error: any) {
    console.error("[SETUP] Fehler bei der Initialisierung:", error);
    return NextResponse.json(
      { 
        error: error.message || "Fehler bei der Datenbank-Initialisierung",
        details: error.code === "P2021" 
          ? "Tabellen existieren noch nicht. Bitte führen Sie zuerst 'npx prisma migrate deploy' aus."
          : undefined,
      },
      { status: 500 }
    );
  }
}
