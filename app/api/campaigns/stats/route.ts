import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/stats
 * Gibt Kampagnen-Statistiken basierend auf UTM-Parametern zurück
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

    // Hole alle Leads mit UTM-Parametern für diesen Account
    const leads = await prisma.lead.findMany({
      where: {
        accountId: accountId,
        OR: [
          { utmSource: { not: null } },
          { utmCampaign: { not: null } },
        ],
      },
      select: {
        id: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmTerm: true,
        utmContent: true,
        createdAt: true,
      },
    });

    // Gruppiere nach Source und Campaign
    const campaignMap = new Map<string, {
      source: string;
      sourceDisplay: string;
      campaign: string;
      medium: string | null;
      term: string | null;
      content: string | null;
      leadCount: number;
      firstLead: Date;
      lastLead: Date;
    }>();

    leads.forEach((lead) => {
      // Normalisiere Source-Namen (facebook -> meta, etc.)
      const source = lead.utmSource?.toLowerCase() || "unknown";
      let sourceDisplay = lead.utmSource || "Unbekannt";
      
      // Normalisiere bekannte Sources
      if (source === "facebook" || source === "meta" || source.includes("facebook") || source.includes("meta")) {
        sourceDisplay = "Meta (Facebook)";
      } else if (source === "google" || source.includes("google")) {
        sourceDisplay = "Google";
      } else if (source === "linkedin" || source.includes("linkedin")) {
        sourceDisplay = "LinkedIn";
      } else if (source === "tiktok" || source.includes("tiktok")) {
        sourceDisplay = "TikTok";
      }

      const campaign = lead.utmCampaign || "Ohne Kampagne";
      const key = `${sourceDisplay}|${campaign}`;

      if (!campaignMap.has(key)) {
        campaignMap.set(key, {
          source: source,
          sourceDisplay: sourceDisplay,
          campaign: campaign,
          medium: lead.utmMedium || null,
          term: lead.utmTerm || null,
          content: lead.utmContent || null,
          leadCount: 0,
          firstLead: lead.createdAt,
          lastLead: lead.createdAt,
        });
      }

      const entry = campaignMap.get(key)!;
      entry.leadCount++;
      if (lead.createdAt < entry.firstLead) {
        entry.firstLead = lead.createdAt;
      }
      if (lead.createdAt > entry.lastLead) {
        entry.lastLead = lead.createdAt;
      }
    });

    // Konvertiere Map zu Array und sortiere nach Lead-Anzahl (absteigend)
    const campaigns = Array.from(campaignMap.values()).sort((a, b) => b.leadCount - a.leadCount);

    // Berechne Gesamtstatistiken
    const totalLeads = campaigns.reduce((sum, c) => sum + c.leadCount, 0);
    const sources = Array.from(new Set(campaigns.map(c => c.sourceDisplay)));

    return NextResponse.json({
      campaigns,
      totalLeads,
      totalCampaigns: campaigns.length,
      sources,
    });
  } catch (error) {
    console.error("Error fetching campaign stats:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Kampagnen-Statistiken" },
      { status: 500 }
    );
  }
}
