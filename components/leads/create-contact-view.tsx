"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchCompanies } from "@/lib/api/leads";
import { createContact, type CreateContactInput } from "@/lib/actions/leads";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export function CreateContactView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyId, setCompanyId] = useState<string>("");

  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const result = await createContact(input);
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Erstellen des Kontakts");
      }
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Kontakt erfolgreich erstellt");
      router.push(`/dashboard/leads/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Erstellen des Kontakts");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validierung wird jetzt im Server Action durchgeführt
    const input: CreateContactInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      companyId: companyId || undefined,
    };

    createMutation.mutate(input);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/leads">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#2D3748" }}>Neuer Kontakt</h1>
          <p className="text-gray-500 mt-1">
            Erstelle einen neuen Kontakt und weise ihn einer Firma zu
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kontaktdaten</CardTitle>
          <CardDescription>
            Gib die Informationen für den neuen Kontakt ein
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Max"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Mustermann"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="max.mustermann@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+49 123 456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Firma (optional)</Label>
              {companiesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lade Firmen...
                </div>
              ) : (
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wähle eine Firma aus">
                      {companyId && (() => {
                        const selectedCompany = (companies || []).find((c: any) => c.id === companyId);
                        return selectedCompany ? selectedCompany.name : null;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(companies || []).map((company: any) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                        {company.city && ` - ${company.city}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-gray-500">
                Optional: Die Firma, der dieser Kontakt zugeordnet werden soll. Wenn leer, wird eine neue Firma ohne Namen angelegt.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/dashboard/leads">
                <Button type="button" variant="outline">
                  Abbrechen
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird erstellt...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Kontakt erstellen
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
