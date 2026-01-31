import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * POST /api/leads/[id]/tags
 * Fügt einen Tag zu einem Lead hinzu
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const { tagId, tagName } = await request.json();

    // Prüfe, ob Lead existiert und zum Account gehört
    const lead = await prisma.lead.findFirst({
      where: { 
        id: params.id,
        accountId: accountId,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead nicht gefunden" },
        { status: 404 }
      );
    }

    let tag;
    
    // Wenn tagName angegeben, erstelle oder finde Tag
    if (tagName) {
      tag = await prisma.tag.upsert({
        where: { 
          accountId_name: {
            accountId: accountId,
            name: tagName.trim(),
          },
        },
        update: {},
        create: {
          name: tagName.trim(),
          color: "#3B82F6",
          accountId: accountId,
        },
      });
    } else if (tagId) {
      // Wenn tagId angegeben, finde Tag (nur vom eigenen Account)
      tag = await prisma.tag.findFirst({
        where: { 
          id: tagId,
          accountId: accountId,
        },
      });

      if (!tag) {
        return NextResponse.json(
          { error: "Tag nicht gefunden" },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "tagId oder tagName ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe, ob Tag bereits zugeordnet ist
    const existingLeadTag = await prisma.leadTag.findUnique({
      where: {
        leadId_tagId: {
          leadId: params.id,
          tagId: tag.id,
        },
      },
    });

    if (existingLeadTag) {
      return NextResponse.json(existingLeadTag);
    }

    // Füge Tag zu Lead hinzu
    const leadTag = await prisma.leadTag.create({
      data: {
        leadId: params.id,
        tagId: tag.id,
      },
      include: {
        tag: true,
      },
    });

    // Aktualisiere Lead updatedAt
    await prisma.lead.update({
      where: { id: params.id },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(leadTag, { status: 201 });
  } catch (error: any) {
    console.error("Error adding tag to lead:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Tag ist bereits zugeordnet" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Hinzufügen des Tags" },
      { status: 500 }
    );
  }
}
