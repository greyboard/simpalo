import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";

// Prevent build errors on Vercel - page uses server-side session
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  
  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/auth/login");
  }
}