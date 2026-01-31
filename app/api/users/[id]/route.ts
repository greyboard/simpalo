import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { logSecurityEvent, getClientIp, getUserAgent } from "@/lib/security-events";
import { isSuperadminEmail } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

/**
 * PUT /api/users/[id]
 * Aktualisiert einen Benutzer
 */
export async function PUT(
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

    // Nur OWNER, ADMIN und SUPERADMIN können Benutzer aktualisieren
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    // Prüfe ob Benutzer zum Account gehört
    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        accountId: session.user.accountId,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    // Superadmin kann nicht geändert werden (außer durch sich selbst)
    if (isSuperadminEmail(existingUser.email) && !isSuperadminEmail(session.user.email)) {
      return NextResponse.json(
        { error: "Der Hauptadministrator kann nicht geändert werden" },
        { status: 403 }
      );
    }

    // OWNER kann nicht geändert werden (außer durch sich selbst oder SUPERADMIN)
    if (existingUser.role === "OWNER" && session.user.id !== existingUser.id && session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "OWNER-Rolle kann nicht geändert werden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.email !== undefined && body.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "Diese E-Mail-Adresse ist bereits vergeben" },
          { status: 400 }
        );
      }

      updateData.email = body.email;
    }

    const roleChanged = body.role !== undefined && body.role !== existingUser.role;
    const isActiveChanged = body.isActive !== undefined && body.isActive !== existingUser.isActive;
    const passwordChanged = body.password && body.password.trim() !== "";

    if (roleChanged) {
      // Superadmin kann nicht von SUPERADMIN degradiert werden
      if (isSuperadminEmail(existingUser.email) && existingUser.role === "SUPERADMIN" && body.role !== "SUPERADMIN") {
        return NextResponse.json(
          { error: "Der Hauptadministrator kann nicht degradiert werden" },
          { status: 403 }
        );
      }
      
      // Nur OWNER und SUPERADMIN können ADMIN erstellen
      if (body.role === "ADMIN" && session.user.role !== "OWNER" && session.user.role !== "SUPERADMIN") {
        return NextResponse.json(
          { error: "Nur OWNER und SUPERADMIN können ADMIN-Rolle vergeben" },
          { status: 403 }
        );
      }
      
      // Nur Superadmin darf SUPERADMIN-Rolle vergeben
      if (body.role === "SUPERADMIN" && !isSuperadminEmail(session.user.email)) {
        return NextResponse.json(
          { error: "Nur der Hauptadministrator darf Superadmins erstellen" },
          { status: 403 }
        );
      }
      
      updateData.role = body.role;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (passwordChanged) {
      if (body.password.length < 8) {
        return NextResponse.json(
          { error: "Passwort muss mindestens 8 Zeichen lang sein" },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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

    // Log Security Events (nicht-blockierend)
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    if (roleChanged) {
      logSecurityEvent({
        userId: session.user.id,
        accountId: session.user.accountId,
        eventType: "USER_ROLE_CHANGED",
        entityType: "User",
        entityId: params.id,
        description: `Rolle geändert: ${existingUser.email} von ${existingUser.role} zu ${body.role}`,
        metadata: {
          userEmail: existingUser.email,
          oldRole: existingUser.role,
          newRole: body.role,
        },
        ipAddress,
        userAgent,
      }).catch((err) => console.error("Error logging security event:", err));
    }

    if (isActiveChanged) {
      const eventType = body.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED";
      logSecurityEvent({
        userId: session.user.id,
        accountId: session.user.accountId,
        eventType: eventType,
        entityType: "User",
        entityId: params.id,
        description: `Benutzer ${body.isActive ? "aktiviert" : "deaktiviert"}: ${existingUser.email}`,
        metadata: {
          userEmail: existingUser.email,
        },
        ipAddress,
        userAgent,
      }).catch((err) => console.error("Error logging security event:", err));
    }

    if (passwordChanged) {
      logSecurityEvent({
        userId: session.user.id,
        accountId: session.user.accountId,
        eventType: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: params.id,
        description: `Passwort geändert: ${existingUser.email}`,
        metadata: {
          userEmail: existingUser.email,
          changedBySelf: session.user.id === params.id,
        },
        ipAddress,
        userAgent,
      }).catch((err) => console.error("Error logging security event:", err));
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Benutzers" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Löscht einen Benutzer
 */
export async function DELETE(
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

    // Nur OWNER und SUPERADMIN können Benutzer löschen
    if (session.user.role !== "OWNER" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Nur OWNER und SUPERADMIN können Benutzer löschen" },
        { status: 403 }
      );
    }

    // Prüfe ob Benutzer zum Account gehört
    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        accountId: session.user.accountId,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    // Superadmin kann nicht gelöscht werden
    if (isSuperadminEmail(existingUser.email)) {
      return NextResponse.json(
        { error: "Der Hauptadministrator kann nicht gelöscht werden" },
        { status: 403 }
      );
    }

    // OWNER kann sich nicht selbst löschen (außer durch SUPERADMIN)
    if (existingUser.role === "OWNER" && session.user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "OWNER kann nicht gelöscht werden" },
        { status: 403 }
      );
    }

    // Speichere User-Informationen für Event-Log
    const userEmail = existingUser.email;
    const userName = existingUser.name;

    // Benutzer löschen
    await prisma.user.delete({
      where: { id: params.id },
    });

    // Log Security Event (nicht-blockierend)
    logSecurityEvent({
      userId: session.user.id,
      accountId: session.user.accountId,
      eventType: "USER_DELETED",
      entityType: "User",
      entityId: params.id,
      description: `Benutzer gelöscht: ${userEmail}${userName ? ` (${userName})` : ""}`,
      metadata: {
        userEmail: userEmail,
        userName: userName,
        userRole: existingUser.role,
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    }).catch((err) => console.error("Error logging security event:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Benutzers" },
      { status: 500 }
    );
  }
}
