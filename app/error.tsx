"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Etwas ist schiefgelaufen!</h2>
        <p className="text-gray-600 mb-6">
          {error.message || "Ein unerwarteter Fehler ist aufgetreten."}
        </p>
        <div className="flex gap-3">
          <Button onClick={() => reset()}>Erneut versuchen</Button>
          <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
            Zurück zum Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
