import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * DELETE /api/leads/[id]/tags/[tagId]
 * Entfernt einen Tag von einem Lead
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; tagId: string } }
) {
  try {
    // Prüfe, ob LeadTag existiert
    const leadTag = await prisma.leadTag.findUnique({
      where: {
        leadId_tagId: {
          leadId: params.id,
          tagId: params.tagId,
        },
      },
    });

    if (!leadTag) {
      return NextResponse.json(
        { error: "Tag-Zuordnung nicht gefunden" },
        { status: 404 }
      );
    }

    // Entferne Tag von Lead
    await prisma.leadTag.delete({
      where: {
        leadId_tagId: {
          leadId: params.id,
          tagId: params.tagId,
        },
      },
    });

    // Aktualisiere Lead updatedAt
    await prisma.lead.update({
      where: { id: params.id },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing tag from lead:", error);
    return NextResponse.json(
      { error: "Fehler beim Entfernen des Tags" },
      { status: 500 }
    );
  }
}
