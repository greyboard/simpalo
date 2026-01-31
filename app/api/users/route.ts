import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createUserSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein"),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

/**
 * GET /api/users
 * Gibt alle Benutzer des Accounts zurück
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    // Nur OWNER, ADMIN und SUPERADMIN können Benutzer sehen
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        accountId: session.user.accountId,
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
 * POST /api/users
 * Erstellt einen neuen Benutzer für den Account
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    // Nur OWNER, ADMIN und SUPERADMIN können Benutzer erstellen
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

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
        accountId: session.user.accountId,
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
