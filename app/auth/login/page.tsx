"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Prüfe Query-Parameter für Meldungen
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");
    const registeredParam = searchParams.get("registered");

    if (errorParam) {
      switch (errorParam) {
        case "invalid_token":
          setError("Ungültiger Aktivierungslink");
          break;
        case "token_expired":
          setError("Der Aktivierungslink ist abgelaufen. Bitte kontaktiere den Support.");
          break;
        case "account_not_found":
          setError("Account nicht gefunden");
          break;
        case "activation_failed":
          setError("Fehler bei der Aktivierung. Bitte kontaktieren Sie den Support.");
          break;
        default:
          setError("Ein Fehler ist aufgetreten");
      }
    }

    if (messageParam) {
      switch (messageParam) {
        case "account_activated":
          setMessage("Dein Account wurde erfolgreich aktiviert! Du kannst Dich jetzt anmelden.");
          break;
        case "account_already_active":
          setMessage("Ihr Account ist bereits aktiviert. Sie können sich jetzt anmelden.");
          break;
      }
    }

    if (registeredParam === "true") {
      setMessage("Registrierung erfolgreich! Bitte aktiviere Deinen Account über den Link in der E-Mail.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        // Log failed login attempt (non-blocking)
        fetch("/api/auth/log-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            success: false,
            email: email,
            reason: result.error,
          }),
        }).catch((err) => {
          console.error("Error logging failed login:", err);
        });
      } else {
        // Login-Log wird im JWT Callback erstellt, aber ohne IP/User-Agent
        // Rufe API auf, um IP-Adresse und User-Agent hinzuzufügen
        fetch("/api/auth/log-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }).catch((err) => {
          console.error("Error updating login with IP/User-Agent:", err);
        });
        
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Linke Seite: Dunkelblauer Hintergrund mit Benefits */}
      <div className="hidden lg:flex lg:w-1/2" style={{ backgroundColor: "#1A365D" }}>
        <div className="flex flex-col justify-center px-12 py-16">
          <div className="mb-12">
            <Image
              src="/logo.png"
              alt="Simpalo - das einfachste CRM für den deutschen Markt"
              width={240}
              height={80}
              className="h-16 w-auto mb-8"
              priority
            />
            <h2 className="text-3xl font-bold text-white mb-4">
              Das einfachste CRM für den deutschen Markt
            </h2>
            <p className="text-lg text-white/80">
              Startklar in unter 10 Minuten, keine monatelange Einarbeitung.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: "#48BB78" }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-lg">Unlimitierte Benutzer, Leads und Unternehmen</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: "#48BB78" }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-lg">Google Places Integration</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: "#48BB78" }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-lg">E-Mail-Templates für automatische Antworten</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: "#48BB78" }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-lg">Automatische UTM-Parameter Auswertung</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: "#48BB78" }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-lg">Mailgun E-Mail-Versand & Tracking</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: "#48BB78" }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-lg">Startklar in unter 10 Minuten</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rechte Seite: Anmeldemaske */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4" style={{ backgroundColor: "#F7FAFC" }}>
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4 lg:hidden">
              <Image
                src="/logo.png"
                alt="Simpalo - das einfachste CRM für den deutschen Markt"
                width={240}
                height={80}
                className="h-16 w-auto"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Melde Dich an</h1>
            <p className="text-gray-600 text-sm">Willkommen zurück bei simpalo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-Mail-Adresse
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ihre@email.de"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Passwort
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              style={{ backgroundColor: "#1A365D" }}
            >
              {isLoading ? "Anmelden..." : "Anmelden"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Noch kein Account?{" "}
              <a href="https://simpalo.de" className="text-blue-600 hover:text-blue-700 font-medium">
                Jetzt registrieren
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2" style={{ backgroundColor: "#1A365D" }}>
          <div className="flex flex-col justify-center px-12 py-16">
            <div className="mb-12">
              <Image
                src="/logo.png"
                alt="Simpalo - das einfachste CRM für den deutschen Markt"
                width={240}
                height={80}
                className="h-16 w-auto mb-8"
                priority
              />
            </div>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4" style={{ backgroundColor: "#F7FAFC" }}>
          <Card className="w-full max-w-md p-8">
            <div className="text-center text-gray-500">Lädt...</div>
          </Card>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
