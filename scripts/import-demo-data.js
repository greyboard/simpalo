/**
 * Demo-Daten Import Script
 * 
 * Importiert 100 Demo-Kontakte in die Datenbank:
 * - 10 verschiedene UTM-Kampagnen
 * - Deutsche Namen
 * - Gleichmäßige Verteilung über 2 Monate
 * - Emails: demo1@simpalo.de, demo2@simpalo.de, etc.
 * 
 * Verwendung:
 *   DATABASE_URL="postgresql://..." node scripts/import-demo-data.js
 * 
 * Oder in package.json:
 *   "db:import-demo": "node scripts/import-demo-data.js"
 */

const { PrismaClient } = require("@prisma/client");

// Verwende DATABASE_URL aus ENV oder als Argument
const databaseUrl = process.env.DATABASE_URL || process.argv[2];

if (!databaseUrl) {
  console.error("❌ DATABASE_URL muss gesetzt sein (ENV oder als Argument)");
  console.error("   Verwendung: DATABASE_URL=\"postgresql://...\" node scripts/import-demo-data.js");
  process.exit(1);
}

// Setze DATABASE_URL für Prisma Client
process.env.DATABASE_URL = databaseUrl;

// Erstelle Prisma Client (verwendet jetzt die gesetzte DATABASE_URL)
const prisma = new PrismaClient();

// Deutsche Vornamen
const firstNames = [
  "Max", "Anna", "Thomas", "Sarah", "Michael", "Julia", "Andreas", "Lisa", "Stefan", "Maria",
  "Christian", "Nicole", "Daniel", "Jessica", "Markus", "Melanie", "Sebastian", "Stephanie", "Martin", "Nadine",
  "Alexander", "Jennifer", "Florian", "Katharina", "Jan", "Vanessa", "Tobias", "Laura", "David", "Sabrina",
  "Patrick", "Nina", "Benjamin", "Julia", "Matthias", "Christina", "Oliver", "Sandra", "Philipp", "Nicole",
  "Simon", "Julia", "Fabian", "Julia", "Tim", "Julia", "Lukas", "Julia", "Jonas", "Julia",
  "Felix", "Julia", "Kevin", "Julia", "Marco", "Julia", "Nico", "Julia", "Robin", "Julia",
  "Dennis", "Julia", "Marcel", "Julia", "Sven", "Julia", "Björn", "Julia", "Timo", "Julia",
  "Dominik", "Julia", "René", "Julia", "Jens", "Julia", "Frank", "Julia", "Peter", "Julia",
  "Klaus", "Julia", "Hans", "Julia", "Wolfgang", "Julia", "Dieter", "Julia", "Günter", "Julia",
];

// Deutsche Nachnamen
const lastNames = [
  "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
  "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann",
  "Braun", "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Meier",
  "Lehmann", "Schmid", "Schulze", "Maier", "Köhler", "Herrmann", "König", "Walter", "Huber", "Peters",
  "Fuchs", "Lang", "Möller", "Weiß", "Jung", "Hahn", "Schubert", "Vogel", "Friedrich", "Günther",
  "Keller", "Winkler", "Frank", "Berger", "Roth", "Beck", "Lorenz", "Baumann", "Franke", "Albrecht",
  "Schuster", "Simon", "Ludwig", "Böhm", "Winter", "Kraus", "Martin", "Schumacher", "Krämer", "Vogt",
  "Stein", "Jäger", "Otto", "Sommer", "Groß", "Seidel", "Heinrich", "Brandt", "Haas", "Schreiber",
  "Graf", "Schulte", "Dietrich", "Ziegler", "Kuhn", "Pohl", "Pfeiffer", "Langer", "Christoph", "Götz",
  "Horn", "Voigt", "Busch", "Bergmann", "Thomas", "Sauer", "Arnold", "Wolff", "Pfeifer", "Gärtner",
];

// UTM Campaign Namen
const campaignNames = [
  "Sommer-Aktion 2024",
  "Google Ads - Lokale Suche",
  "Facebook Marketing",
  "Newsletter Kampagne",
  "LinkedIn B2B",
  "Instagram Stories",
  "YouTube Werbung",
  "Bing Ads",
  "Email Marketing",
  "SEO Landing Page",
];

// Städte in Deutschland
const cities = [
  "Berlin", "Hamburg", "München", "Köln", "Frankfurt", "Stuttgart", "Düsseldorf", "Dortmund", "Essen", "Leipzig",
  "Bremen", "Dresden", "Hannover", "Nürnberg", "Duisburg", "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster",
];

// Branchen
const categories = [
  "Restaurant", "Friseur", "Fitnessstudio", "Autowerkstatt", "Zahnarzt", "Anwalt", "Immobilien", "Handwerker", "Bäckerei", "Elektronik",
];

async function importDemoData() {
  try {
    console.log("🚀 Starte Demo-Daten Import...");

    // Finde das erste Account (normalerweise Superadmin)
    const account = await prisma.account.findFirst({
      where: { isActive: true },
    });

    if (!account) {
      console.error("❌ Kein aktives Account gefunden. Bitte erstelle zuerst ein Account.");
      process.exit(1);
    }

    console.log(`✅ Account gefunden: ${account.name} (${account.id})`);

    // Lösche vorhandene Demo-Daten (optional - kann auskommentiert werden)
    console.log("🗑️  Lösche vorhandene Demo-Daten...");
    await prisma.lead.deleteMany({
      where: {
        accountId: account.id,
        email: { startsWith: "demo" },
      },
    });
    await prisma.campaign.deleteMany({
      where: {
        accountId: account.id,
        name: { in: campaignNames },
      },
    });
    await prisma.company.deleteMany({
      where: {
        name: { startsWith: "Demo Firma" },
      },
    });

    // Erstelle 10 Companies
    console.log("📦 Erstelle 10 Companies...");
    const companies = [];
    for (let i = 0; i < 10; i++) {
      const company = await prisma.company.create({
        data: {
          name: `Demo Firma ${i + 1}`,
          businessName: `${categories[i % categories.length]} ${cities[i % cities.length]}`,
          city: cities[i % cities.length],
          country: "DE",
          zipCode: String(10000 + i * 100),
          address: `Musterstraße ${i + 1}`,
          phone: `+49 30 ${String(1000000 + i).padStart(7, "0")}`,
          website: `https://demo${i + 1}.example.de`,
          googlePlaceId: `demo-place-id-${i + 1}-${Date.now()}`,
          category: categories[i % categories.length],
          rating: 4.0 + (Math.random() * 1.0), // 4.0 - 5.0
          reviewCount: Math.floor(Math.random() * 100) + 10,
        },
      });
      companies.push(company);
    }
    console.log(`✅ ${companies.length} Companies erstellt`);

    // Erstelle 10 Campaigns
    console.log("📢 Erstelle 10 Campaigns...");
    const campaigns = [];
    for (let i = 0; i < 10; i++) {
      const campaign = await prisma.campaign.create({
        data: {
          name: campaignNames[i],
          description: `Demo-Kampagne: ${campaignNames[i]}`,
          type: "EMAIL",
          status: "ACTIVE",
          accountId: account.id,
        },
      });
      campaigns.push(campaign);
    }
    console.log(`✅ ${campaigns.length} Campaigns erstellt`);

    // Erstelle zuerst 10 COMPANY-Leads (für Firmen-Ansicht)
    console.log("🏢 Erstelle 10 COMPANY-Leads (für Firmen-Ansicht)...");
    const companyLeads = [];
    const now = new Date();
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    for (let i = 0; i < 10; i++) {
      const company = companies[i];
      const daysAgo = Math.floor((i / 10) * 60); // Gleichmäßig über 2 Monate
      const createdAt = new Date(twoMonthsAgo);
      createdAt.setDate(createdAt.getDate() + daysAgo);

      const companyLead = await prisma.lead.create({
        data: {
          name: company.businessName || company.name,
          accountId: account.id,
          companyId: company.id,
          status: ["NEW", "CONTACTED", "QUALIFIED"][i % 3],
          priority: ["LOW", "MEDIUM", "HIGH"][i % 3],
          type: "COMPANY", // Wichtig: type="COMPANY" für Firmen-Ansicht
          source: "Demo Import",
          createdAt: createdAt,
          updatedAt: createdAt,
        },
      });
      companyLeads.push(companyLead);
    }
    console.log(`✅ ${companyLeads.length} COMPANY-Leads erstellt`);

    // Erstelle 100 CONTACT-Leads
    console.log("👥 Erstelle 100 CONTACT-Leads...");
    const leads = [];

    for (let i = 0; i < 100; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
      const fullName = `${firstName} ${lastName}`;
      const email = `demo${i + 1}@simpalo.de`;
      
      // Gleichmäßige Verteilung über 2 Monate
      const daysAgo = Math.floor((i / 100) * 60); // 0-60 Tage
      const createdAt = new Date(twoMonthsAgo);
      createdAt.setDate(createdAt.getDate() + daysAgo);

      // Verteile gleichmäßig auf Campaigns (10 Leads pro Campaign)
      const campaignIndex = Math.floor(i / 10);
      const campaign = campaigns[campaignIndex];
      const company = companies[campaignIndex % companies.length];

      // UTM Parameter basierend auf Campaign
      const utmSources = ["google", "facebook", "linkedin", "email", "direct"];
      const utmMediums = ["cpc", "social", "email", "organic", "referral"];
      
      const lead = await prisma.lead.create({
        data: {
          name: fullName,
          firstName: firstName,
          lastName: lastName,
          email: email,
          phone: `+49 30 ${String(1000000 + i).padStart(7, "0")}`,
          accountId: account.id,
          companyId: company.id,
          status: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"][i % 4],
          priority: ["LOW", "MEDIUM", "HIGH"][i % 3],
          type: "CONTACT",
          source: campaign.name,
          utmSource: utmSources[campaignIndex % utmSources.length],
          utmMedium: utmMediums[campaignIndex % utmMediums.length],
          utmCampaign: campaign.name.toLowerCase().replace(/\s+/g, "-"),
          createdAt: createdAt,
          updatedAt: createdAt,
        },
      });

      // Verknüpfe Lead mit Campaign
      await prisma.campaignLead.create({
        data: {
          campaignId: campaign.id,
          leadId: lead.id,
          status: ["pending", "sent", "opened", "clicked"][i % 4],
        },
      });

      leads.push(lead);

      if ((i + 1) % 10 === 0) {
        console.log(`   ${i + 1}/100 Leads erstellt...`);
      }
    }

    console.log(`✅ ${leads.length} Leads erstellt`);

    // Zusammenfassung
    console.log("\n📊 Zusammenfassung:");
    console.log(`   - Account: ${account.name}`);
    console.log(`   - Companies: ${companies.length}`);
    console.log(`   - Campaigns: ${campaigns.length}`);
    console.log(`   - Leads: ${leads.length}`);
    console.log(`   - Zeitraum: ${twoMonthsAgo.toLocaleDateString("de-DE")} - ${now.toLocaleDateString("de-DE")}`);
    console.log("\n✅ Demo-Daten erfolgreich importiert!");

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Fehler beim Import:", error);
    console.error("   Details:", error.message);
    if (error.stack) {
      console.error("   Stack:", error.stack);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
}

importDemoData();
