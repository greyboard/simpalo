import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { logSecurityEvent, getClientIp, getUserAgent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/profile
 * Gibt das Profil des aktuellen Benutzers zurück
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        account: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        settings: {
          select: {
            settings: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Fehler beim Abrufen des Profils" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/profile
 * Aktualisiert das Profil des aktuellen Benutzers
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    // Name aktualisieren
    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    // E-Mail aktualisieren (mit Duplikat-Prüfung)
    if (body.email !== undefined && body.email !== session.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Diese E-Mail-Adresse ist bereits vergeben" },
          { status: 400 }
        );
      }

      updateData.email = body.email;
    }

    // Passwort aktualisieren (nur wenn neues Passwort angegeben)
    if (body.password && body.password.trim() !== "") {
      if (body.password.length < 8) {
        return NextResponse.json(
          { error: "Passwort muss mindestens 8 Zeichen lang sein" },
          { status: 400 }
        );
      }

      // Altes Passwort prüfen, falls angegeben
      if (body.currentPassword) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { password: true },
        });

        if (!user?.password) {
          return NextResponse.json(
            { error: "Aktuelles Passwort ist erforderlich" },
            { status: 400 }
          );
        }

        const isValid = await bcrypt.compare(body.currentPassword, user.password);
        if (!isValid) {
          return NextResponse.json(
            { error: "Aktuelles Passwort ist falsch" },
            { status: 400 }
          );
        }
      }

      updateData.password = await bcrypt.hash(body.password, 10);
    }

    const passwordChanged = body.password && body.password.trim() !== "";

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        accountId: true,
      },
    });

    // Log Security Event für Passwort-Änderung (nicht-blockierend)
    if (passwordChanged) {
      logSecurityEvent({
        userId: session.user.id,
        accountId: updatedUser.accountId,
        eventType: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: session.user.id,
        description: `Passwort geändert: ${session.user.email}`,
        metadata: {
          userEmail: session.user.email,
          changedBySelf: true,
        },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      }).catch((err) => console.error("Error logging security event:", err));
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Profils" },
      { status: 500 }
    );
  }
}
