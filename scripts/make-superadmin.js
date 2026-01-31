const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function makeSuperAdmin(email) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`Benutzer mit E-Mail ${email} nicht gefunden.`);
      process.exit(1);
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: "SUPERADMIN" },
    });

    console.log(`✅ Benutzer ${email} wurde erfolgreich zum Superadmin gemacht.`);
    console.log(`   Name: ${updatedUser.name || "N/A"}`);
    console.log(`   Rolle: ${updatedUser.role}`);
    
    // Stelle auch sicher, dass der Account aktiv ist
    const account = await prisma.account.update({
      where: { id: updatedUser.accountId },
      data: { isActive: true },
    });

    console.log(`✅ Account "${account.name}" wurde aktiviert.`);
  } catch (error) {
    console.error("Fehler:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2] || process.env.SUPERADMIN_EMAIL || "admin@example.com";

makeSuperAdmin(email);
