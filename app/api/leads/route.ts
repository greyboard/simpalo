import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseAddress } from "@/lib/utils";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

// Zod Schema für Lead-Erstellung (unterstützt sowohl manuelle Erstellung als auch Webhooks)
const createLeadSchema = z.object({
  // Für manuelle Kontakt-Erstellung
  name: z.string().min(1).max(200).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  companyId: z.string().min(1, "Ungültige Firmen-ID").optional().or(z.literal("")),
  
  // Für Webhooks/Google Places
  googlePlaceId: z.string().max(255).optional(),
  businessName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(2).default("DE").optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),
  rating: z.number().min(0).max(5).optional().nullable(),
  reviewCount: z.number().int().min(0).optional().nullable(),
  category: z.string().max(200).optional(),
  businessHours: z.any().optional(), // JSON
  hasBadReviews: z.boolean().optional(),
  facebookUrl: z.string().url().max(500).optional().or(z.literal("")),
  instagramUrl: z.string().url().max(500).optional().or(z.literal("")),
  linkedinUrl: z.string().url().max(500).optional().or(z.literal("")),
  
  // Allgemein
  source: z.string().max(100).optional(),
  type: z.enum(["COMPANY", "CONTACT"]).optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  crmId: z.string().max(100).optional().or(z.literal("")),
  crmType: z.enum(["GOHIGHLEVEL", "HUBSPOT", "PIPEDRIVE", "ZAPIER"]).optional().nullable(),
  crmUrl: z.string().url().max(500).optional().or(z.literal("")),
}).refine(
  (data) => {
    // Entweder name ODER (firstName + lastName) ODER googlePlaceId muss vorhanden sein
    return (
      data.name ||
      (data.firstName && data.lastName) ||
      data.googlePlaceId ||
      data.businessName
    );
  },
  {
    message: "Name, Vor-/Nachname, Google Place ID oder Firmenname ist erforderlich",
  }
);

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
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const city = searchParams.get("city");
    const minRating = searchParams.get("minRating");
    const hasWebsite = searchParams.get("hasWebsite");
    const hasBadReviews = searchParams.get("hasBadReviews");
    const hasPoorProfile = searchParams.get("hasPoorProfile");
    const source = searchParams.get("source");
    const excludeSource = searchParams.get("excludeSource");
    const type = searchParams.get("type"); // "COMPANY" or "CONTACT"
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");

    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeParam || "10", 10) || 10));
    const skip = (page - 1) * pageSize;

    const where: any = {
      accountId: accountId, // Nur Leads des eigenen Accounts
    };

    if (status) where.status = status;
    
    // Type filtering (preferred over source)
    if (type) {
      where.type = type;
    } else if (source) {
      // Fallback to source filtering for backward compatibility
      where.source = source;
    } else if (excludeSource) {
      // Fallback to excludeSource filtering for backward compatibility
      where.source = { not: excludeSource };
    }
    
    // Company-Filter zusammenführen
    const companyWhere: any = {};
    if (category) companyWhere.category = category;
    if (city) companyWhere.city = { contains: city, mode: "insensitive" };
    if (minRating) companyWhere.rating = { gte: parseFloat(minRating) };
    if (hasWebsite === "true") companyWhere.website = { not: null };
    if (hasBadReviews === "true") companyWhere.hasBadReviews = true;
    if (hasPoorProfile === "true") companyWhere.hasPoorProfile = true;
    
    if (Object.keys(companyWhere).length > 0) {
      where.company = companyWhere;
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: {
          company: true,
          tags: {
            include: {
              tag: true,
            },
          },
          tasks: {
            where: {
              status: { in: ["PENDING", "IN_PROGRESS"] },
            },
            select: {
              id: true,
              status: true,
            },
            take: 1,
          },
          communications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        skip,
        take: pageSize,
      }),
    ]);

    const items = leads.map((lead: any) => {
      const lastCommAt = lead.communications?.[0]?.createdAt || null;
      const lastActivityAt =
        lastCommAt && new Date(lastCommAt).getTime() > new Date(lead.updatedAt).getTime()
          ? lastCommAt
          : lead.updatedAt;

      // Prüfe, ob offene Tasks vorhanden sind
      const hasOpenTasks = lead.tasks && lead.tasks.length > 0;

      // Strip the communications and tasks helper arrays to keep payload small
      const { communications, tasks, ...rest } = lead;
      return {
        ...rest,
        lastActivityAt,
        hasOpenTasks,
      };
    });

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();

    // Strikte Validierung - NUR validierte Daten verwenden
    const validatedData = createLeadSchema.parse(body);

    // Wenn companyId direkt übergeben wird (für manuelle Kontakt-Erstellung), verwende diese
    let companyId: string;
    
    if (validatedData.companyId) {
      // Prüfe, ob die Company existiert und zum Account gehört
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
        return NextResponse.json(
          { error: "Firma nicht gefunden oder gehört nicht zu Ihrem Account" },
          { status: 404 }
        );
      }

      companyId = validatedData.companyId;
    } else if (validatedData.googlePlaceId) {
      // Für Webhooks: Company erstellen oder finden
      // Prüfe, ob Company bereits existiert
      let company = await prisma.company.findUnique({
        where: { googlePlaceId: validatedData.googlePlaceId },
      });

      if (!company) {
        // Adresse parsen, wenn formatted_address vorhanden ist
        let parsedAddress: { city: string | null; zipCode: string | null; state: string | null } = { city: null, zipCode: null, state: null };
        if (validatedData.address && !validatedData.city) {
          parsedAddress = parseAddress(validatedData.address);
        }

        // Company erstellen - NUR validierte Daten verwenden
        company = await prisma.company.create({
          data: {
            name: validatedData.businessName || validatedData.name || "Unbekannt",
            businessName: validatedData.businessName || null,
            address: validatedData.address || null,
            city: validatedData.city || parsedAddress.city || null,
            zipCode: validatedData.zipCode || parsedAddress.zipCode || null,
            state: validatedData.state || parsedAddress.state || null,
            country: validatedData.country || "DE",
            phone: validatedData.phone || null,
            website: validatedData.website || null,
            googlePlaceId: validatedData.googlePlaceId,
            rating: validatedData.rating || null,
            reviewCount: validatedData.reviewCount || null,
            category: validatedData.category || null,
            businessHours: validatedData.businessHours || null,
            hasPoorProfile: !validatedData.website || !validatedData.rating,
            hasBadReviews: validatedData.hasBadReviews || false,
            facebookUrl: validatedData.facebookUrl || null,
            instagramUrl: validatedData.instagramUrl || null,
            linkedinUrl: validatedData.linkedinUrl || null,
          },
        });
      }
      companyId = company.id;
    } else {
      // Für Leads ohne googlePlaceId: Dummy-Company erstellen oder verwenden
      // Erstelle ein Company mit generierter ID
      const dummyPlaceId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      let parsedAddress: { city: string | null; zipCode: string | null; state: string | null } = { city: null, zipCode: null, state: null };
      if (validatedData.address && !validatedData.city) {
        parsedAddress = parseAddress(validatedData.address);
      }

      // Company erstellen - NUR validierte Daten verwenden
      const company = await prisma.company.create({
        data: {
          name: validatedData.businessName || validatedData.name || "Unbekannt",
          businessName: validatedData.businessName || null,
          address: validatedData.address || null,
          city: validatedData.city || parsedAddress.city || null,
          zipCode: validatedData.zipCode || parsedAddress.zipCode || null,
          state: validatedData.state || parsedAddress.state || null,
          country: validatedData.country || "DE",
          phone: validatedData.phone || null,
          website: validatedData.website || null,
          googlePlaceId: dummyPlaceId,
        },
      });
      companyId = company.id;
    }

    // Source setzen, wenn nicht vorhanden
    const source = validatedData.source || "Google Places";

    // Type basierend auf source setzen (Standard: CONTACT)
    const leadType = source === "Google Places" ? "COMPANY" : (validatedData.type || "CONTACT");

    // Name bestimmen
    const leadName = validatedData.name || 
      (validatedData.firstName && validatedData.lastName 
        ? `${validatedData.firstName} ${validatedData.lastName}` 
        : validatedData.businessName || "Unbekannt");

    // Status bestimmen
    const leadStatus = validatedData.status || "NEW";

    // Lead erstellen - NUR validierte Daten verwenden
    const lead = await prisma.lead.create({
      data: {
        name: leadName,
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        accountId: accountId,
        companyId: companyId,
        source: source,
        type: leadType,
        status: leadStatus,
        priority: validatedData.priority || "MEDIUM",
        crmId: validatedData.crmId || null,
        crmType: validatedData.crmType ?? null,
        crmUrl: validatedData.crmUrl || null,
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

    // Erstelle automatisch eine Task "Lead kontaktieren", wenn Status NEW ist und Type CONTACT
    if (leadStatus === "NEW" && leadType === "CONTACT") {
      try {
        const { createContactTaskForLead } = await import("@/lib/actions/tasks");
        await createContactTaskForLead(lead.id);
      } catch (taskError) {
        // Fehler beim Erstellen der Task sollte Lead-Erstellung nicht blockieren
        console.error("Error creating contact task:", taskError);
      }
    }

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Sichere Fehlerbehandlung - keine Systemdetails preisgeben
      const firstError = error.errors[0];
      return NextResponse.json(
        { error: firstError?.message || "Ungültige Eingaben" },
        { status: 400 }
      );
    }

    console.error("Error creating lead:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Lead oder Company existiert bereits" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Erstellen des Leads" },
      { status: 500 }
    );
  }
}