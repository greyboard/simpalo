import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { redirect } from "next/navigation";

/**
 * Get the current user session on the server
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Get the current authenticated user (throws if not authenticated)
 */
export async function getCurrentUser() {
  const session = await getSession();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  return session.user;
}

/**
 * Get the current account ID (throws if not authenticated)
 */
export async function getCurrentAccountId() {
  const user = await getCurrentUser();
  return user.accountId;
}

/**
 * Check if the current user is a superadmin
 */
export async function isSuperAdmin() {
  const user = await getCurrentUser();
  return user.role === "SUPERADMIN";
}

/**
 * Require superadmin role (throws if not superadmin)
 */
export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "SUPERADMIN") {
    redirect("/dashboard");
  }
  return user;
}
