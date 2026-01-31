"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAccountSettings, updateAccountSettings } from "@/lib/api/account";
import { Key, Eye, EyeOff, Save, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

export function AccountSettingsView() {
  const queryClient = useQueryClient();
  const [googlePlacesApiKey, setGooglePlacesApiKey] = useState("");
  const [mailgunApiKey, setMailgunApiKey] = useState("");
  const [mailgunDomain, setMailgunDomain] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showMailgunKey, setShowMailgunKey] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["account-settings"],
    queryFn: fetchAccountSettings,
  });

  useEffect(() => {
    if (settings?.settings) {
      const currentSettings = settings.settings as any;
      setGooglePlacesApiKey(currentSettings.googlePlacesApiKey || "");
      setMailgunApiKey(currentSettings.mailgunApiKey || "");
      setMailgunDomain(currentSettings.mailgunDomain || "");
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { 
      googlePlacesApiKey?: string;
      mailgunApiKey?: string;
      mailgunDomain?: string;
    }) => {
      return await updateAccountSettings(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      toast.success("Einstellungen erfolgreich gespeichert");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Fehler beim Speichern der Einstellungen");
    },
  });

  const handleSaveSettings = () => {
    const settings: any = {};
    
    // Nur Keys hinzufügen, die nicht leer sind
    const trimmedGoogleKey = googlePlacesApiKey.trim();
    if (trimmedGoogleKey) {
      settings.googlePlacesApiKey = trimmedGoogleKey;
    } else {
      settings.googlePlacesApiKey = null; // Explizit null, um zu löschen
    }
    
    const trimmedMailgunKey = mailgunApiKey.trim();
    if (trimmedMailgunKey) {
      settings.mailgunApiKey = trimmedMailgunKey;
    } else {
      settings.mailgunApiKey = null; // Explizit null, um zu löschen
    }
    
    const trimmedMailgunDomain = mailgunDomain.trim();
    if (trimmedMailgunDomain) {
      settings.mailgunDomain = trimmedMailgunDomain;
    } else {
      settings.mailgunDomain = null; // Explizit null, um zu löschen
    }
    
    updateSettingsMutation.mutate(settings);
  };

  if (isLoading) {
    return <div className="text-gray-500">Lade Einstellungen...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account-Einstellungen</CardTitle>
          <CardDescription>
            Verwalte die API-Keys und Einstellungen für Deinen Account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Key className="h-4 w-4" />
              Google Places API Key
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Dein eigener Google Places API Key. Wenn leer, wird der Standard-Key verwendet.
              So kannst Du Deine eigenen API-Kosten kontrollieren.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={googlePlacesApiKey}
                  onChange={(e) => setGooglePlacesApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {googlePlacesApiKey && (
              <p className="text-xs text-green-600">
                ✓ Account-spezifischer API Key ist konfiguriert
              </p>
            )}
            {!googlePlacesApiKey && (
              <p className="text-xs text-gray-500">
                Kein API Key hinterlegt - Standard-Key wird verwendet
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Key className="h-4 w-4" />
              Mailgun Private API Key
            </label>
            <p className="text-xs text-gray-500 mb-2">
              <strong>Wichtig:</strong> Verwende einen <strong>Private API Key</strong> aus dem Mailgun Dashboard. 
              Du findest diesen im Mailgun Dashboard unter <strong>Settings → API Keys</strong>. 
              Wenn leer, wird der Standard-Key aus den Environment-Variablen verwendet.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type={showMailgunKey ? "text" : "password"}
                  value={mailgunApiKey}
                  onChange={(e) => setMailgunApiKey(e.target.value)}
                  placeholder="bd743cb750a7daaec5b90b1b50dff9a1-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowMailgunKey(!showMailgunKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showMailgunKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Mailgun Domain
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Deine verifizierte Mailgun-Domain (z.B. mg.example.com)
            </p>
            <Input
              type="text"
              value={mailgunDomain}
              onChange={(e) => setMailgunDomain(e.target.value)}
              placeholder="mg.example.com"
            />
            {mailgunApiKey && mailgunDomain && (
              <p className="text-xs text-green-600">
                ✓ Mailgun-Konfiguration ist aktiviert
              </p>
            )}
            {(!mailgunApiKey || !mailgunDomain) && (
              <p className="text-xs text-gray-500">
                {!mailgunApiKey && !mailgunDomain 
                  ? "Mailgun API Key und Domain werden benötigt für E-Mail-Versand"
                  : !mailgunApiKey
                  ? "Mailgun API Key fehlt"
                  : "Mailgun Domain fehlt"}
              </p>
            )}
          </div>

          {/* Domain-Verifizierungsstatus (Account-spezifisch) */}
          {mailgunApiKey && mailgunDomain && (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Account-spezifische Mailgun-Verifizierung
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Verifizierungsstatus für Deine konfigurierte Mailgun-Domain
                </p>
                <DomainVerificationStatus domain={mailgunDomain} />
              </div>

              {/* Mailgun Webhook URL */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Mailgun Webhook für eingehende Mitteilungen
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Diese URL muss in Deinem Mailgun Dashboard konfiguriert werden, um E-Mail-Events (delivered, opened, clicked, bounced, etc.) zu empfangen.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/mailgun` : ""}
                      readOnly
                      className="font-mono text-xs bg-gray-50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/mailgun` : "";
                        navigator.clipboard.writeText(url);
                        toast.success("Webhook-URL in Zwischenablage kopiert");
                      }}
                    >
                      Kopieren
                    </Button>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs text-blue-800 font-medium mb-1">
                      📋 So konfigurierst Du den Webhook in Mailgun:
                    </p>
                    <ol className="text-xs text-blue-700 list-decimal list-inside space-y-1 ml-2">
                      <li>Öffne das Mailgun Dashboard</li>
                      <li>Gehe zu <strong>Sending → Webhooks</strong></li>
                      <li>Klicke auf <strong>&quot;Add Webhook&quot;</strong></li>
                      <li>Füge die obige URL ein</li>
                      <li>Wähle die Events aus, die Du empfangen möchtest:
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>delivered (Zugestellt)</li>
                          <li>opened (Geöffnet)</li>
                          <li>clicked (Geklickt)</li>
                          <li>bounced (Abgewiesen)</li>
                          <li>failed (Fehlgeschlagen)</li>
                          <li>complained (Als Spam markiert)</li>
                          <li>unsubscribed (Abgemeldet)</li>
                        </ul>
                      </li>
                      <li>Speichere den Webhook</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Globale Mailgun-Verifizierung (aus ENV) - nur anzeigen, wenn keine Account-Konfiguration vorhanden */}
          {(!mailgunApiKey || !mailgunDomain) && (
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Mailgun-Verifizierung (ENV-Variablen)
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Prüfe den Verifizierungsstatus der globalen Mailgun-Domain aus den Environment-Variablen
              </p>
              <GlobalDomainVerificationStatus />
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateSettingsMutation.isPending ? "Wird gespeichert..." : "Einstellungen speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Domain-Verifizierungsstatus Komponente
function DomainVerificationStatus({ domain }: { domain: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["mailgun-domain-status"],
    queryFn: async () => {
      const response = await fetch("/api/mailgun/domain-status");
      if (!response.ok) {
        throw new Error("Fehler beim Abrufen des Domain-Status");
      }
      return response.json();
    },
    enabled: !!domain,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Domain-Status aktualisiert");
    } catch (error) {
      toast.error("Fehler beim Aktualisieren des Status");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "invalid":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "not_set":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "valid":
        return "Verifiziert";
      case "invalid":
        return "Ungültig";
      case "not_set":
        return "Nicht gesetzt";
      default:
        return "Unbekannt";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "valid":
        return "text-green-600";
      case "invalid":
        return "text-red-600";
      case "not_set":
        return "text-yellow-600";
      default:
        return "text-gray-400";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Domain-Verifizierung
          </label>
          <p className="text-xs text-gray-500">Lädt...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Domain-Verifizierung
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3 w-3 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>
      
      {status.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-xs text-red-600">{status.error}</p>
        </div>
      )}

      {!status.error && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                {getStatusIcon(status.isVerified ? "valid" : "invalid")}
                <span className="text-sm font-medium">Domain-Status</span>
              </div>
              <span className={`text-xs font-medium ${status.isVerified ? "text-green-600" : "text-red-600"}`}>
                {status.isVerified ? "Verifiziert" : "Nicht verifiziert"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.spfStatus)}
                  <span className="text-xs">SPF</span>
                </div>
                <span className={`text-xs ${getStatusColor(status.spfStatus)}`}>
                  {getStatusText(status.spfStatus)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.dkimStatus)}
                  <span className="text-xs">DKIM</span>
                </div>
                <span className={`text-xs ${getStatusColor(status.dkimStatus)}`}>
                  {getStatusText(status.dkimStatus)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.dmarcStatus)}
                  <span className="text-xs">DMARC</span>
                </div>
                <span className={`text-xs ${getStatusColor(status.dmarcStatus)}`}>
                  {getStatusText(status.dmarcStatus)}
                </span>
              </div>
            </div>
          </div>

          {!status.isVerified && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs text-yellow-800 mb-2">
                <strong>Hinweis:</strong> Die Domain ist nicht vollständig verifiziert. 
                Dies kann dazu führen, dass E-Mails im Spam landen.
              </p>
              <p className="text-xs text-yellow-700">
                Bitte prüfe die DNS-Einträge in Mailgun Dashboard unter <strong>Sending → Domains → {domain}</strong>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Globale Domain-Verifizierungsstatus Komponente (für ENV-Variablen)
function GlobalDomainVerificationStatus() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: status, isLoading, refetch, error: queryError } = useQuery({
    queryKey: ["mailgun-global-domain-status"],
    queryFn: async () => {
      const response = await fetch("/api/mailgun/domain-status-global");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Abrufen des Domain-Status");
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
    retry: false, // Keine Wiederholung bei Fehlern (z.B. wenn ENV nicht gesetzt)
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Domain-Status aktualisiert");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Aktualisieren des Status");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "invalid":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "not_set":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "valid":
        return "Verifiziert";
      case "invalid":
        return "Ungültig";
      case "not_set":
        return "Nicht gesetzt";
      default:
        return "Unbekannt";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "valid":
        return "text-green-600";
      case "invalid":
        return "text-red-600";
      case "not_set":
        return "text-yellow-600";
      default:
        return "text-gray-400";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Domain-Verifizierung
          </label>
          <p className="text-xs text-gray-500">Lädt...</p>
        </div>
      </div>
    );
  }

  // Zeige Fehler oder "nicht konfiguriert" an
  if (queryError || (!isLoading && !status)) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded">
        <p className="text-sm text-gray-600">
          Keine Domain-Konfiguration gefunden. Bitte prüfe die ENV-Variablen:
        </p>
        <ul className="mt-2 text-xs text-gray-500 list-disc list-inside space-y-1">
          <li>MAILGUN_API_KEY</li>
          <li>MAILGUN_DOMAIN</li>
          <li>MAILGUN_REGION (optional)</li>
        </ul>
        {queryError && (
          <p className="mt-2 text-xs text-red-600">
            Fehler: {queryError instanceof Error ? queryError.message : "Unbekannter Fehler"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Domain-Verifizierung
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3 w-3 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>
      
      {status.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-xs text-red-600">{status.error}</p>
        </div>
      )}

      {!status.error && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                {getStatusIcon(status.isVerified ? "valid" : "invalid")}
                <span className="text-sm font-medium">Domain-Status</span>
              </div>
              <span className={`text-xs font-medium ${status.isVerified ? "text-green-600" : "text-red-600"}`}>
                {status.isVerified ? "Verifiziert" : "Nicht verifiziert"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.spfStatus)}
                  <span className="text-xs">SPF</span>
                </div>
                <span className={`text-xs ${getStatusColor(status.spfStatus)}`}>
                  {getStatusText(status.spfStatus)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.dkimStatus)}
                  <span className="text-xs">DKIM</span>
                </div>
                <span className={`text-xs ${getStatusColor(status.dkimStatus)}`}>
                  {getStatusText(status.dkimStatus)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.dmarcStatus)}
                  <span className="text-xs">DMARC</span>
                </div>
                <span className={`text-xs ${getStatusColor(status.dmarcStatus)}`}>
                  {getStatusText(status.dmarcStatus)}
                </span>
              </div>
            </div>
          </div>

          {status.domain && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs text-blue-800">
                <strong>Domain:</strong> {status.domain}
              </p>
            </div>
          )}

          {!status.isVerified && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs text-yellow-800 mb-2">
                <strong>Hinweis:</strong> Die Domain ist nicht vollständig verifiziert. 
                Dies kann dazu führen, dass E-Mails im Spam landen.
              </p>
              <p className="text-xs text-yellow-700">
                Bitte prüfe die DNS-Einträge in Mailgun Dashboard unter <strong>Sending → Domains → {status.domain}</strong>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
