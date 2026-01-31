import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/activate/[token]
 * Aktiviert einen Account über einen Token-Link
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Token dekodieren (URL-Encoding entfernen, falls vorhanden)
    const decodedToken = decodeURIComponent(params.token);
    
    console.log("[ACTIVATE] Token received:", {
      raw: params.token,
      decoded: decodedToken,
      length: decodedToken.length,
    });
    
    // Token entschlüsseln (Format: accountId:timestamp:signature)
    const tokenParts = decodedToken.split(":");
    console.log("[ACTIVATE] Token parts:", {
      count: tokenParts.length,
      parts: tokenParts.map((p, i) => ({ index: i, length: p.length, preview: p.substring(0, 20) })),
    });
    
    if (tokenParts.length !== 3) {
      console.error("[ACTIVATE] Invalid token format - expected 3 parts, got:", tokenParts.length);
      return NextResponse.redirect(
        new URL("/auth/login?error=invalid_token", request.url)
      );
    }

    const [accountId, timestamp, signature] = tokenParts;
    
    console.log("[ACTIVATE] Token parsed:", {
      accountId: accountId?.substring(0, 20),
      timestamp,
      signature: signature?.substring(0, 20),
    });

    // Prüfe, ob Token abgelaufen ist (7 Tage Gültigkeit)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    if (tokenAge > sevenDaysInMs) {
      return NextResponse.redirect(
        new URL("/auth/login?error=token_expired", request.url)
      );
    }

    // Validiere Signatur
    const secret = process.env.NEXTAUTH_SECRET || "";
    
    if (!secret) {
      console.error("[ACTIVATE] NEXTAUTH_SECRET is not set!");
      return NextResponse.redirect(
        new URL("/auth/login?error=activation_failed", request.url)
      );
    }
    
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${accountId}:${timestamp}`)
      .digest("hex");

    console.log("[ACTIVATE] Signature validation:", {
      received: signature?.substring(0, 20),
      expected: expectedSignature.substring(0, 20),
      match: signature === expectedSignature,
      secretLength: secret.length,
    });

    if (signature !== expectedSignature) {
      console.error("[ACTIVATE] Signature mismatch - token is invalid");
      return NextResponse.redirect(
        new URL("/auth/login?error=invalid_token", request.url)
      );
    }

    // Finde Account
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.redirect(
        new URL("/auth/login?error=account_not_found", request.url)
      );
    }

    // Prüfe, ob Account bereits aktiviert ist
    if (account.isActive) {
      return NextResponse.redirect(
        new URL("/auth/login?message=account_already_active", request.url)
      );
    }

    // Aktiviere Account
    await prisma.account.update({
      where: { id: accountId },
      data: { isActive: true },
    });

    // Weiterleitung zur Login-Seite mit Erfolgsmeldung
    return NextResponse.redirect(
      new URL("/auth/login?message=account_activated", request.url)
    );
  } catch (error) {
    console.error("Error activating account:", error);
    return NextResponse.redirect(
      new URL("/auth/login?error=activation_failed", request.url)
    );
  }
}
