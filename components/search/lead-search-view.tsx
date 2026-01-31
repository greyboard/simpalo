"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Star, Globe, Phone, Mail, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { searchGoogleBusiness, importLeadFromPlace } from "@/lib/api/leads";
import Link from "next/link";
import toast from "react-hot-toast";

export function LeadSearchView() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxResults, setMaxResults] = useState("60");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const queryClient = useQueryClient();
  const createLeadMutation = useMutation({
    mutationFn: async ({ placeId, result }: { placeId?: string; result?: any }) => {
      // Wenn placeId vorhanden, verwende die neue Import-Route mit vollständigen Details
      if (placeId) {
        const data = await importLeadFromPlace(placeId);
        return data;
      }
      
      // Fallback: Alte Methode für manuelle Eingabe
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error(errorData.error || "Lead existiert bereits");
        }
        throw new Error(errorData.error || "Fehler beim Erstellen des Leads");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      // Invalidate specific lead query if lead ID is available
      if (data?.lead?.id) {
        queryClient.invalidateQueries({ queryKey: ["lead", data.lead.id] });
      }
      toast.success("Lead erfolgreich mit allen Details hinzugefügt");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Hinzufügen des Leads");
    },
  });

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Bitte gib eine Suchanfrage ein");
      return;
    }

    setIsSearching(true);
    setResults([]);
    
    try {
      const filters: any = {};
      if (location) filters.location = location;
      if (category) filters.category = category;
      if (minRating) filters.minRating = parseFloat(minRating);
      if (maxResults) filters.maxResults = parseInt(maxResults, 10);

      const data = await searchGoogleBusiness(query, filters);
      
      if (data.error) {
        toast.error(data.error);
        setResults([]);
        return;
      }
      
      setResults(data.results || []);
      
      if (data.results && data.results.length === 0) {
        toast.error("Keine Ergebnisse gefunden. Bitte versuche andere Suchbegriffe.");
      } else if (data.message) {
        toast(data.message);
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error(error.message || "Fehler bei der Suche");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddLead = async (result: any) => {
    // Verwende die neue Import-Route, die automatisch alle Place Details abruft
    if (result.place_id) {
      createLeadMutation.mutate({ placeId: result.place_id });
    } else {
      // Fallback für Fälle ohne place_id (sollte nicht vorkommen)
      toast.error("Keine Place ID gefunden");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Lead-Suche</h1>
        <p className="text-gray-500 mt-1">
          Suche nach lokalen Unternehmen über Google Business Profile
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suche konfigurieren</CardTitle>
          <CardDescription>
            Gib Suchbegriffe, Ort und Filter ein, um Leads zu finden
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suchbegriff *
              </label>
              <Input
                placeholder="z.B. Restaurant, Friseur, Zahnarzt..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ort
              </label>
              <Input
                placeholder="z.B. Berlin, München..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branche
              </label>
              <Input
                placeholder="z.B. restaurant, hair_salon..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min. Bewertung
              </label>
              <Input
                type="number"
                min="0"
                max="5"
                step="0.1"
                placeholder="0.0"
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max. Ergebnisse
              </label>
              <select
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="20">20 Ergebnisse (1 Seite)</option>
                <option value="40">40 Ergebnisse (2 Seiten)</option>
                <option value="60">60 Ergebnisse (3 Seiten)</option>
              </select>
            </div>
          </div>
          <Button onClick={handleSearch} disabled={isSearching} className="w-full md:w-auto">
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suche läuft...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Suche starten
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suchergebnisse</CardTitle>
            <CardDescription>{results.length} Ergebnisse gefunden</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => {
                const existsInDb = result.existsInDatabase || false;
                const existingLeadId = result.existingLeadId || null;
                
                return (
                <div
                  key={result.place_id || index}
                  className={`border rounded-lg p-4 hover:bg-gray-50 ${
                    existsInDb ? "border-green-200 bg-green-50/30" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{result.name}</h3>
                        {existsInDb && (
                          <Badge variant="success" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Bereits vorhanden
                          </Badge>
                        )}
                      </div>
                      {result.formatted_address && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                          <MapPin className="h-4 w-4" />
                          {result.formatted_address}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4 mt-3">
                        {result.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-medium">{result.rating}</span>
                            {result.user_ratings_total && (
                              <span className="text-sm text-gray-500">
                                ({result.user_ratings_total})
                              </span>
                            )}
                          </div>
                        )}
                        {result.website && (
                          <a
                            href={result.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                          >
                            <Globe className="h-4 w-4" />
                            Website
                          </a>
                        )}
                        {result.international_phone_number && (
                          <a
                            href={`tel:${result.international_phone_number}`}
                            className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                          >
                            <Phone className="h-4 w-4" />
                            {result.international_phone_number}
                          </a>
                        )}
                      </div>
                      {result.types && result.types.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {result.types.slice(0, 3).map((type: string) => (
                            <Badge key={type} variant="secondary">
                              {type.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {existsInDb && existingLeadId ? (
                        <Link href={`/dashboard/leads/${existingLeadId}`}>
                          <Button
                            size="sm"
                            variant="outline"
                          >
                            Zum Lead öffnen
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAddLead(result)}
                          disabled={createLeadMutation.isPending}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Zu Leads hinzufügen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!isSearching && results.length === 0 && query && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              Keine Ergebnisse gefunden. Bitte versuchen Sie andere Suchbegriffe.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Hinweis: Die Google Business Profile API Integration muss noch konfiguriert werden.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}