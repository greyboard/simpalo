import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/[source]/[campaign]/leads
 * Gibt alle Leads für eine spezifische Kampagne zurück
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { source: string; campaign: string } }
) {
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
    
    // Decode URL-Parameter
    const source = decodeURIComponent(params.source);
    const campaign = decodeURIComponent(params.campaign);

    // Normalisiere Source für Suche (kann verschiedene Varianten sein)
    const sourceLower = source.toLowerCase();
    let sourceFilter: any;
    
    if (sourceLower.includes("meta") || sourceLower.includes("facebook")) {
      // Suche nach facebook oder meta (case-insensitive)
      sourceFilter = {
        OR: [
          { utmSource: { contains: "facebook", mode: "insensitive" } },
          { utmSource: { contains: "meta", mode: "insensitive" } },
        ],
      };
    } else if (sourceLower.includes("google")) {
      sourceFilter = { utmSource: { contains: "google", mode: "insensitive" } };
    } else if (sourceLower.includes("linkedin")) {
      sourceFilter = { utmSource: { contains: "linkedin", mode: "insensitive" } };
    } else if (sourceLower.includes("tiktok")) {
      sourceFilter = { utmSource: { contains: "tiktok", mode: "insensitive" } };
    } else {
      // Fallback: exakte Suche (case-insensitive)
      sourceFilter = { utmSource: { equals: source, mode: "insensitive" } };
    }

    // Finde alle Leads für diese Kampagne
    const leads = await prisma.lead.findMany({
      where: {
        accountId: accountId,
        ...sourceFilter,
        utmCampaign: campaign,
      },
      include: {
        company: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      source,
      campaign,
      leads,
      totalLeads: leads.length,
    });
  } catch (error) {
    console.error("Error fetching campaign leads:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Kampagnen-Leads" },
      { status: 500 }
    );
  }
}
