import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/tags
 * Ruft alle verfügbaren Tags ab
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
    const tags = await prisma.tag.findMany({
      where: {
        accountId: accountId,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Tags" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tags
 * Erstellt einen neuen Tag
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
    const { name, color } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Tag-Name ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe, ob Tag bereits existiert (pro Account)
    const existingTag = await prisma.tag.findFirst({
      where: { 
        name: name.trim(),
        accountId: accountId,
      },
    });

    if (existingTag) {
      return NextResponse.json(existingTag);
    }

    // Erstelle neuen Tag
    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color: color || "#3B82F6",
        accountId: accountId,
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error: any) {
    console.error("Error creating tag:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Tag mit diesem Namen existiert bereits" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Erstellen des Tags" },
      { status: 500 }
    );
  }
}
