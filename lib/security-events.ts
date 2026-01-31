import { prisma } from "@/lib/prisma";
import { SecurityEventType } from "@prisma/client";

// Re-export Prisma's SecurityEventType for convenience
export type { SecurityEventType };

interface LogSecurityEventOptions {
  userId?: string;
  accountId: string;
  eventType: SecurityEventType;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Loggt ein Security Event (nicht-blockierend)
 */
export async function logSecurityEvent(options: LogSecurityEventOptions): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        userId: options.userId || null,
        accountId: options.accountId,
        eventType: options.eventType,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
        description: options.description,
        metadata: options.metadata || undefined,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
      },
    });
  } catch (error) {
    // Fehler beim Logging sollten die Hauptfunktion nicht beeinträchtigen
    console.error("Error logging security event:", error);
  }
}

/**
 * Extrahiert IP-Adresse aus NextRequest
 * NextRequest hat headers als direktes Property mit get() Methode
 */
export function getClientIp(request: { headers: { get: (name: string) => string | null } }): string | undefined {
  try {
    if (!request || !request.headers || typeof request.headers.get !== 'function') {
      return undefined;
    }
    
    // Versuche verschiedene Header für IP-Adresse (in Prioritätsreihenfolge)
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      // x-forwarded-for kann mehrere IPs enthalten, nimm die erste
      return forwardedFor.split(",")[0]?.trim() || undefined;
    }
    
    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      return realIp;
    }
    
    // Fallback: cf-connecting-ip (Cloudflare) oder x-client-ip
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) {
      return cfIp;
    }
    
    const clientIp = request.headers.get("x-client-ip");
    if (clientIp) {
      return clientIp;
    }
    
    return undefined;
  } catch (error) {
    console.error("Error extracting IP address:", error);
    return undefined;
  }
}

/**
 * Extrahiert User-Agent aus NextRequest
 * NextRequest hat headers als direktes Property mit get() Methode
 */
export function getUserAgent(request: { headers: { get: (name: string) => string | null } }): string | undefined {
  try {
    if (!request || !request.headers || typeof request.headers.get !== 'function') {
      return undefined;
    }
    
    const userAgent = request.headers.get("user-agent");
    return userAgent || undefined;
  } catch (error) {
    console.error("Error extracting User-Agent:", error);
    return undefined;
  }
}
