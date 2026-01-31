"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error:", error);
  }, [error]);

  return (
    <html lang="de">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Kritischer Fehler</h2>
            <p className="text-gray-600 mb-6">
              {error.message || "Ein kritischer Fehler ist aufgetreten."}
            </p>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
