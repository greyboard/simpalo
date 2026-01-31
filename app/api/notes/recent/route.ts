import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/notes/recent
 * Ruft die neuesten Notizen ab (für Dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const notes = await prisma.note.findMany({
      include: {
        lead: {
          include: {
            company: {
              select: {
                name: true,
                businessName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching recent notes:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Notizen" },
      { status: 500 }
    );
  }
}
