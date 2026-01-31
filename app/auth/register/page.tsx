"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    accountName: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validierung
    if (formData.password !== formData.confirmPassword) {
      setError("Die Passwörter stimmen nicht überein");
      return;
    }

    if (formData.password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          accountName: formData.accountName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ein Fehler ist aufgetreten");
        return;
      }

      // Registrierung erfolgreich, weiterleiten zur Anmeldung
      router.push("/auth/login?registered=true");
    } catch (error) {
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">simpalo</h1>
          <p className="text-gray-600 mt-2">Erstelle Dein Firmen-Account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="accountName" className="block text-sm font-medium text-gray-700 mb-2">
              Firmenname *
            </label>
            <Input
              id="accountName"
              name="accountName"
              type="text"
              value={formData.accountName}
              onChange={handleChange}
              required
              placeholder="Deine Firma GmbH"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Dein Name *
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Max Mustermann"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              E-Mail-Adresse *
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="ihre@email.de"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Passwort *
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">Mindestens 8 Zeichen</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Passwort bestätigen *
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Registrieren..." : "Registrieren"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Bereits ein Account?{" "}
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Jetzt anmelden
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
