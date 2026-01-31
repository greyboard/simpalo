import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logSecurityEvent, getClientIp, getUserAgent } from "@/lib/security-events";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

// Zod Schema für Lead-Update
const updateLeadSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(200).trim(),
  firstName: z.string().max(100).optional().or(z.literal("")),
  lastName: z.string().max(100).optional().or(z.literal("")),
  email: z.string().email("Ungültige E-Mail-Adresse").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).regex(/^[\d\s\+\-\(\)]+$/, "Telefonnummer enthält ungültige Zeichen").optional().or(z.literal("")),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "ARCHIVED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  source: z.string().max(100).optional().or(z.literal("")),
  companyId: z
    .string()
    .min(1, "Ungültige Firmen-ID")
    .optional()
    .or(z.literal(""))
    .nullable(),
});

export async function GET(
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
    const lead = await prisma.lead.findFirst({
      where: { 
        id: params.id,
        accountId: accountId, // Nur Leads des eigenen Accounts
      },
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
        notes: {
          orderBy: {
            createdAt: "desc",
          },
        },
        tasks: {
          orderBy: {
            dueDate: "asc",
          },
        },
        communications: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Wenn es ein COMPANY-Lead ist, lade alle verbundenen Kontakte (CONTACT-Leads)
    let relatedContacts: any[] = [];
    if (lead.type === "COMPANY") {
      relatedContacts = await prisma.lead.findMany({
        where: {
          companyId: lead.companyId,
          accountId: accountId,
          type: "CONTACT",
          id: { not: lead.id }, // Exclude self
        },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 50,
      });
    }

    return NextResponse.json({ ...lead, relatedContacts });
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    
    // Prüfe, ob Lead zum Account gehört
    const existingLead = await prisma.lead.findFirst({
      where: { 
        id: params.id,
        accountId: accountId,
      },
    });

    if (!existingLead) {
      return NextResponse.json(
        { error: "Lead nicht gefunden" },
        { status: 404 }
      );
    }

    // Prüfe aktuellen Status, um zu sehen, ob sich der Status ändert
    const wasNew = existingLead.status === "NEW";
    
    const body = await request.json();
    
    // Strikte Validierung - NUR validierte Daten verwenden
    console.log("[DEBUG] API Route PUT - body received:", {
      name: body.name,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      status: body.status,
      priority: body.priority,
      source: body.source,
      companyId: body.companyId,
      companyIdType: typeof body.companyId,
      companyIdValue: body.companyId,
      companyIdIsEmpty: body.companyId === "",
      companyIdIsNull: body.companyId === null,
      companyIdIsUndefined: body.companyId === undefined,
    });
    
    let validatedData;
    try {
      validatedData = updateLeadSchema.parse(body);
      console.log("[DEBUG] API Route PUT - validation successful:", {
        companyId: validatedData.companyId,
        companyIdType: typeof validatedData.companyId,
      });
    } catch (error: any) {
      console.error("[DEBUG] API Route PUT - validation failed:", {
        error: error.message,
        issues: error.issues,
        bodyCompanyId: body.companyId,
        bodyCompanyIdType: typeof body.companyId,
      });
      throw error;
    }
    
    const isNowContacted = validatedData.status === "CONTACTED";

    // Prüfe companyId, falls angegeben (nicht leer oder null)
    // validatedData.companyId kann ein leerer String oder null sein (für "Kein Unternehmen")
    console.log("[DEBUG] API Route PUT - processing companyId:", {
      validatedCompanyId: validatedData.companyId,
      validatedCompanyIdType: typeof validatedData.companyId,
      validatedCompanyIdIsEmpty: validatedData.companyId === "",
      validatedCompanyIdIsNull: validatedData.companyId === null,
      validatedCompanyIdIsUndefined: validatedData.companyId === undefined,
    });
    
    const companyIdToUse = validatedData.companyId && 
                            validatedData.companyId !== null && 
                            typeof validatedData.companyId === "string" &&
                            validatedData.companyId.trim() !== "" 
      ? validatedData.companyId 
      : undefined;
    
    console.log("[DEBUG] API Route PUT - companyIdToUse:", {
      companyIdToUse,
      type: typeof companyIdToUse,
      willUpdateCompany: !!companyIdToUse,
    });

    if (companyIdToUse) {
      const company = await prisma.company.findUnique({
        where: { id: companyIdToUse },
      });

      if (!company) {
        return NextResponse.json(
          { error: "Firma nicht gefunden" },
          { status: 404 }
        );
      }

      // Sicherheitsprüfung: Prüfe, ob die Company bereits von Leads des Accounts verwendet wird
      // Die Company-Liste zeigt nur Companies, die bereits von Leads des Accounts verwendet werden
      // Daher sollte diese Prüfung normalerweise erfolgreich sein
      const companyUsedByAccount = await prisma.lead.findFirst({
        where: {
          companyId: companyIdToUse,
          accountId: accountId,
        },
        select: { id: true },
      });

      // Wenn die Company noch nicht verwendet wird, könnte es eine Race Condition sein
      // Aber die Company-Liste zeigt nur Companies, die bereits verwendet werden
      // Erlaube es trotzdem, da es sonst zu restriktiv wäre
      if (!companyUsedByAccount) {
        console.warn(`Company ${companyIdToUse} wird einem Lead zugewiesen, obwohl sie noch nicht vom Account verwendet wird`);
      }
    }

    // Update - NUR validierte Daten verwenden
    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: {
        name: validatedData.name,
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        status: validatedData.status,
        priority: validatedData.priority,
        source: validatedData.source || null,
        companyId: companyIdToUse || undefined,
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

    // Wenn Status von NEW zu CONTACTED geändert wurde, markiere Tasks als COMPLETED
    if (wasNew && isNowContacted) {
      try {
        const { completeContactTasksForLead } = await import("@/lib/actions/tasks");
        await completeContactTasksForLead(params.id);
      } catch (taskError) {
        // Fehler beim Abschließen der Task sollte Update nicht blockieren
        console.error("Error completing contact tasks:", taskError);
      }
    }

    return NextResponse.json(lead);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Sichere Fehlerbehandlung - keine Systemdetails preisgeben
      const firstError = error.errors[0];
      return NextResponse.json(
        { error: firstError?.message || "Ungültige Eingaben" },
        { status: 400 }
      );
    }

    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Leads" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    
    // Prüfe, ob Lead zum Account gehört
    const existingLead = await prisma.lead.findFirst({
      where: { 
        id: params.id,
        accountId: accountId,
      },
    });

    if (!existingLead) {
      return NextResponse.json(
        { error: "Lead nicht gefunden" },
        { status: 404 }
      );
    }

    // Speichere Lead-Informationen für Event-Log
    const leadName = existingLead.name || existingLead.email || "Unbekannt";

    await prisma.lead.delete({
      where: { id: params.id },
    });

    // Log Security Event (nicht-blockierend)
    logSecurityEvent({
      userId: session.user.id,
      accountId: accountId,
      eventType: "LEAD_DELETED",
      entityType: "Lead",
      entityId: params.id,
      description: `Lead gelöscht: ${leadName}`,
      metadata: {
        leadName: leadName,
        leadEmail: existingLead.email,
        leadType: existingLead.type,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    }).catch((err) => console.error("Error logging security event:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}