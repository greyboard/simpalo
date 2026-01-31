import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { QueryProvider } from "@/components/providers/query-provider";
import { NextAuthSessionProvider } from "@/components/providers/session-provider";
import { initializeDatabase } from "@/lib/db-init";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "simpalo",
  description: "Professional lead generation and CRM platform for local businesses",
  icons: {
    icon: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Automatische Datenbank-Initialisierung beim ersten Request (non-blocking)
  // Dies läuft im Hintergrund und blockiert nicht das Rendering
  initializeDatabase().catch((error) => {
    // Fehler werden geloggt, aber blockieren nicht die App
    console.error("[LAYOUT] Fehler bei automatischer DB-Initialisierung:", error);
  });

  return (
    <html lang="de">
      <body className={inter.className}>
        <NextAuthSessionProvider>
          <QueryProvider>
            {children}
            <Toaster position="bottom-right" />
          </QueryProvider>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}