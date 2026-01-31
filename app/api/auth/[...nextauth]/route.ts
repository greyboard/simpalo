import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Prevent build errors on Vercel - must be before exports
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
