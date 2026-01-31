"use client";

import { useState } from "react";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, Mail, Globe, Trash2, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { deleteLead } from "@/lib/api/leads";
import toast from "react-hot-toast";
interface LeadsTableProps {
  leads: any[]; // Lead mit company-Beziehung
  isLoading: boolean;
  showLocationAndRating?: boolean; // Zeige Ort und Bewertung (für Firmen)
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

const statusColors: Record<string, "default" | "secondary" | "success" | "warning"> = {
  NEW: "default",
  CONTACTED: "secondary",
  QUALIFIED: "success",
  PROPOSAL: "warning",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "default",
};

const statusLabels: Record<string, string> = {
  NEW: "Neu",
  CONTACTED: "Kontaktiert",
  QUALIFIED: "Qualifiziert",
  PROPOSAL: "Angebot",
  NEGOTIATION: "Verhandlung",
  WON: "Kunde",
  LOST: "Verloren",
  ARCHIVED: "Archiviert",
};

// Helper-Funktion: Normalisiere UTM Source für Anzeige
const normalizeUtmSource = (utmSource: string | null | undefined): string => {
  if (!utmSource) return "";
  const source = utmSource.toLowerCase();
  if (source === "facebook" || source === "meta" || source.includes("facebook") || source.includes("meta")) {
    return "Meta (Facebook)";
  } else if (source === "google" || source.includes("google")) {
    return "Google Ads";
  } else if (source === "linkedin" || source.includes("linkedin")) {
    return "LinkedIn";
  } else if (source === "tiktok" || source.includes("tiktok")) {
    return "TikTok";
  } else if (source === "instagram" || source.includes("instagram")) {
    return "Instagram";
  } else if (source === "youtube" || source.includes("youtube")) {
    return "YouTube";
  } else if (source === "email" || source.includes("email") || source === "mail") {
    return "E-Mail";
  }
  return utmSource;
};

// Helper-Funktion: Hole Badge-Farbe für UTM Source (basierend auf CI-Farben der Netzwerke)
const getUtmSourceBadgeColor = (utmSource: string | null | undefined) => {
  if (!utmSource) return { backgroundColor: "#1A365D20", color: "#1A365D" };
  const source = utmSource.toLowerCase();
  
  // Google Ads: Google-Grün (#34A853) - besser unterscheidbar
  if (source.includes("google")) {
    return { backgroundColor: "#34A85320", color: "#34A853" };
  }
  // Facebook/Meta Ads: Facebook-Blau (#1877F2)
  else if (source.includes("meta") || source.includes("facebook")) {
    return { backgroundColor: "#1877F220", color: "#1877F2" };
  }
  // LinkedIn: LinkedIn-Türkis (#0A66C2) - helleres Blau für bessere Unterscheidung
  else if (source.includes("linkedin")) {
    return { backgroundColor: "#0A66C220", color: "#0A66C2" };
  }
  // TikTok: Schwarz (#000000)
  else if (source.includes("tiktok")) {
    return { backgroundColor: "#000000", color: "#FFFFFF" };
  }
  // Instagram: Instagram-Pink (#E4405F)
  else if (source.includes("instagram")) {
    return { backgroundColor: "#E4405F20", color: "#E4405F" };
  }
  // YouTube: YouTube-Rot (#FF0000)
  else if (source.includes("youtube")) {
    return { backgroundColor: "#FF000020", color: "#FF0000" };
  }
  // Email: Grau
  else if (source.includes("email") || source === "mail") {
    return { backgroundColor: "#6B728020", color: "#6B7280" };
  }
  // Standard: Brand-Farbe
  return { backgroundColor: "#1A365D20", color: "#1A365D" };
};

export function LeadsTable({ leads, isLoading, showLocationAndRating = true, pagination }: LeadsTableProps) {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<{ id: string; name: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteLead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Lead erfolgreich gelöscht");
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Löschen des Leads");
    },
  });

  const handleDeleteClick = (id: string, name: string) => {
    setLeadToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (leadToDelete) {
      deleteMutation.mutate(leadToDelete.id);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setLeadToDelete(null);
  };

  const usingServerPagination = !!pagination;
  const effectivePage = usingServerPagination ? pagination!.page : currentPage;
  const effectivePageSize = usingServerPagination ? pagination!.pageSize : itemsPerPage;
  const effectiveTotal = usingServerPagination ? pagination!.total : leads.length;

  const totalPages = Math.max(1, Math.ceil(effectiveTotal / effectivePageSize));
  const startIndex = (effectivePage - 1) * effectivePageSize;
  const endIndex = startIndex + effectivePageSize;
  const paginatedLeads = usingServerPagination ? leads : leads.slice(startIndex, endIndex);

  // Reset to page 1 when leads change
  React.useEffect(() => {
    if (!usingServerPagination) setCurrentPage(1);
  }, [leads.length, usingServerPagination]);

  const handlePreviousPage = () => {
    const next = Math.max(1, effectivePage - 1);
    if (usingServerPagination) pagination!.onPageChange(next);
    else setCurrentPage(next);
  };

  const handleNextPage = () => {
    const next = Math.min(totalPages, effectivePage + 1);
    if (usingServerPagination) pagination!.onPageChange(next);
    else setCurrentPage(next);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Noch keine Leads vorhanden</p>
        <Link href="/dashboard/search">
          <Button className="mt-4">Neue Leads suchen</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
              <div className="flex items-center gap-2">
                Unternehmen
              </div>
            </th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
              Kontakt
            </th>
            {showLocationAndRating && (
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                Ort
              </th>
            )}
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
              Status
            </th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
              Quelle
            </th>
            {showLocationAndRating && (
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                Bewertung
              </th>
            )}
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
              Letzte Aktivität
            </th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
              Aktionen
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedLeads.map((lead) => (
            <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  {lead.hasOpenTasks && (
                    <div title="Offene Aufgabe vorhanden" className="inline-flex">
                      <CheckCircle2 
                        className="h-4 w-4 flex-shrink-0" 
                        style={{ color: "#F59E0B" }}
                      />
                    </div>
                  )}
                  <Link
                    href={`/dashboard/leads/${lead.id}`}
                    className="font-medium text-gray-900 hover:underline"
                    style={{ "--hover-color": "#1A365D" } as React.CSSProperties}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#1A365D";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#111827";
                    }}
                  >
                    {showLocationAndRating 
                      ? (lead.company?.name || lead.name || "Unbekannt")
                      : (lead.name || "Unbekannt")}
                  </Link>
                </div>
                {!showLocationAndRating &&
                  lead.company?.name &&
                  lead.company.name !== "Unbekannt" &&
                  lead.company.name !== lead.name && (
                  <p className="text-sm text-gray-500 mt-1">{lead.company.name}</p>
                )}
                {showLocationAndRating && lead.company?.name && lead.name && lead.company.name !== lead.name && (
                  <p className="text-sm text-gray-500">{lead.name}</p>
                )}
                {lead.tags && lead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lead.tags.map((leadTag: any) => (
                      <Badge
                        key={leadTag.id}
                        variant="secondary"
                        className="text-xs"
                        style={{
                          backgroundColor: leadTag.tag.color + "20",
                          color: leadTag.tag.color,
                          borderColor: leadTag.tag.color + "40",
                        }}
                      >
                        {leadTag.tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </td>
              <td className="py-4 px-4">
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="hover:opacity-80"
                        style={{ color: "#1A365D" }}
                        title={`Kontakt: ${lead.phone}`}
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {lead.company?.phone && lead.company.phone !== lead.phone && (
                      <a
                        href={`tel:${lead.company.phone}`}
                        className="hover:opacity-80"
                        style={{ color: "#1A365D" }}
                        title={`Unternehmen: ${lead.company.phone}`}
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="hover:opacity-80"
                        style={{ color: "#1A365D" }}
                        title={lead.email}
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                    {lead.company?.website && (
                      <a
                        href={lead.company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:opacity-80"
                        style={{ color: "#1A365D" }}
                        title={lead.company.website}
                      >
                        <Globe className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  {lead.company?.address && (
                    <span className="text-xs text-gray-500 truncate max-w-[200px]" title={lead.company.address}>
                      {lead.company.address}
                    </span>
                  )}
                </div>
              </td>
              {showLocationAndRating && (
                <td className="py-4 px-4 text-sm text-gray-600">
                  {lead.company?.city && (
                    <div>
                      {lead.company.city}
                      {lead.company.state && `, ${lead.company.state}`}
                    </div>
                  )}
                </td>
              )}
              <td className="py-4 px-4">
                <Badge variant={statusColors[lead.status] || "default"}>
                  {statusLabels[lead.status] || lead.status}
                </Badge>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {lead.source && (
                    <Badge variant="secondary" className="text-xs">
                      {lead.source}
                    </Badge>
                  )}
                  {lead.utmSource && lead.utmCampaign && (() => {
                    const badgeColor = getUtmSourceBadgeColor(lead.utmSource);
                    const colorClassName = typeof badgeColor === "string" ? badgeColor : undefined;
                    const colorStyle = typeof badgeColor === "object" ? badgeColor : undefined;
                    return (
                      <Link href={`/dashboard/campaigns/${encodeURIComponent(normalizeUtmSource(lead.utmSource))}/${encodeURIComponent(lead.utmCampaign)}`}>
                        <Badge 
                          className={colorClassName ? `${colorClassName} text-xs hover:opacity-80 cursor-pointer` : "text-xs hover:opacity-80 cursor-pointer"}
                          style={colorStyle}
                          variant="secondary"
                        >
                          {normalizeUtmSource(lead.utmSource)}
                        </Badge>
                      </Link>
                    );
                  })()}
                  {!lead.source && !lead.utmSource && (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </td>
              {showLocationAndRating && (
                <td className="py-4 px-4">
                  {lead.company?.rating ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{lead.company.rating.toFixed(1)}</span>
                      <span className="text-sm text-gray-400">⭐</span>
                      {lead.company.reviewCount && (
                        <span className="text-sm text-gray-500">
                          ({lead.company.reviewCount})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
              )}
              <td className="py-4 px-4 text-sm text-gray-500">
                {formatDateTime(lead.lastActivityAt || lead.updatedAt)}
              </td>
              <td className="py-4 px-4">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(lead.id, lead.company?.name || lead.name)}
                    disabled={deleteMutation.isPending}
                    className="hover:opacity-80 hover:bg-gray-50"
                    style={{ color: "#1A365D" }}
                    title="Lead löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {effectiveTotal > effectivePageSize && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Zeige {startIndex + 1} bis {Math.min(endIndex, effectiveTotal)} von {effectiveTotal} Leads
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={effectivePage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Zeige nur erste, letzte und aktuelle Seite + Nachbarn
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= effectivePage - 1 && page <= effectivePage + 1)
                ) {
                  return (
                    <Button
                      key={page}
                      variant={effectivePage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (usingServerPagination) pagination!.onPageChange(page);
                        else setCurrentPage(page);
                      }}
                      className="min-w-[2.5rem]"
                    >
                      {page}
                    </Button>
                  );
                } else if (page === effectivePage - 2 || page === effectivePage + 2) {
                  return <span key={page} className="px-2">...</span>;
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={effectivePage === totalPages}
            >
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead wirklich löschen?</DialogTitle>
            <DialogDescription>
              Möchtest Du den Lead <strong>&quot;{leadToDelete?.name}&quot;</strong> wirklich löschen?
              <br />
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={deleteMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Löschen..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}