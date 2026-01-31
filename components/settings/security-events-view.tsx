"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { Activity, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface SecurityEvent {
  id: string;
  userId: string | null;
  accountId: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  description: string;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  account: {
    id: string;
    name: string;
  };
}

interface SecurityEventsResponse {
  items: SecurityEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function SecurityEventsView() {
  const queryClient = useQueryClient();
  const [selectedEventTypeFilter, setSelectedEventTypeFilter] = useState<string>("");
  const [securityEventsPage, setSecurityEventsPage] = useState(1);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);
  const [cleanupStats, setCleanupStats] = useState<any>(null);

  const { data: securityEvents, isLoading: securityEventsLoading } = useQuery({
    queryKey: ["security-events", selectedEventTypeFilter, securityEventsPage],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (selectedEventTypeFilter) {
        searchParams.append("eventType", selectedEventTypeFilter);
      }
      searchParams.append("page", securityEventsPage.toString());
      searchParams.append("pageSize", "50");

      const response = await fetch(`/api/security-events?${searchParams.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Laden der Security Events");
      }
      return response.json() as Promise<SecurityEventsResponse>;
    },
  });

  const { data: cleanupStatsData, refetch: refetchCleanupStats } = useQuery({
    queryKey: ["security-events-cleanup-stats", cleanupDays],
    queryFn: async () => {
      const response = await fetch(`/api/security-events/cleanup?days=${cleanupDays}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Abrufen der Cleanup-Statistiken");
      }
      return response.json();
    },
    enabled: isCleanupDialogOpen,
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/security-events/cleanup?days=${cleanupDays}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Bereinigen der Security Events");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["security-events"] });
      toast.success(data.message || "Security Events erfolgreich bereinigt");
      setIsCleanupDialogOpen(false);
      refetchCleanupStats();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Fehler beim Bereinigen der Security Events");
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-nowrap gap-4">
            <div className="flex-shrink-0">
              <CardTitle>Security Events & Login-Logs</CardTitle>
              <CardDescription>
                Übersicht über alle sicherheitsrelevanten Aktionen und Anmeldungen in Deinem Account
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCleanupDialogOpen(true);
                  refetchCleanupStats();
                }}
              >
                <Activity className="h-4 w-4 mr-2" />
                Bereinigen
              </Button>
              <Select
                value={selectedEventTypeFilter}
                onValueChange={(value) => {
                  setSelectedEventTypeFilter(value);
                  setSecurityEventsPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Alle Event-Typen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Alle Event-Typen</SelectItem>
                  <SelectItem value="LOGIN_SUCCESS">Login erfolgreich</SelectItem>
                  <SelectItem value="LOGIN_FAILED">Login fehlgeschlagen</SelectItem>
                  <SelectItem value="LEAD_DELETED">Lead gelöscht</SelectItem>
                  <SelectItem value="USER_DELETED">Benutzer gelöscht</SelectItem>
                  <SelectItem value="USER_ROLE_CHANGED">Rolle geändert</SelectItem>
                  <SelectItem value="USER_ACTIVATED">Benutzer aktiviert</SelectItem>
                  <SelectItem value="USER_DEACTIVATED">Benutzer deaktiviert</SelectItem>
                  <SelectItem value="PASSWORD_CHANGED">Passwort geändert</SelectItem>
                  <SelectItem value="ACCOUNT_ACTIVATED">Account aktiviert</SelectItem>
                  <SelectItem value="ACCOUNT_DEACTIVATED">Account deaktiviert</SelectItem>
                  <SelectItem value="WEBHOOK_DELETED">Webhook gelöscht</SelectItem>
                  <SelectItem value="NOTE_DELETED">Notiz gelöscht</SelectItem>
                  <SelectItem value="COMMUNICATION_DELETED">Kommunikation gelöscht</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {securityEventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : securityEvents && securityEvents.items.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Datum & Zeit</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Event-Typ</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Ausgeführt von</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Beschreibung</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">IP-Adresse</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">User-Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityEvents.items.map((event: SecurityEvent) => (
                      <tr key={event.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4 text-sm" style={{ color: "#2D3748" }}>
                          {formatDateTime(event.createdAt)}
                        </td>
                        <td className="py-4 px-4">
                          <Badge 
                            variant={
                              event.eventType === "LOGIN_SUCCESS" ? "success" :
                              event.eventType === "LOGIN_FAILED" ? "destructive" :
                              event.eventType.includes("DELETED") ? "destructive" :
                              event.eventType.includes("CHANGED") || event.eventType.includes("ACTIVATED") || event.eventType.includes("DEACTIVATED") ? "warning" :
                              "secondary"
                            }
                            className="whitespace-nowrap"
                          >
                            {event.eventType === "LOGIN_SUCCESS" ? "Login erfolgreich" :
                             event.eventType === "LOGIN_FAILED" ? "Login fehlgeschlagen" :
                             event.eventType.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-sm" style={{ color: "#2D3748" }}>
                          {event.user ? (
                            <div>
                              <div className="font-medium">{event.user.name || event.user.email}</div>
                              <div className="text-xs text-gray-500">{event.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">System</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm" style={{ color: "#2D3748" }}>
                          {event.description}
                        </td>
                        <td className="py-4 px-4 text-sm font-mono text-gray-600">
                          {event.ipAddress || "Unbekannt"}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600 max-w-xs truncate" title={event.userAgent || ""}>
                          {event.userAgent || "Unbekannt"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {securityEvents.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-gray-600">
                    Seite {securityEvents.page} von {securityEvents.totalPages} ({securityEvents.total} Einträge)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSecurityEventsPage((p) => Math.max(1, p - 1))}
                      disabled={securityEventsPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zurück
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSecurityEventsPage((p) => Math.min(securityEvents.totalPages, p + 1))}
                      disabled={securityEventsPage === securityEvents.totalPages}
                    >
                      Weiter
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Keine Security Events gefunden
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleanup Dialog */}
      <Dialog open={isCleanupDialogOpen} onOpenChange={setIsCleanupDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Security Events bereinigen</DialogTitle>
            <DialogDescription>
              Lösche alte Security Events, um Speicherplatz zu sparen. Empfohlen: Events älter als 30 Tage.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Events älter als (Tage)
              </label>
              <Input
                type="number"
                min="1"
                max="365"
                value={cleanupDays}
                onChange={(e) => {
                  const days = parseInt(e.target.value) || 30;
                  setCleanupDays(Math.max(1, Math.min(365, days)));
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Alle Events älter als {cleanupDays} Tage werden gelöscht
              </p>
            </div>

            {cleanupStatsData && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Gesamt Events:</span>
                  <span className="text-sm">{cleanupStatsData.totalEvents.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Werden gelöscht:</span>
                  <span className="text-sm text-red-600">{cleanupStatsData.eventsToDelete.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Werden behalten:</span>
                  <span className="text-sm text-green-600">{cleanupStatsData.eventsToKeep.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Geschätzter Speicherplatz:</span>
                    <span className="text-sm">{cleanupStatsData.estimatedSize.totalMB} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Wird freigegeben:</span>
                    <span className="text-sm text-red-600">{cleanupStatsData.estimatedSize.toDeleteMB} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Wird behalten:</span>
                    <span className="text-sm text-green-600">{cleanupStatsData.estimatedSize.toKeepMB} MB</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Warnung:</strong> Diese Aktion kann nicht rückgängig gemacht werden. 
                Stelle sicher, dass Du die Events nicht mehr benötigst.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCleanupDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending || (cleanupStatsData && cleanupStatsData.eventsToDelete === 0)}
            >
              {cleanupMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bereinigen...
                </>
              ) : (
                `Bereinigen (${cleanupStatsData?.eventsToDelete || 0} Events)`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
