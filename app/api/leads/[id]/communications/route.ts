import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createCommunicationSchema = z.object({
  type: z.enum(["EMAIL", "SMS", "CALL", "NOTE"]),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  subject: z.string().max(500).trim().optional().nullable(),
  content: z.string().min(1, "Inhalt ist erforderlich").max(10000).trim(),
  status: z.string().max(50).trim().optional().nullable(),
  phone: z
    .string()
    .max(50)
    .trim()
    .optional()
    .nullable(),
  phoneLabel: z
    .string()
    .max(50)
    .trim()
    .optional()
    .nullable(),
});

/**
 * POST /api/leads/[id]/communications
 * Erstellt einen manuellen Communication-Eintrag (z.B. für eingehende E-Mail-Antworten)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;
    const body = await request.json();
    const validated = createCommunicationSchema.parse(body);

    // Prüfe ob Lead existiert und zum Account gehört
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

    const inferredStatus =
      validated.status ??
      (validated.type === "CALL" && validated.direction === "OUTBOUND"
        ? "reached"
        : validated.direction === "INBOUND"
          ? "received"
          : "sent");

    // Erstelle Communication + aktualisiere Lead.updatedAt in einer Transaktion
    const communication = await prisma.$transaction(async (tx) => {
      const created = await tx.communication.create({
        data: {
          leadId: lead.id,
          type: validated.type,
          direction: validated.direction,
          subject: validated.subject || null,
          content: validated.content,
          status: inferredStatus,
          metadata: {
            type: "manual",
            addedAt: new Date().toISOString(),
            createdByUserId: session.user.id,
            createdByName: session.user.name || null,
            phone: validated.phone || null,
            phoneLabel: validated.phoneLabel || null,
          },
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { updatedAt: new Date() },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      communication: communication,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const first = error.errors?.[0];
      return NextResponse.json(
        { error: first?.message || "Ungültige Eingaben" },
        { status: 400 }
      );
    }
    console.error("Error creating communication:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Erstellen der Kommunikation" },
      { status: 500 }
    );
  }
}
