import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isSuperadminEmail } from "@/lib/superadmin";

const createUserSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein"),
  role: z.enum(["USER", "ADMIN", "OWNER", "SUPERADMIN"]).optional(),
});

/**
 * GET /api/admin/accounts/[id]/users
 * List all users for a specific account (Superadmin only)
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

    const users = await prisma.user.findMany({
      where: {
        accountId: params.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen der Benutzer" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/accounts/[id]/users
 * Create a new user for a specific account (Superadmin only)
 */
export async function POST(
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

    // Check if account exists
    const account = await prisma.account.findUnique({
      where: { id: params.id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account nicht gefunden" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Prüfe ob SUPERADMIN-Rolle vergeben werden soll - nur Superadmin darf das
    if (validatedData.role === "SUPERADMIN" && !isSuperadminEmail(session.user.email)) {
      return NextResponse.json(
        { error: "Nur der Hauptadministrator darf Superadmins erstellen" },
        { status: 403 }
      );
    }

    // Prüfe ob E-Mail bereits existiert
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert" },
        { status: 400 }
      );
    }

    // Hash Passwort
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Erstelle neuen Benutzer
    const newUser = await prisma.user.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
        password: hashedPassword,
        accountId: params.id,
        role: validatedData.role || "USER",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Erstelle UserSettings
    await prisma.userSettings.create({
      data: {
        userId: newUser.id,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingaben", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Benutzers" },
      { status: 500 }
    );
  }
}
