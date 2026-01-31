"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "Es gibt ein Problem mit der Server-Konfiguration.",
    AccessDenied: "Du hast keine Berechtigung, Dich anzumelden.",
    Verification: "Der Verifizierungslink ist nicht mehr gültig.",
    Default: "Ein Fehler ist bei der Anmeldung aufgetreten.",
  };

  const errorMessage = errorMessages[error || "Default"] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fehler</h1>
          <p className="text-gray-600">{errorMessage}</p>
        </div>

        <div className="space-y-4">
          <Link href="/auth/login">
            <Button className="w-full">Zurück zur Anmeldung</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full">
              Zur Startseite
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Fehler</h1>
            <p className="text-gray-600">Lädt...</p>
          </div>
        </Card>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
