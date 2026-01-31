import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateCommunicationSchema = z.object({
  subject: z.string().max(500).trim().optional().nullable(),
  content: z.string().min(1, "Inhalt ist erforderlich").max(10000).trim(),
  status: z.string().max(50).trim().optional().nullable(),
});

/**
 * PATCH /api/leads/[id]/communications/[commId]
 * Aktualisiert einen Communication-Eintrag (z.B. Call-Notiz nachreichen)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; commId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const accountId = session.user.accountId;
    const body = await request.json();
    const validated = updateCommunicationSchema.parse(body);

    const lead = await prisma.lead.findFirst({
      where: { id: params.id, accountId },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });
    }

    const existing = await prisma.communication.findFirst({
      where: { id: params.commId, leadId: lead.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Kommunikation nicht gefunden" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const comm = await tx.communication.update({
        where: { id: params.commId },
        data: {
          subject: validated.subject ?? undefined,
          content: validated.content,
          status: validated.status ?? undefined,
          metadata: {
            type: "manual",
            updatedAt: new Date().toISOString(),
            updatedByUserId: session.user.id,
            updatedByName: session.user.name || null,
          },
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { updatedAt: new Date() },
      });

      return comm;
    });

    return NextResponse.json({ success: true, communication: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const first = error.errors?.[0];
      return NextResponse.json({ error: first?.message || "Ungültige Eingaben" }, { status: 400 });
    }
    console.error("Error updating communication:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Aktualisieren der Kommunikation" },
      { status: 500 }
    );
  }
}

