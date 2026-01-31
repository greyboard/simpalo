import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/accounts
 * List all accounts (Superadmin only)
 */
export async function GET(request: NextRequest) {
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

    const accounts = await prisma.account.findMany({
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
            securityEvents: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Füge Count für Kontakte hinzu (nur CONTACT-Leads, keine COMPANY-Leads)
    const accountsWithContactCounts = await Promise.all(
      accounts.map(async (account) => {
        const contactsCount = await prisma.lead.count({
          where: {
            accountId: account.id,
            type: "CONTACT",
          },
        });

        return {
          ...account,
          _count: {
            ...account._count,
            contactsCount,
          },
        };
      })
    );

    return NextResponse.json(accountsWithContactCounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Accounts" },
      { status: 500 }
    );
  }
}
