import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { searchPlaces, getPlaceDetails, type GooglePlaceResult } from "@/lib/google-places";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

interface SearchFilters {
  location?: string;
  category?: string;
  minRating?: number;
  hasWebsite?: boolean;
  hasPoorProfile?: boolean;
  maxResults?: number; // 20, 40 oder 60 (Standard: 60)
}

export async function POST(request: NextRequest) {
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
    const { query, filters }: { query: string; filters?: SearchFilters } = await request.json();

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: "Suchbegriff ist erforderlich" },
        { status: 400 }
      );
    }

    // Hole account-spezifischen API Key
    const accountSettings = await prisma.accountSettings.findUnique({
      where: { accountId },
    });

    const settings = (accountSettings?.settings as any) || {};
    const apiKey = settings.googlePlacesApiKey || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

    // Wenn kein API-Key konfiguriert ist, verwende Mock-Daten für Development
    if (!apiKey) {
      console.warn("Google Places API Key nicht konfiguriert. Verwende Mock-Daten.");
      
      const mockResults = [
        {
          place_id: "mock_1",
          name: "Beispiel Restaurant",
          formatted_address: "Musterstraße 1, 12345 Berlin",
          rating: 4.2,
          user_ratings_total: 45,
          types: ["restaurant", "food", "point_of_interest"],
          website: "https://example-restaurant.de",
          international_phone_number: "+49 30 12345678",
          business_status: "OPERATIONAL",
        },
      ];

      let filteredResults = mockResults;
      if (filters?.minRating) {
        const minRating = filters.minRating;
        filteredResults = filteredResults.filter(
          (r) => r.rating && r.rating >= minRating
        );
      }
      if (filters?.category) {
        filteredResults = filteredResults.filter((r) =>
          r.types?.some((type) => type.includes(filters.category!.toLowerCase()))
        );
      }

      return NextResponse.json({
        results: filteredResults,
        message: "Google Places API Key nicht konfiguriert. Bitte NEXT_PUBLIC_GOOGLE_PLACES_API_KEY in .env.local setzen.",
      });
    }

    // Google Places API Suche
    let results: GooglePlaceResult[];
    try {
      results = await searchPlaces(
        query.trim(),
        filters?.location,
        filters?.minRating,
        filters?.category,
        filters?.maxResults || 60, // Standard: 60 Ergebnisse (3 Seiten)
        apiKey // Account-spezifischer API Key
      );
    } catch (error: any) {
      console.error("Google Places API Error:", error);
      
      // Wenn Rate Limit oder API-Fehler, gib eine aussagekräftige Fehlermeldung zurück
      if (error.message?.includes("Rate Limit") || error.message?.includes("OVER_QUERY_LIMIT")) {
        return NextResponse.json(
          { 
            error: "API Rate Limit erreicht. Bitte versuche es in ein paar Minuten erneut.",
            results: [],
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { 
          error: error.message || "Fehler bei der Google Places API Suche",
          results: [],
        },
        { status: 500 }
      );
    }

    // Optionale Place Details für bessere Daten (Website, etc.)
    // Hinweis: Dies erhöht die Anzahl der API-Calls erheblich
    // Für Production sollte dies optional gemacht oder gecached werden
    const enrichWithDetails = false; // Setze auf true, wenn Details gewünscht sind

    if (enrichWithDetails && results.length > 0) {
      // Limit auf 5 Ergebnisse für Details-Abruf (Rate-Limiting)
      const limitedResults = results.slice(0, 5);
      
      try {
        const enrichedResults = await Promise.all(
          limitedResults.map(async (place) => {
            try {
              const details = await getPlaceDetails(place.place_id, undefined, apiKey);
              if (details) {
                return {
                  ...place,
                  website: details.website || place.website,
                  international_phone_number: details.international_phone_number || place.international_phone_number,
                  formatted_phone_number: details.formatted_phone_number || place.formatted_phone_number,
                  opening_hours: details.opening_hours,
                };
              }
              return place;
            } catch (error) {
              console.error(`Error fetching details for place ${place.place_id}:`, error);
              return place;
            }
          })
        );
        
        // Kombiniere angereicherte Ergebnisse mit restlichen Ergebnissen
        results = [...enrichedResults, ...results.slice(5)];
      } catch (error) {
        console.error("Error enriching results with details:", error);
        // Weiter mit Standard-Ergebnissen, wenn Details-Abruf fehlschlägt
      }
    }

    // Zusätzliche Filter anwenden (Client-seitig)
    let filteredResults = results;
    
    if (filters?.hasWebsite) {
      filteredResults = filteredResults.filter((r) => !!r.website);
    }

    if (filters?.hasPoorProfile) {
      // Als "unteroptimiert" gelten Profile ohne Website ODER ohne Rating
      filteredResults = filteredResults.filter(
        (r) => !r.website || !r.rating
      );
    }

    // Kategoriefilter (falls noch nicht in API-Query enthalten)
    if (filters?.category && filters.category.trim()) {
      const categoryLower = filters.category.toLowerCase();
      filteredResults = filteredResults.filter((r) =>
        r.types?.some((type) => type.toLowerCase().includes(categoryLower))
      );
    }

    // Prüfe, welche Leads bereits in der Datenbank existieren
    const placeIds = filteredResults.map((r) => r.place_id).filter(Boolean);
    const existingLeadsMap: Map<string, string> = new Map();
    
    if (placeIds.length > 0) {
      try {
        const existingCompanies = await prisma.company.findMany({
          where: {
            googlePlaceId: {
              in: placeIds,
            },
          },
          include: {
            leads: {
              take: 1,
              select: {
                id: true,
              },
            },
          },
        });
        
        existingCompanies.forEach((company) => {
          if (company.googlePlaceId && company.leads.length > 0) {
            existingLeadsMap.set(company.googlePlaceId, company.leads[0].id);
          }
        });
      } catch (error) {
        console.error("Error checking existing leads:", error);
        // Weiter ohne Prüfung, wenn Datenbankfehler auftritt
      }
    }

    // Erweitere Ergebnisse um existsInDatabase Flag und Lead-ID
    const resultsWithStatus = filteredResults.map((result) => {
      const existingLeadId = result.place_id ? existingLeadsMap.get(result.place_id) : null;
      const exists = !!existingLeadId;

      return {
        ...result,
        existsInDatabase: exists,
        existingLeadId: existingLeadId || null,
      };
    });

    return NextResponse.json({
      results: resultsWithStatus,
      count: filteredResults.length,
    });
  } catch (error: any) {
    console.error("Error searching Google Business:", error);
    return NextResponse.json(
      { 
        error: error.message || "Fehler bei der Suche",
        results: [],
      },
      { status: 500 }
    );
  }
}