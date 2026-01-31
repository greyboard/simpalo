import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { isSuperadminEmail } from "@/lib/superadmin";
import { SecurityEventType } from "@prisma/client";
import { logSecurityEvent, getClientIp, getUserAgent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

const updateAccountSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  country: z.string().optional(),
  website: z.string().optional().nullable(),
});

/**
 * PUT /api/admin/accounts/[id]
 * Update account (Superadmin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateAccountSchema.parse(body);

    // Hole Account-Informationen vor dem Update
    const existingAccount = await prisma.account.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Account nicht gefunden" },
        { status: 404 }
      );
    }

    const isActiveChanged = validatedData.isActive !== undefined && validatedData.isActive !== existingAccount.isActive;

    const account = await prisma.account.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            leads: true,
            users: true,
            webhooks: true,
          },
        },
      },
    });

    // Log Security Event für Account-Aktivierung/Deaktivierung (nicht-blockierend)
    if (isActiveChanged) {
      const eventType = validatedData.isActive ? SecurityEventType.ACCOUNT_ACTIVATED : SecurityEventType.ACCOUNT_DEACTIVATED;
      logSecurityEvent({
        userId: session.user.id,
        accountId: params.id, // Account, der aktiviert/deaktiviert wurde
        eventType: eventType,
        entityType: "Account",
        entityId: params.id,
        description: `Account ${validatedData.isActive ? "aktiviert" : "deaktiviert"}: ${existingAccount.name}`,
        metadata: {
          accountName: existingAccount.name,
        },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      }).catch((err) => console.error("Error logging security event:", err));
    }

    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Daten", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Accounts" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/accounts/[id]
 * Get account details (Superadmin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const account = await prisma.account.findUnique({
      where: { id: params.id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            leads: true,
            users: true,
            webhooks: true,
            campaigns: true,
            tags: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error fetching account:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Accounts" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/accounts/[id]
 * Delete account (Superadmin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    if (session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Hole Account-Informationen vor dem Löschen
    const existingAccount = await prisma.account.findUnique({
      where: { id: params.id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Account nicht gefunden" },
        { status: 404 }
      );
    }

    // Prüfe ob einer der User Superadmin ist - dieser Account darf nicht gelöscht werden
    const hasMainAdmin = existingAccount.users.some(
      (u) => isSuperadminEmail(u.email)
    );

    if (hasMainAdmin) {
      return NextResponse.json(
        { error: "Der Superadmin Account kann nicht gelöscht werden" },
        { status: 403 }
      );
    }

    // Logge Security Event vor dem Löschen (nicht-blockierend)
    logSecurityEvent({
      userId: session.user.id,
      accountId: params.id,
      eventType: SecurityEventType.ACCOUNT_DELETED,
      entityType: "Account",
      entityId: params.id,
      description: `Account gelöscht: ${existingAccount.name}`,
      metadata: {
        accountName: existingAccount.name,
        accountSlug: existingAccount.slug,
        userCount: existingAccount.users.length,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    }).catch((err) => console.error("Error logging security event:", err));

    // Lösche Account (Cascade löscht automatisch alle zugehörigen Daten)
    await prisma.account.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: `Account "${existingAccount.name}" wurde erfolgreich gelöscht`,
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    
    // Prisma Fehler behandeln
    if (error instanceof Error && error.message.includes("Foreign key constraint")) {
      return NextResponse.json(
        { error: "Account kann nicht gelöscht werden, da noch Abhängigkeiten existieren" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Löschen des Accounts" },
      { status: 500 }
    );
  }
}
