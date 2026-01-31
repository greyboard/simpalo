import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { logSecurityEvent } from "./security-events";
import { isSuperadminEmail, verifySuperadminPassword, getSuperadminEmail } from "./superadmin";
import { initializeDatabase } from "./db-init";

// Zod Schema für Login-Credentials
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "E-Mail-Adresse ist erforderlich")
    .email("Ungültige E-Mail-Adresse")
    .max(255, "E-Mail-Adresse ist zu lang")
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(1, "Passwort ist erforderlich")
    .max(128, "Passwort ist zu lang"),
});

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Strikte Validierung - NUR validierte Daten verwenden
        const validatedCredentials = loginSchema.parse({
          email: credentials?.email,
          password: credentials?.password,
        });

        // Initialisiere Datenbank beim ersten Login (non-blocking)
        initializeDatabase().catch((error) => {
          console.error("[AUTH] Fehler bei automatischer DB-Initialisierung:", error);
          // Fehler nicht weiterwerfen - Login sollte trotzdem funktionieren
        });

        // Prüfe zuerst, ob es Superadmin-Credentials aus ENV sind
        const isSuperadminLogin = isSuperadminEmail(validatedCredentials.email);
        if (isSuperadminLogin) {
          const isSuperadminPasswordValid = await verifySuperadminPassword(validatedCredentials.password);
          if (isSuperadminPasswordValid) {
            // Superadmin-Login: Finde oder erstelle Superadmin-User
            let user = await prisma.user.findUnique({
              where: { email: validatedCredentials.email },
              include: {
                account: true,
              },
            });

            if (!user) {
              // Erstelle Superadmin-Account und User, falls nicht vorhanden
              const superadminEmail = getSuperadminEmail()!;
              const account = await prisma.account.create({
                data: {
                  name: "Superadmin",
                  slug: "superadmin",
                  email: superadminEmail,
                  isActive: true,
                  users: {
                    create: {
                      email: superadminEmail,
                      name: "Superadmin",
                      password: await bcrypt.hash(validatedCredentials.password, 10), // Hash für spätere Verwendung
                      role: "SUPERADMIN",
                      isActive: true,
                    },
                  },
                  settings: {
                    create: {},
                  },
                },
                include: {
                  users: true,
                },
              });
              // Lade User mit account Relation
              const createdUser = await prisma.user.findUnique({
                where: { id: account.users[0].id },
                include: {
                  account: true,
                },
              });
              
              if (!createdUser) {
                throw new Error("Fehler beim Erstellen des Superadmin-Users");
              }
              
              user = createdUser;
            } else {
              // Stelle sicher, dass User SUPERADMIN-Rolle hat
              if (user.role !== "SUPERADMIN") {
                await prisma.user.update({
                  where: { id: user.id },
                  data: { role: "SUPERADMIN" },
                });
                user.role = "SUPERADMIN";
              }
              // Stelle sicher, dass Account aktiv ist
              if (!user.account.isActive) {
                await prisma.account.update({
                  where: { id: user.accountId },
                  data: { isActive: true },
                });
                user.account.isActive = true;
              }
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              accountId: user.accountId,
              role: user.role,
            };
          }
        }

        // Normale User-Authentifizierung
        const user = await prisma.user.findUnique({
          where: { email: validatedCredentials.email },
          include: {
            account: true,
          },
        });

        if (!user || !user.password) {
          throw new Error("Ungültige Anmeldedaten");
        }

        if (!user.isActive) {
          throw new Error("Dein Account wurde deaktiviert");
        }

        // Check if account is active (unless user is superadmin)
        if (user.role !== "SUPERADMIN" && !user.account.isActive) {
          throw new Error("Dein Firmenaccount wurde noch nicht freigeschaltet");
        }

        const isPasswordValid = await bcrypt.compare(
          validatedCredentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Ungültige Anmeldedaten");
        }

        // Aktualisiere Lead-Status auf "WON" (Kunde) im Superadmin-Account, wenn Account aktiviert ist
        // Dies passiert nur beim ersten Login nach Aktivierung
        if (user.account.isActive && user.role !== "SUPERADMIN") {
          try {
            // Finde Superadmin Account
            const superadminEmail = getSuperadminEmail();
            if (!superadminEmail) {
              console.warn("[AUTH] SUPERADMIN_EMAIL nicht konfiguriert, überspringe Lead-Status-Update");
            } else {
              const superadminUser = await prisma.user.findUnique({
                where: { email: superadminEmail },
                include: { account: true },
              });

              if (superadminUser?.account) {
                // Finde Lead im Superadmin-Account mit der E-Mail des Users
                const lead = await prisma.lead.findFirst({
                  where: {
                    email: user.email,
                    accountId: superadminUser.account.id,
                    source: "Simpalo",
                    status: { not: "WON" }, // Nur aktualisieren, wenn noch nicht "WON"
                  },
                });

                if (lead) {
                  // Aktualisiere Lead-Status auf "WON" (Kunde)
                  await prisma.lead.update({
                    where: { id: lead.id },
                    data: { status: "WON" },
                  });

                  console.log("[AUTH] Lead-Status auf 'WON' (Kunde) aktualisiert:", {
                    leadId: lead.id,
                    leadName: lead.name,
                    userEmail: user.email,
                  });
                }
              }
            }
          } catch (leadUpdateError) {
            // Fehler beim Lead-Update sollte Login nicht blockieren
            console.error("[AUTH] Fehler beim Aktualisieren des Lead-Status:", leadUpdateError);
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          accountId: user.accountId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial login - set user data and log login
      if (user) {
        console.log("[AUTH] JWT callback called with user:", {
          id: (user as any).id,
          email: (user as any).email,
          role: (user as any).role,
          accountId: (user as any).accountId,
        });
        
        token.accountId = (user as any).accountId;
        token.role = (user as any).role;
        token.email = (user as any).email;
        token.lastRoleRefresh = Date.now();
        
        // Log successful login (non-blocking)
        // This works for all users including SUPERADMIN
        if ((user as any).accountId) {
          console.log("[AUTH] Attempting to log login for user:", (user as any).email);
          logSecurityEvent({
            userId: (user as any).id,
            accountId: (user as any).accountId,
            eventType: "LOGIN_SUCCESS",
            entityType: "User",
            entityId: (user as any).id,
            description: `Erfolgreiche Anmeldung: ${(user as any).email}`,
            metadata: {
              userEmail: (user as any).email,
              userRole: (user as any).role,
            },
            // IP and User-Agent are not available in JWT callback
            // They will be logged as null, which is acceptable for login events
          })
            .then(() => {
              console.log("[AUTH] Successfully logged login for user:", (user as any).email);
            })
            .catch((error) => {
              console.error("[AUTH] Error logging login in JWT callback:", error);
              console.error("[AUTH] User data:", {
                id: (user as any).id,
                email: (user as any).email,
                accountId: (user as any).accountId,
                role: (user as any).role,
              });
              // Don't throw - login should succeed even if logging fails
            });
        } else {
          console.error("[AUTH] Cannot log login: missing accountId for user", (user as any).email);
        }
      }
      
      // Refresh role from database every 30 seconds to ensure it's up-to-date
      // This is important for role changes (e.g., making someone superadmin)
      const now = Date.now();
      const lastRefresh = (token.lastRoleRefresh as number) || 0;
      const refreshInterval = 30 * 1000; // 30 seconds
      
      if (token.email && (now - lastRefresh > refreshInterval)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { role: true, isActive: true },
          });
          
          if (dbUser) {
            token.role = dbUser.role;
            token.lastRoleRefresh = now;
          }
        } catch (error) {
          console.error("Error refreshing user role:", error);
          // Continue with existing token role if DB lookup fails
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).accountId = token.accountId;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
