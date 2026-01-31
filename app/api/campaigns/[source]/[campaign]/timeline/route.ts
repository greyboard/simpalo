import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/[source]/[campaign]/timeline
 * Gibt Leads gruppiert nach Tag/Monat/Woche für eine spezifische Kampagne zurück
 * Query Parameter: period (day|week|month) - Standard: day
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
    
    // Hole Query Parameter für Period (day, week, month)
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "day"; // Standard: day

    // Normalisiere Source für Suche
    const sourceLower = source.toLowerCase();
    let sourceFilter: any;
    
    if (sourceLower.includes("meta") || sourceLower.includes("facebook")) {
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
      sourceFilter = { utmSource: { equals: source, mode: "insensitive" } };
    }

    // Hole alle Leads für diese Kampagne
    const leads = await prisma.lead.findMany({
      where: {
        accountId: accountId,
        ...sourceFilter,
        utmCampaign: campaign,
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Gruppiere Leads nach Period
    const groupedData: Record<string, number> = {};

    leads.forEach((lead) => {
      const date = new Date(lead.createdAt);
      let key: string;

      switch (period) {
        case "week":
          // Jahr-Kalenderwoche Format: "2024-W01"
          const year = date.getFullYear();
          const week = getWeekNumber(date);
          key = `${year}-W${week.toString().padStart(2, "0")}`;
          break;
        case "month":
          // Jahr-Monat Format: "2024-01"
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
          break;
        case "day":
        default:
          // Jahr-Monat-Tag Format: "2024-01-15"
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
          break;
      }

      groupedData[key] = (groupedData[key] || 0) + 1;
    });

    // Konvertiere zu Array und sortiere nach Datum
    const timeline = Object.entries(groupedData)
      .map(([date, count]) => ({
        date,
        leads: count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      period,
      timeline,
      totalLeads: leads.length,
    });
  } catch (error) {
    console.error("Error fetching campaign timeline:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Timeline-Daten" },
      { status: 500 }
    );
  }
}

// Hilfsfunktion: Berechnet die Kalenderwoche
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
