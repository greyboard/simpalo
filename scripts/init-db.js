/**
 * Database Initialization Script
 * 
 * Dieses Script initialisiert die Datenbank beim ersten Start:
 * 1. Führt Prisma Migrationen aus
 * 2. Erstellt Superadmin, falls nicht vorhanden
 * 
 * Verwendung:
 *   node scripts/init-db.js
 * 
 * Oder in package.json:
 *   "db:init": "node scripts/init-db.js"
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log("🚀 Starte Datenbank-Initialisierung...");

    // Prüfe ENV-Variablen
    const superadminEmail = process.env.SUPERADMIN_EMAIL;
    const superadminPassword = process.env.SUPERADMIN_PASSWORD;

    if (!superadminEmail || !superadminPassword) {
      console.error("❌ SUPERADMIN_EMAIL und SUPERADMIN_PASSWORD müssen in ENV-Variablen gesetzt sein");
      process.exit(1);
    }

    // Prüfe, ob Superadmin bereits existiert
    const existingSuperadmin = await prisma.user.findUnique({
      where: { email: superadminEmail },
      include: {
        account: true,
      },
    });

    if (existingSuperadmin) {
      console.log("✅ Superadmin bereits vorhanden:", superadminEmail);
      
      // Stelle sicher, dass Rolle und Account-Status korrekt sind
      if (existingSuperadmin.role !== "SUPERADMIN") {
        await prisma.user.update({
          where: { id: existingSuperadmin.id },
          data: { role: "SUPERADMIN" },
        });
        console.log("✅ Superadmin-Rolle aktualisiert");
      }
      
      if (!existingSuperadmin.account.isActive) {
        await prisma.account.update({
          where: { id: existingSuperadmin.accountId },
          data: { isActive: true },
        });
        console.log("✅ Superadmin-Account aktiviert");
      }
      
      await prisma.$disconnect();
      process.exit(0);
    }

    // Erstelle Superadmin-Account und User
    console.log("📝 Erstelle Superadmin-Account und User...");
    
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

    console.log("✅ Superadmin erfolgreich erstellt!");
    console.log("   Email:", superadminEmail);
    console.log("   Account ID:", account.id);
    console.log("   User ID:", account.users[0].id);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Fehler bei der Initialisierung:", error.message);
    
    if (error.code === "P2021" || error.message?.includes("does not exist")) {
      console.error("\n💡 Hinweis: Tabellen existieren noch nicht.");
      console.error("   Bitte führen Sie zuerst aus:");
      console.error("   npx prisma migrate deploy");
      console.error("   oder");
      console.error("   npx prisma db push");
    }
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

initializeDatabase();
