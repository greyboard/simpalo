/**
 * Database Initialization
 * 
 * Diese Funktion initialisiert die Datenbank beim ersten Start:
 * - Prüft, ob Tabellen existieren
 * - Erstellt Superadmin, falls nicht vorhanden
 */

import { prisma } from "./prisma";
import { getSuperadminEmail, getSuperadminPassword, isSuperadminConfigured } from "./superadmin";
import bcrypt from "bcryptjs";
import { execSync } from "child_process";

let initializationChecked = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialisiert die Datenbank beim ersten Start
 * Diese Funktion ist idempotent - kann mehrfach aufgerufen werden
 */
export async function initializeDatabase(): Promise<void> {
  // Verhindere mehrfache gleichzeitige Initialisierungen
  if (initializationChecked) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Prüfe zuerst, ob Tabellen existieren
      let tablesExist = false;
      try {
        await prisma.$queryRaw`SELECT 1 FROM "Account" LIMIT 1`;
        tablesExist = true;
      } catch (tableError: any) {
        if (tableError.code === "P2021" || tableError.message?.includes("does not exist")) {
          tablesExist = false;
          // Versuche automatisch Tabellen zu erstellen
          try {
            console.log("[DB-INIT] Tabellen existieren nicht - führe 'prisma db push' aus...");
            execSync("npx prisma db push --accept-data-loss", {
              stdio: "pipe",
              env: process.env,
              cwd: process.cwd(),
            });
            console.log("[DB-INIT] ✅ Tabellen erfolgreich erstellt");
            tablesExist = true;
          } catch (pushError: any) {
            console.error("[DB-INIT] Fehler beim Erstellen der Tabellen:", pushError.message);
            console.log("[DB-INIT] Hinweis: Bitte führen Sie manuell 'npx prisma db push' oder 'npx prisma migrate deploy' aus");
            initializationChecked = true;
            return;
          }
        } else {
          throw tableError;
        }
      }

      // Prüfe, ob Superadmin konfiguriert ist
      if (!isSuperadminConfigured()) {
        console.log("[DB-INIT] SUPERADMIN_EMAIL oder SUPERADMIN_PASSWORD nicht konfiguriert, überspringe Initialisierung");
        initializationChecked = true;
        return;
      }

      const superadminEmail = getSuperadminEmail()!;
      const superadminPassword = getSuperadminPassword()!;

      // Prüfe, ob Superadmin bereits existiert
      const existingSuperadmin = await prisma.user.findUnique({
        where: { email: superadminEmail },
        include: {
          account: true,
        },
      });

      if (existingSuperadmin) {
        console.log("[DB-INIT] Superadmin bereits vorhanden:", superadminEmail);
        // Stelle sicher, dass Rolle und Account-Status korrekt sind
        if (existingSuperadmin.role !== "SUPERADMIN") {
          await prisma.user.update({
            where: { id: existingSuperadmin.id },
            data: { role: "SUPERADMIN" },
          });
          console.log("[DB-INIT] Superadmin-Rolle aktualisiert");
        }
        if (!existingSuperadmin.account.isActive) {
          await prisma.account.update({
            where: { id: existingSuperadmin.accountId },
            data: { isActive: true },
          });
          console.log("[DB-INIT] Superadmin-Account aktiviert");
        }
        initializationChecked = true;
        return;
      }

      // Erstelle Superadmin-Account und User
      console.log("[DB-INIT] Erstelle Superadmin-Account und User...");
      
      const hashedPassword = await bcrypt.hash(superadminPassword, 10);
      
      const account = await prisma.account.create({
        data: {
          name: "Superadmin",
          slug: "superadmin",
          email: superadminEmail,
          isActive: true,
          users: {
            create: {
              email: superadminEmail,
              name: "Superadmin",
              password: hashedPassword,
              role: "SUPERADMIN",
              isActive: true,
            },
          },
          settings: {
            create: {},
          },
        },
        include: {
          users: true,
        },
      });

      // Erstelle UserSettings für Superadmin
      await prisma.userSettings.create({
        data: {
          userId: account.users[0].id,
        },
      });

      console.log("[DB-INIT] ✅ Superadmin erfolgreich erstellt:", {
        email: superadminEmail,
        accountId: account.id,
        userId: account.users[0].id,
      });

      initializationChecked = true;
    } catch (error: any) {
      // Wenn Tabellen noch nicht existieren, versuche sie zu erstellen
      if (error.code === "P2021" || error.message?.includes("does not exist")) {
        try {
          console.log("[DB-INIT] Tabellen noch nicht vorhanden - versuche automatisch zu erstellen...");
          execSync("npx prisma db push --accept-data-loss", {
            stdio: "pipe",
            env: process.env,
            cwd: process.cwd(),
          });
          console.log("[DB-INIT] ✅ Tabellen erfolgreich erstellt - versuche Initialisierung erneut");
          // Versuche Initialisierung erneut
          initializationChecked = false;
          initializationPromise = null;
          return initializeDatabase();
        } catch (pushError: any) {
          console.error("[DB-INIT] Fehler beim Erstellen der Tabellen:", pushError.message);
          console.log("[DB-INIT] Hinweis: Bitte führen Sie manuell 'npx prisma db push' oder 'npx prisma migrate deploy' aus");
          initializationChecked = true;
          return;
        }
      }
      
      console.error("[DB-INIT] Fehler bei der Initialisierung:", error);
      // Wirf den Fehler nicht weiter, damit die App trotzdem startet
      // Die Initialisierung wird beim nächsten Request erneut versucht
      initializationChecked = false;
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Prüft, ob die Datenbank initialisiert werden muss
 */
export async function needsInitialization(): Promise<boolean> {
  if (!isSuperadminConfigured()) {
    return false;
  }

  try {
    const superadminEmail = getSuperadminEmail()!;
    const existingSuperadmin = await prisma.user.findUnique({
      where: { email: superadminEmail },
    });
    return !existingSuperadmin;
  } catch (error: any) {
    // Wenn Tabellen noch nicht existieren, brauchen wir Initialisierung
    if (error.code === "P2021" || error.message?.includes("does not exist")) {
      return true;
    }
    return false;
  }
}
