import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/reviews/recent
 * Ruft die neuesten Reviews ab (für Dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Prüfe, ob Review-Model existiert, indem wir versuchen, es abzufragen
    let reviews;
    try {
      reviews = await prisma.review.findMany({
        include: {
          company: {
            select: {
              id: true,
              name: true,
              businessName: true,
            },
          },
        },
        orderBy: {
          reviewTime: "desc",
        },
        take: limit,
      });
    } catch (error: any) {
      // Wenn das Review-Model noch nicht existiert, gib leeres Array zurück
      if (error.code === "P2021" || error.message?.includes("does not exist") || error.message?.includes("Review")) {
        console.warn("Review-Model existiert noch nicht in der Datenbank. Bitte Migration ausführen: npx prisma migrate dev --name add_reviews");
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(reviews);
  } catch (error: any) {
    console.error("Error fetching recent reviews:", error);
    // Bei anderen Fehlern gib leeres Array zurück statt Fehler
    return NextResponse.json([]);
  }
}
