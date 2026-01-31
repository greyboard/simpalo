"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { LeadFilters as LeadFiltersType } from "@/lib/api/leads";

interface LeadFiltersProps {
  filters: LeadFiltersType;
  onFiltersChange: (filters: LeadFiltersType) => void;
}

const statusOptions = [
  { value: "NEW", label: "Neu" },
  { value: "CONTACTED", label: "Kontaktiert" },
  { value: "QUALIFIED", label: "Qualifiziert" },
  { value: "PROPOSAL", label: "Angebot" },
  { value: "NEGOTIATION", label: "Verhandlung" },
  { value: "WON", label: "Kunde" },
  { value: "LOST", label: "Verloren" },
];

export function LeadFilters({ filters, onFiltersChange }: LeadFiltersProps) {
  const updateFilter = (key: keyof LeadFiltersType, value: any) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={filters.status || ""}
              onChange={(e) => updateFilter("status", e.target.value)}
            >
              <option value="">Alle</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stadt
            </label>
            <Input
              placeholder="Stadt suchen..."
              value={filters.city || ""}
              onChange={(e) => updateFilter("city", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branche
            </label>
            <Input
              placeholder="Branche..."
              value={filters.category || ""}
              onChange={(e) => updateFilter("category", e.target.value)}
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
              value={filters.minRating || ""}
              onChange={(e) =>
                updateFilter("minRating", e.target.value ? parseFloat(e.target.value) : undefined)
              }
            />
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasWebsite || false}
              onChange={(e) => updateFilter("hasWebsite", e.target.checked || undefined)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Nur mit Website</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasBadReviews || false}
              onChange={(e) => updateFilter("hasBadReviews", e.target.checked || undefined)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Schlechte Reviews</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasPoorProfile || false}
              onChange={(e) => updateFilter("hasPoorProfile", e.target.checked || undefined)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Unvollständiges Profil</span>
          </label>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}