"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Route, MapPin, Loader2 } from "lucide-react";
import { fetchLeads } from "@/lib/api/leads";
import toast from "react-hot-toast";

export function RoutePlannerView() {
  const [startAddress, setStartAddress] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  const { data } = useQuery({
    queryKey: ["leads"],
    queryFn: () => fetchLeads({ page: 1, pageSize: 100 }),
  });
  const leads = data?.items || [];

  const planRouteMutation = useMutation({
    mutationFn: async ({ addresses }: { addresses: string[] }) => {
      // Route-Planung Feature (noch nicht implementiert)
      // Placeholder: Simuliere Route-Planung
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            optimizedRoute: addresses,
            totalDistance: "45.2 km",
            estimatedTime: "1h 15min",
          });
        }, 1000);
      });
    },
    onSuccess: (data: any) => {
      toast.success(`Route optimiert: ${data.totalDistance}, ${data.estimatedTime}`);
    },
    onError: () => {
      toast.error("Fehler bei der Route-Planung");
    },
  });

  const handleToggleLead = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handlePlanRoute = () => {
    if (!startAddress.trim()) {
      toast.error("Bitte gib eine Startadresse ein");
      return;
    }

    if (selectedLeads.length === 0) {
      toast.error("Bitte wähle mindestens einen Lead aus");
      return;
    }

    const selectedLeadData = leads?.filter((lead: any) =>
      selectedLeads.includes(lead.id)
    );
    const addresses = [
      startAddress,
      ...(selectedLeadData?.map((lead: any) => lead.company?.address || `${lead.company?.city || ""}, ${lead.company?.state || ""}`) || []),
    ];

    planRouteMutation.mutate({ addresses });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI-Route-Planner</h1>
        <p className="text-gray-500 mt-1">
          Optimieren Sie Ihre Besuchs- und Akquise-Routen für den Außendienst
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Route konfigurieren</CardTitle>
              <CardDescription>
                Wähle Deine Startadresse und Leads für die optimale Route
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Startadresse *
                </label>
                <Input
                  placeholder="z.B. Hauptstraße 1, 12345 Berlin"
                  value={startAddress}
                  onChange={(e) => setStartAddress(e.target.value)}
                />
              </div>
              <Button
                onClick={handlePlanRoute}
                disabled={planRouteMutation.isPending}
                className="w-full"
              >
                {planRouteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Route wird optimiert...
                  </>
                ) : (
                  <>
                    <Route className="mr-2 h-4 w-4" />
                    Route optimieren
                  </>
                )}
              </Button>

              {planRouteMutation.data && (
                <Card className="bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Gesamtstrecke:</span>
                        <span>{(planRouteMutation.data as any).totalDistance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Geschätzte Zeit:</span>
                        <span>{(planRouteMutation.data as any).estimatedTime}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {planRouteMutation.data && (
            <Card>
              <CardHeader>
                <CardTitle>Optimierte Route</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {(planRouteMutation.data as any).optimizedRoute?.map((address: string, index: number) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{address}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Leads auswählen</CardTitle>
              <CardDescription>
                {selectedLeads.length} von {leads?.length || 0} ausgewählt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {leads?.map((lead: any) => (
                  <label
                    key={lead.id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => handleToggleLead(lead.id)}
                      className="mt-1 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {lead.company?.name || lead.name}
                      </p>
                      {lead.company?.address && (
                        <p className="text-xs text-gray-500 truncate">{lead.company.address}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <p className="text-sm text-yellow-800">
            <strong>Hinweis:</strong> Die Route-Planung nutzt aktuell eine Platzhalter-Implementierung.
            Für die Produktion sollte die Google Maps Directions API oder eine ähnliche Routing-API integriert werden.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}