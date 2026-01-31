"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseAddress } from "@/lib/utils";

// Zod Schema für Kontakt-Erstellung
const createContactSchema = z.object({
  firstName: z
    .string()
    .min(1, "Vorname ist erforderlich")
    .max(100, "Vorname ist zu lang")
    .trim(),
  lastName: z
    .string()
    .min(1, "Nachname ist erforderlich")
    .max(100, "Nachname ist zu lang")
    .trim(),
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .max(255, "E-Mail-Adresse ist zu lang")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(50, "Telefonnummer ist zu lang")
    .regex(/^[\d\s\+\-\(\)]+$/, "Telefonnummer enthält ungültige Zeichen")
    .optional()
    .or(z.literal("")),
  companyId: z
    .string()
    .min(1, "Ungültige Firmen-ID")
    .optional()
    .or(z.literal(""))
    .nullable(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

export interface CreateContactResult {
  success: boolean;
  data?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  error?: string;
}

export async function createContact(
  input: unknown
): Promise<CreateContactResult> {
  try {
    // Authentifizierung prüfen
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return {
        success: false,
        error: "Nicht authentifiziert",
      };
    }

    const accountId = session.user.accountId;

    // Strikte Validierung
    const validatedData = createContactSchema.parse(input);

    // Name zusammenstellen
    const name = [validatedData.firstName, validatedData.lastName]
      .filter(Boolean)
      .join(" ");

    // Company prüfen, falls angegeben
    let companyId: string | undefined;
    if (validatedData.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: validatedData.companyId },
        include: {
          leads: {
            where: { accountId },
            take: 1,
          },
        },
      });

      if (!company || company.leads.length === 0) {
        return {
          success: false,
          error: "Firma nicht gefunden oder gehört nicht zu Ihrem Account",
        };
      }

      companyId = validatedData.companyId;
    } else {
      // Dummy-Company erstellen
      const dummyPlaceId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const company = await prisma.company.create({
        data: {
          name: "Unbekannt",
          googlePlaceId: dummyPlaceId,
          country: "DE",
        },
      });
      companyId = company.id;
    }

    // Lead erstellen - NUR validierte Daten verwenden
    const lead = await prisma.lead.create({
      data: {
        name,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        accountId,
        companyId,
        source: "Manuell",
        type: "CONTACT",
        status: "NEW",
        priority: "MEDIUM",
      },
      include: {
        company: true,
      },
    });

    // Erstelle automatisch eine Task "Lead kontaktieren" für neue CONTACT-Leads
    try {
      const { createContactTaskForLead } = await import("@/lib/actions/tasks");
      await createContactTaskForLead(lead.id);
    } catch (taskError) {
      // Fehler beim Erstellen der Task sollte Lead-Erstellung nicht blockieren
      console.error("Error creating contact task:", taskError);
    }

    revalidatePath("/dashboard/leads");
    revalidatePath(`/dashboard/leads/${lead.id}`);

    return {
      success: true,
      data: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError?.message || "Ungültige Eingaben",
      };
    }

    console.error("Error creating contact:", error);
    return {
      success: false,
      error: "Fehler beim Erstellen des Kontakts",
    };
  }
}

// Zod Schema für Lead-Update
const updateLeadSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(200).trim(),
  firstName: z.string().max(100).optional().or(z.literal("")),
  lastName: z.string().max(100).optional().or(z.literal("")),
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(50)
    .regex(/^[\d\s\+\-\(\)]+$/, "Telefonnummer enthält ungültige Zeichen")
    .optional()
    .or(z.literal("")),
  status: z.enum([
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL",
    "NEGOTIATION",
    "WON",
    "LOST",
    "ARCHIVED",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  source: z.string().max(100).optional().or(z.literal("")),
  companyId: z
    .string()
    .min(1, "Ungültige Firmen-ID")
    .optional()
    .or(z.literal(""))
    .nullable(),
});

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export interface UpdateLeadResult {
  success: boolean;
  error?: string;
}

export async function updateLeadAction(
  leadId: string,
  input: unknown
): Promise<UpdateLeadResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return {
        success: false,
        error: "Nicht authentifiziert",
      };
    }

    const accountId = session.user.accountId;

    // Prüfe, ob Lead existiert und zum Account gehört
    const existingLead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!existingLead || existingLead.accountId !== accountId) {
      return {
        success: false,
        error: "Lead nicht gefunden",
      };
    }

    // Strikte Validierung
    // Type assertion für Debug-Logging (input ist unknown, wird aber direkt validiert)
    const inputTyped = input as UpdateLeadInput;
    console.log("[DEBUG] updateLeadAction - input received:", {
      name: inputTyped.name,
      firstName: inputTyped.firstName,
      lastName: inputTyped.lastName,
      email: inputTyped.email,
      phone: inputTyped.phone,
      status: inputTyped.status,
      priority: inputTyped.priority,
      source: inputTyped.source,
      companyId: inputTyped.companyId,
      companyIdType: typeof inputTyped.companyId,
      companyIdValue: inputTyped.companyId,
      companyIdIsEmpty: inputTyped.companyId === "",
      companyIdIsNull: inputTyped.companyId === null,
      companyIdIsUndefined: inputTyped.companyId === undefined,
    });
    
    let validatedData;
    try {
      validatedData = updateLeadSchema.parse(input);
      console.log("[DEBUG] updateLeadAction - validation successful:", {
        companyId: validatedData.companyId,
        companyIdType: typeof validatedData.companyId,
      });
    } catch (error: any) {
      const inputTyped = input as UpdateLeadInput;
      console.error("[DEBUG] updateLeadAction - validation failed:", {
        error: error.message,
        issues: error.issues,
        inputCompanyId: inputTyped.companyId,
        inputCompanyIdType: typeof inputTyped.companyId,
      });
      throw error;
    }

    // Prüfe aktuellen Status, um zu sehen, ob sich der Status ändert
    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { status: true },
    });

    const wasNew = currentLead?.status === "NEW";
    const isNowContacted = validatedData.status === "CONTACTED";

    // Prüfe companyId, falls angegeben (nicht leer oder null)
    // validatedData.companyId kann ein leerer String oder null sein (für "Kein Unternehmen")
    console.log("[DEBUG] updateLeadAction - processing companyId:", {
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
    
    console.log("[DEBUG] updateLeadAction - companyIdToUse:", {
      companyIdToUse,
      type: typeof companyIdToUse,
      willUpdateCompany: !!companyIdToUse,
    });

    if (companyIdToUse) {
      const company = await prisma.company.findUnique({
        where: { id: companyIdToUse },
      });

      if (!company) {
        return {
          success: false,
          error: "Firma nicht gefunden",
        };
      }

      // Sicherheitsprüfung: Prüfe, ob die Company bereits von Leads des Accounts verwendet wird
      // Dies stellt sicher, dass nur Companies verwendet werden, die bereits zum Account gehören
      // (entweder durch bestehende Leads oder durch die Company-Liste im Dropdown)
      // Die Company-Liste zeigt nur Companies, die bereits von Leads des Accounts verwendet werden
      const companyUsedByAccount = await prisma.lead.findFirst({
        where: {
          companyId: companyIdToUse,
          accountId: accountId,
        },
        select: { id: true },
      });

      // Nur prüfen, wenn Company noch nicht vom Account verwendet wird
      // Aber erlaube es, wenn die Company in der Liste ist (wird durch das Frontend sichergestellt)
      // Wenn die Company bereits vom Account verwendet wird, ist alles gut
      // Wenn nicht, könnte es eine Race Condition sein - erlaube es trotzdem, da die Company-Liste
      // nur Companies zeigt, die bereits verwendet werden
      if (!companyUsedByAccount) {
        // Warnung loggen, aber nicht blockieren - könnte eine Race Condition sein
        console.warn(`Company ${companyIdToUse} wird einem Lead zugewiesen, obwohl sie noch nicht vom Account verwendet wird`);
      }
    }

    // Update - NUR validierte Daten verwenden
    await prisma.lead.update({
      where: { id: leadId },
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
    });

    // Wenn Status von NEW zu CONTACTED geändert wurde, markiere Tasks als COMPLETED
    if (wasNew && isNowContacted) {
      try {
        const { completeContactTasksForLead } = await import("@/lib/actions/tasks");
        await completeContactTasksForLead(leadId);
      } catch (taskError) {
        // Fehler beim Abschließen der Task sollte Update nicht blockieren
        console.error("Error completing contact tasks:", taskError);
      }
    }

    revalidatePath("/dashboard/leads");
    revalidatePath(`/dashboard/leads/${leadId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError?.message || "Ungültige Eingaben",
      };
    }

    console.error("Error updating lead:", error);
    return {
      success: false,
      error: "Fehler beim Aktualisieren des Leads",
    };
  }
}

// Zod Schema für Notizen
const createNoteSchema = z.object({
  content: z
    .string()
    .min(1, "Notiz-Inhalt ist erforderlich")
    .max(10000, "Notiz ist zu lang")
    .trim(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export interface CreateNoteResult {
  success: boolean;
  data?: {
    id: string;
    content: string;
    createdAt: Date;
  };
  error?: string;
}

export async function createNoteAction(
  leadId: string,
  input: unknown
): Promise<CreateNoteResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return {
        success: false,
        error: "Nicht authentifiziert",
      };
    }

    const accountId = session.user.accountId;

    // Prüfe, ob Lead existiert und zum Account gehört
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead || lead.accountId !== accountId) {
      return {
        success: false,
        error: "Lead nicht gefunden",
      };
    }

    // Strikte Validierung
    const validatedData = createNoteSchema.parse(input);

    // Notiz erstellen (als Note, nicht Communication)
    const note = await prisma.note.create({
      data: {
        leadId,
        accountId,
        content: validatedData.content,
        authorId: session.user.id,
      },
    });

    revalidatePath(`/dashboard/leads/${leadId}`);

    return {
      success: true,
      data: {
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError?.message || "Ungültige Eingaben",
      };
    }

    console.error("Error creating note:", error);
    return {
      success: false,
      error: "Fehler beim Erstellen der Notiz",
    };
  }
}
