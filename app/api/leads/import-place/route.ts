import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlaceDetails } from "@/lib/google-places";
import { parseAddress } from "@/lib/utils";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * Importiert einen Lead basierend auf Google Place ID
 * Ruft automatisch alle verfügbaren Details ab (Telefon, Website, Öffnungszeiten, etc.)
 */
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
    const { placeId } = await request.json();

    if (!placeId) {
      return NextResponse.json(
        { error: "Place ID ist erforderlich" },
        { status: 400 }
      );
    }

    // Hole account-spezifischen API Key
    const accountSettings = await prisma.accountSettings.findUnique({
      where: { accountId },
    });

    const settings = (accountSettings?.settings as any) || {};
    const apiKey = settings.googlePlacesApiKey || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

    // Prüfe, ob Company bereits existiert
    const existingCompany = await prisma.company.findUnique({
      where: { googlePlaceId: placeId },
    });

    // Place Details abrufen mit allen verfügbaren Feldern
    let placeDetails;
    try {
      placeDetails = await getPlaceDetails(placeId, [
        "name",
        "formatted_address",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "rating",
        "user_ratings_total",
        "opening_hours",
        "types",
        "geometry",
        "business_status",
        "editorial_summary",
        "plus_code",
        "price_level",
        "photos",
        "reviews",
      ], apiKey); // Account-spezifischer API Key
    } catch (error: any) {
      console.error("Error fetching place details:", error);
      return NextResponse.json(
        { 
          error: `Fehler beim Abrufen der Place Details: ${error.message || "Unbekannter Fehler"}`,
        },
        { status: 500 }
      );
    }

    if (!placeDetails) {
      return NextResponse.json(
        { error: "Place Details konnten nicht abgerufen werden" },
        { status: 404 }
      );
    }

    // Adresse parsen
    const address = placeDetails.formatted_address || "";
    const parsedAddress = parseAddress(address);

    // Öffnungszeiten für JSON speichern
    let businessHours = null;
    if (placeDetails.opening_hours) {
      businessHours = {
        openNow: placeDetails.opening_hours.open_now,
        weekdayText: placeDetails.opening_hours.weekday_text || [],
        periods: placeDetails.opening_hours.periods || [],
      };
    }

    // Company-Daten zusammenstellen
    const companyData: any = {
      name: placeDetails.name || "Unbekannt",
      businessName: placeDetails.name || null,
      address: address || null,
      city: parsedAddress.city || null,
      zipCode: parsedAddress.zipCode || null,
      state: parsedAddress.state || null,
      country: "DE",
      phone: placeDetails.international_phone_number || placeDetails.formatted_phone_number || null,
      website: placeDetails.website || null,
      googlePlaceId: placeId, // Required field
      rating: placeDetails.rating || null,
      reviewCount: placeDetails.user_ratings_total || null,
      category: placeDetails.types?.[0] || null,
      hasPoorProfile: !placeDetails.website || !placeDetails.rating,
    };
    
    // Füge businessHours nur hinzu, wenn es nicht null ist
    if (businessHours) {
      companyData.businessHours = businessHours;
    }

    // Company und Lead erstellen mit Reviews in einer Transaktion
    const result = await prisma.$transaction(async (tx) => {
      // Company erstellen oder finden
      let company = existingCompany;
      if (!company) {
        try {
          company = await tx.company.create({
            data: companyData,
          });
        } catch (createError: any) {
          console.error("Error creating company:", createError);
          // Falls Company zwischenzeitlich erstellt wurde, versuche es nochmal zu finden
          if (createError.code === "P2002") {
            company = await tx.company.findUnique({
              where: { googlePlaceId: placeId },
            });
            if (!company) {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      } else {
        // Company aktualisieren, falls neue Daten vorhanden
        try {
          company = await tx.company.update({
            where: { id: company.id },
            data: {
              name: companyData.name,
              businessName: companyData.businessName,
              address: companyData.address,
              city: companyData.city,
              zipCode: companyData.zipCode,
              state: companyData.state,
              phone: companyData.phone,
              website: companyData.website,
              rating: companyData.rating,
              reviewCount: companyData.reviewCount,
              category: companyData.category,
              businessHours: companyData.businessHours,
              hasPoorProfile: companyData.hasPoorProfile,
              updatedAt: new Date(),
            },
          });
        } catch (updateError: any) {
          console.error("Error updating company:", updateError);
          throw updateError;
        }
      }

      // Lead erstellen (Kontaktname = Company-Name, kann später geändert werden)
      const lead = await tx.lead.create({
        data: {
          name: placeDetails.name || "Unbekannt",
          accountId: accountId,
          companyId: company.id,
          source: "Google Places",
          type: "COMPANY", // Google Places = Unternehmen
          status: "NEW",
        },
        include: {
          company: true,
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      // Erstelle automatisch eine Task "Lead kontaktieren" für neue CONTACT-Leads
      // (Google Places Leads sind COMPANY, daher keine Task)
      // Task wird nur für CONTACT-Leads erstellt

      // Reviews speichern, falls vorhanden und noch nicht vorhanden
      if (placeDetails.reviews && placeDetails.reviews.length > 0) {
        try {
          // Prüfe, welche Reviews bereits existieren
          const existingReviews = await tx.review.findMany({
            where: { companyId: company.id },
            select: { reviewTime: true, authorName: true },
          });

          const existingReviewKeys = new Set(
            existingReviews.map((r) => `${r.reviewTime.getTime()}-${r.authorName}`)
          );

          const newReviews = placeDetails.reviews
            .filter((review: any) => {
              const reviewTime = review.time ? new Date(review.time * 1000) : new Date();
              const key = `${reviewTime.getTime()}-${review.author_name || "Anonym"}`;
              return !existingReviewKeys.has(key);
            })
            .map((review: any) => ({
              companyId: company.id,
              authorName: review.author_name || "Anonym",
              rating: review.rating || 0,
              text: review.text || null,
              reviewTime: review.time ? new Date(review.time * 1000) : new Date(),
            }));

          if (newReviews.length > 0) {
            await tx.review.createMany({
              data: newReviews,
            });
          }
        } catch (reviewError: any) {
          console.warn("Reviews konnten nicht gespeichert werden:", reviewError.message);
        }
      }

      return { lead, company };
    });

    // Lead mit Company und Reviews laden
    const leadWithCompany = await prisma.lead.findUnique({
      where: { id: result.lead.id },
      include: {
        company: {
          include: {
            reviews: {
              orderBy: {
                reviewTime: "desc",
              },
              take: 5,
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return NextResponse.json({
      lead: leadWithCompany,
      company: result.company,
      placeDetails: {
        name: placeDetails.name,
        address: placeDetails.formatted_address,
        phone: placeDetails.international_phone_number || placeDetails.formatted_phone_number,
        website: placeDetails.website,
        rating: placeDetails.rating,
        reviewCount: placeDetails.user_ratings_total,
        openingHours: placeDetails.opening_hours,
        types: placeDetails.types,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error importing lead from place:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
    
    // Prisma Fehler behandeln
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (Array.isArray(target) && target.includes("googlePlaceId")) {
        return NextResponse.json(
          { error: "Company mit dieser Google Place ID existiert bereits" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Lead oder Company existiert bereits" },
        { status: 409 }
      );
    }

    // Prisma Model nicht gefunden (Migration nicht ausgeführt)
    if (error.message?.includes("Unknown arg `company`") || 
        error.message?.includes("model `Company`") ||
        error.code === "P2021") {
      return NextResponse.json(
        { 
          error: "Datenbank-Schema nicht aktuell. Bitte Migration ausführen: npx prisma migrate dev",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 500 }
      );
    }

    // Detailliertere Fehlermeldung für Debugging
    const errorMessage = error.message || "Fehler beim Importieren des Leads";
    const errorDetails = process.env.NODE_ENV === "development" 
      ? { 
          message: error.message,
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        }
      : undefined;

    return NextResponse.json(
      { 
        error: errorMessage,
        ...(errorDetails && { details: errorDetails }),
      },
      { status: 500 }
    );
  }
}
