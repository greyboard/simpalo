import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/leads/search?q=...
 * Sucht nach Leads/Kontakten und Unternehmen basierend auf verschiedenen Feldern
 * Unterstützt Suche nach: Name (Lead/Contact), E-Mail, Telefon, Google Place ID, Firmenname, Adresse
 * WICHTIG: Die Quelle (source) wird NICHT durchsucht - nur Kontakt- und Unternehmensfelder
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
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Suchbegriff muss mindestens 2 Zeichen lang sein" },
        { status: 400 }
      );
    }

    // Suche in verschiedenen Feldern
    const searchTerm = query.toLowerCase();

    // Prüfe, ob es eine Google Place ID ist (beginnt typischerweise mit "ChIJ" oder ähnlich)
    const isPlaceId = /^[A-Za-z0-9_-]{27,}$/.test(query);

    const where: any = {
      accountId: accountId,
      OR: [
        // Suche nach Name
        {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        // Suche nach E-Mail
        {
          email: {
            contains: query,
            mode: "insensitive",
          },
        },
        // Suche nach Telefon
        {
          phone: {
            contains: query,
            mode: "insensitive",
          },
        },
        // Suche nach Google Place ID (exakte Übereinstimmung)
        ...(isPlaceId
          ? [
              {
                googlePlaceId: query,
              },
            ]
          : []),
        // Suche nach Firmenname über Company-Relation
        {
          company: {
            OR: [
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                businessName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              // Suche nach Google Place ID in Company
              ...(isPlaceId
                ? [
                    {
                      googlePlaceId: query,
                    },
                  ]
                : []),
            ],
          },
        },
        // Suche nach Adresse über Company
        {
          company: {
            OR: [
              {
                address: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                city: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                zipCode: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      ],
    };

    const leads = await prisma.lead.findMany({
      where,
      include: {
        company: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: [
        // Priorisiere exakte Übereinstimmungen
        {
          name: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
      take: 20, // Limit auf 20 Ergebnisse für schnelle Antwort
    });

    // Formatiere Ergebnisse für die UI
    const results = leads.map((lead) => ({
      id: lead.id,
      name: lead.name || lead.company?.name || "Unbekannt",
      email: lead.email,
      phone: lead.phone,
      type: lead.type,
      source: lead.source,
      company: lead.company
        ? {
            id: lead.company.id,
            name: lead.company.name,
            businessName: lead.company.businessName,
            city: lead.company.city,
            address: lead.company.address,
          }
        : null,
      tags: lead.tags.map((lt) => ({
        id: lt.tag.id,
        name: lt.tag.name,
        color: lt.tag.color,
      })),
    }));

    return NextResponse.json({
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("Error searching leads:", error);
    return NextResponse.json(
      { error: "Fehler bei der Suche", results: [], count: 0 },
      { status: 500 }
    );
  }
}
