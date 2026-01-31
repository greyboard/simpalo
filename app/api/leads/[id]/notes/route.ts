import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

// Zod Schema für Notizen
const createNoteSchema = z.object({
  content: z
    .string()
    .min(1, "Notizinhalt ist erforderlich")
    .max(10000, "Notiz ist zu lang (max. 10000 Zeichen)")
    .trim(),
});

/**
 * POST /api/leads/[id]/notes
 * Erstellt eine neue Notiz für einen Lead
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
    const body = await request.json();

    // Strikte Validierung - NUR validierte Daten verwenden
    const validatedData = createNoteSchema.parse(body);

    // Prüfe, ob der Lead existiert und zum Account gehört
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

    // Erstelle die Notiz und aktualisiere das Lead in einer Transaktion
    // Das führt dazu, dass updatedAt des Leads automatisch aktualisiert wird
    const result = await prisma.$transaction(async (tx) => {
      // Erstelle die Notiz - NUR validierte Daten verwenden
      const note = await tx.note.create({
        data: {
          leadId: params.id,
          accountId: accountId,
          content: validatedData.content,
          authorId: session.user.id,
        },
      });

      // Aktualisiere das Lead (updatedAt wird automatisch von Prisma aktualisiert durch @updatedAt)
      // Wir setzen einen vorhandenen Wert neu, um sicherzustellen, dass das Update durchgeführt wird
      await tx.lead.update({
        where: { id: params.id },
        data: {
          updatedAt: new Date(),
        },
      });

      return note;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Sichere Fehlerbehandlung - keine Systemdetails preisgeben
      const firstError = error.errors[0];
      return NextResponse.json(
        { error: firstError?.message || "Ungültige Eingaben" },
        { status: 400 }
      );
    }

    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Notiz" },
      { status: 500 }
    );
  }
}
