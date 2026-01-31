import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/companies
 * Gibt alle Unternehmen eines Accounts zurück (für Dropdown/Select)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentifizierung prüfen
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;

    // Hole alle Companies, die von Leads dieses Accounts verwendet werden
    const accountLeads = await prisma.lead.findMany({
      where: {
        accountId: accountId,
      },
      select: {
        companyId: true,
      },
      distinct: ["companyId"],
    });

    const companyIds = accountLeads.map((lead) => lead.companyId);

    // Hole die Company-Details
    const companies = await prisma.company.findMany({
      where: {
        id: {
          in: companyIds,
        },
        name: {
          not: "",
        },
      },
      orderBy: {
        name: "asc",
      },
      take: 500, // Limit für Performance
    });

    // Filtere zusätzlich Companies ohne Namen, mit nur Leerzeichen oder mit dem Namen "Unbekannt"
    const filteredCompanies = companies.filter(
      (company) => 
        company.name && 
        company.name.trim() !== "" && 
        company.name.trim().toLowerCase() !== "unbekannt"
    );

    return NextResponse.json(filteredCompanies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Unternehmen" },
      { status: 500 }
    );
  }
}
