import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

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

    const [
      totalLeads,
      totalContacts,
      totalCompanies,
      newLeads,
      contactedLeads,
      leadsWithStatus,
    ] = await Promise.all([
      prisma.lead.count({
        where: { accountId },
      }),
      prisma.lead.count({
        where: { accountId, type: "CONTACT" },
      }),
      prisma.lead.count({
        where: { accountId, type: "COMPANY" },
      }),
      prisma.lead.count({
        where: {
          accountId,
          type: "CONTACT", // Nur Kontakte, keine Unternehmen
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
      prisma.lead.count({
        where: {
          accountId,
          type: "CONTACT", // Nur Kontakte, keine Unternehmen
          status: {
            in: ["CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"],
          },
        },
      }),
      prisma.lead.groupBy({
        by: ["status"],
        where: { accountId },
        _count: true,
      }),
    ]);

    // Kontaktquote: Nur Kontakte berücksichtigen, nicht Unternehmen
    const conversionRate =
      totalContacts > 0 ? (contactedLeads / totalContacts) * 100 : 0;

    return NextResponse.json({
      totalLeads,
      totalContacts,
      totalCompanies,
      newLeads,
      contactedLeads,
      conversionRate,
      statusDistribution: leadsWithStatus,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}