import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * DELETE /api/leads/[id]/notes/[noteId]
 * Löscht eine Notiz
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    // Prüfe, ob die Notiz existiert und zu diesem Lead gehört
    const note = await prisma.note.findFirst({
      where: {
        id: params.noteId,
        leadId: params.id,
      },
    });

    if (!note) {
      return NextResponse.json(
        { error: "Notiz nicht gefunden" },
        { status: 404 }
      );
    }

    // Lösche die Notiz und aktualisiere das Lead in einer Transaktion
    await prisma.$transaction(async (tx) => {
      // Lösche die Notiz
      await tx.note.delete({
        where: { id: params.noteId },
      });

      // Aktualisiere das Lead (updatedAt wird automatisch von Prisma aktualisiert durch @updatedAt)
      // Wir setzen updatedAt explizit, um sicherzustellen, dass das Update durchgeführt wird
      await tx.lead.update({
        where: { id: params.id },
        data: {
          updatedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Notiz" },
      { status: 500 }
    );
  }
}
