"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getRecentWebhookRequests,
  testIncomingWebhook,
} from "@/lib/api/leads";
import { Plus, Trash2, Edit, Copy, Check, Webhook, ExternalLink, Play, Settings } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";

export function WebhooksView() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [monitorDialogOpen, setMonitorDialogOpen] = useState(false);
  const [monitoringWebhook, setMonitoringWebhook] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [webhookToEdit, setWebhookToEdit] = useState<any>(null);
  const [webhookToDelete, setWebhookToDelete] = useState<any>(null);
  const [webhookToTest, setWebhookToTest] = useState<any>(null);
  const [webhookToMap, setWebhookToMap] = useState<any>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [testPayload, setTestPayload] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [jsonExample, setJsonExample] = useState("");
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [pendingMappingDialog, setPendingMappingDialog] = useState(false);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [testJsonFields, setTestJsonFields] = useState<Record<string, any>>({});
  
  const [formData, setFormData] = useState({
    name: "",
    source: "",
    url: "",
    isActive: true,
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: fetchWebhooks,
  });

  // Debug: Log jsonExample wenn sich mappingDialogOpen ändert
  useEffect(() => {
    if (mappingDialogOpen) {
      console.log("Field Mapping Dialog geöffnet");
      console.log("jsonExample:", jsonExample);
      console.log("jsonExample length:", jsonExample?.length || 0);
      console.log("detectedFields:", detectedFields);
    }
  }, [mappingDialogOpen, jsonExample, detectedFields]);

  // Öffne Mapping-Dialog wenn JSON gesetzt wurde und pendingMappingDialog true ist
  useEffect(() => {
    if (pendingMappingDialog && jsonExample && jsonExample.length > 0) {
      console.log("Opening mapping dialog with JSON:", jsonExample.substring(0, 100));
      setMappingDialogOpen(true);
      setPendingMappingDialog(false);
    }
  }, [pendingMappingDialog, jsonExample]);

  // Lade Webhook-Logs beim Öffnen des Monitoring-Dialogs
  useEffect(() => {
    if (monitorDialogOpen && monitoringWebhook) {
      const loadLogs = async () => {
        try {
          console.log("Loading webhook logs for webhook:", monitoringWebhook.id);
          const data = await getRecentWebhookRequests(monitoringWebhook.id);
          console.log("Loaded webhook logs:", data);
          if (data.requests && data.requests.length > 0) {
            setWebhookLogs(data.requests);
          } else {
            setWebhookLogs([]);
          }
        } catch (error) {
          console.error("Error loading webhook logs:", error);
          setWebhookLogs([]);
        }
      };
      loadLogs();
    }
  }, [monitorDialogOpen, monitoringWebhook]);

  const createMutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook erfolgreich erstellt");
      setCreateDialogOpen(false);
      setFormData({ name: "", source: "", url: "", isActive: true });
      // Zeige Secret in Toast
      if (data.secret) {
        toast.success(`Secret: ${data.secret}`, { duration: 10000 });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Erstellen des Webhooks");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateWebhook(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook erfolgreich aktualisiert");
      setEditDialogOpen(false);
      setWebhookToEdit(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Aktualisieren des Webhooks");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook erfolgreich gelöscht");
      setDeleteDialogOpen(false);
      setWebhookToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Löschen des Webhooks");
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.source.trim()) {
      toast.error("Name und Quelle sind erforderlich");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (webhook: any) => {
    setWebhookToEdit(webhook);
    setFormData({
      name: webhook.name,
      source: webhook.source,
      url: webhook.url || "",
      isActive: webhook.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!webhookToEdit) return;
    if (!formData.name.trim() || !formData.source.trim()) {
      toast.error("Name und Quelle sind erforderlich");
      return;
    }
    updateMutation.mutate({ id: webhookToEdit.id, data: formData });
  };

  const handleDelete = (webhook: any) => {
    setWebhookToDelete(webhook);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (webhookToDelete) {
      deleteMutation.mutate(webhookToDelete.id);
    }
  };

  const getWebhookUrl = (webhook: any) => {
    if (typeof window === "undefined") return "";
    
    // Alle Webhooks verwenden die webhookId (ohne Secret erforderlich)
    if (webhook.webhookId) {
      return `${window.location.origin}/api/webhooks/incoming/${webhook.webhookId}`;
    }
    
    return "";
  };

  const getConnectorScript = (webhook: any) => {
    if (typeof window === "undefined" || !webhook.webhookId) return "";
    
    const scriptUrl = `${window.location.origin}/connector.js`;
    return `<script 
  src="${scriptUrl}" 
  data-webhook-id="${webhook.webhookId}"
></script>`;
  };

  const copyToClipboard = (text: string, type: "secret" | "url" | "script") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(text);
      toast.success("Script-Tag kopiert");
      setTimeout(() => setCopiedScript(null), 2000);
    } else {
      setCopiedSecret(type === "secret" ? text : type);
      toast.success(type === "secret" ? "Secret kopiert" : "URL kopiert");
      setTimeout(() => setCopiedSecret(null), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-gray-500 mt-1">
          Verwalte Deine Webhooks und Integrationen
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Verwalte eingehende Webhooks für automatische Lead-Erstellung
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : webhooks && webhooks.length > 0 ? (
            <div className="space-y-4">
              {webhooks.map((webhook: any) => {
                // Hole URL für Anzeige
                const webhookUrl = getWebhookUrl(webhook);

                return (
                  <div
                    key={webhook.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Webhook className="h-5 w-5 text-gray-400" />
                          <h3 className="font-semibold text-lg">{webhook.name}</h3>
                          <Badge
                            variant={webhook.isActive ? "success" : "default"}
                          >
                            {webhook.isActive ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">Quelle:</span> {webhook.source}
                          </p>
                          {webhook.url && (
                            <p>
                              <span className="font-medium">URL:</span>{" "}
                              <a
                                href={webhook.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {webhook.url}
                                <ExternalLink className="h-3 w-3 inline ml-1" />
                              </a>
                            </p>
                          )}
                          {webhookUrl && (
                            <div className="mt-2 space-y-3">
                              {/* Simpalo Connector Script */}
                              <div className="p-3 bg-green-50 rounded border border-green-200">
                                <p className="text-xs font-medium text-green-700 mb-2">
                                  📦 Simpalo Connector Script (für Kundenwebseiten):
                                </p>
                                <div className="flex items-start gap-2">
                                  <code className="text-xs flex-1 bg-white px-2 py-2 rounded border border-green-200 break-all whitespace-pre-wrap">
                                    {getConnectorScript(webhook)}
                                  </code>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(getConnectorScript(webhook), "script")}
                                    className="flex-shrink-0"
                                  >
                                    {copiedScript === getConnectorScript(webhook) ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <p className="text-xs text-green-600 mt-2">
                                  Kopiere dieses Script-Tag und füge es am Ende des &lt;body&gt; Tags der Kundenwebseite ein. 
                                  Es fängt automatisch alle Formular-Submits ab und sendet sie an diesen Webhook.
                                </p>
                              </div>

                              {/* Webhook URL */}
                              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                                <p className="text-xs font-medium text-blue-700 mb-2">
                                  📥 Eingehender Webhook URL:
                                </p>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs flex-1 bg-white px-2 py-1 rounded border border-blue-200 break-all">
                                    {webhookUrl}
                                  </code>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(webhookUrl, "url")}
                                    className="flex-shrink-0"
                                  >
                                    {copiedSecret === "url" ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <p className="text-xs text-blue-600 mt-2">
                                  Diese URL kann direkt in Zoho, GoHighLevel oder anderen Systemen als eingehender Webhook konfiguriert werden.
                                </p>
                              </div>

                              {/* Feld-Mapping */}
                              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                <p className="text-xs text-gray-700 font-medium mb-1">
                                  ⚙️ Wichtig: Feld-Mapping konfigurieren
                                </p>
                                <p className="text-xs text-gray-600 mb-2">
                                  Ordne die JSON-Felder aus dem Webhook-Payload den Kontaktfeldern zu, damit die Daten korrekt gespeichert werden.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setWebhookToMap(webhook);
                                    setFieldMapping((webhook.settings as any)?.fieldMapping || {});
                                    setMappingDialogOpen(true);
                                  }}
                                  className="w-full text-xs"
                                >
                                  <Settings className="h-3 w-3 mr-1" />
                                  Feld-Mapping konfigurieren
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setWebhookToMap(webhook);
                            setFieldMapping((webhook.settings as any)?.fieldMapping || {});
                            setMappingDialogOpen(true);
                          }}
                          title="Feld-Mapping konfigurieren"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMonitoringWebhook(webhook);
                            setIsMonitoring(true);
                            setMonitorDialogOpen(true);
                          }}
                          title="Auf eingehenden Webhook warten"
                          className={isMonitoring && monitoringWebhook?.id === webhook.id ? "bg-blue-100 border-blue-400" : ""}
                        >
                          <Webhook className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            // Öffne Field Mapping Dialog und lade das neueste JSON automatisch
                            setWebhookToMap(webhook);
                            setFieldMapping((webhook.settings as any)?.fieldMapping || {});
                            
                            // Versuche das neueste Webhook-JSON zu laden
                            try {
                              const data = await getRecentWebhookRequests(webhook.id);
                              if (data.requests && data.requests.length > 0) {
                                const latestLog = data.requests[0];
                                setJsonExample(JSON.stringify(latestLog.payload, null, 2));
                                setDetectedFields(Object.keys(latestLog.payload as any));
                              } else {
                                // Kein JSON vorhanden - Dialog öffnet sich leer
                                setJsonExample("");
                                setDetectedFields([]);
                              }
                            } catch (error) {
                              console.error("Error loading webhook logs:", error);
                              setJsonExample("");
                              setDetectedFields([]);
                            }
                            
                            setMappingDialogOpen(true);
                          }}
                          title="Feld-Mapping konfigurieren - Lädt automatisch das neueste JSON"
                        >
                          <Settings className="h-4 w-4" />
                          Feld-Mapping
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(webhook)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(webhook)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Webhook className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Noch keine Webhooks vorhanden</p>
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ersten Webhook erstellen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Webhook erstellen</DialogTitle>
            <DialogDescription>
              Erstelle einen neuen Webhook für eingehende Leads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <Input
                placeholder="z.B. Website Formular"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead-Quelle *
              </label>
              <Input
                placeholder="z.B. Website Form, Zapier, Typeform"
                value={formData.source}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Diese Quelle wird beim erstellten Lead gespeichert
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL (optional)
              </label>
              <Input
                placeholder="https://example.com/webhook"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setFormData({ name: "", source: "", url: "", isActive: true });
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Wird erstellt..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook bearbeiten</DialogTitle>
            <DialogDescription>
              Aktualisieren Sie die Webhook-Einstellungen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <Input
                placeholder="z.B. Website Formular"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead-Quelle *
              </label>
              <Input
                placeholder="z.B. Website Form, Zapier, Typeform"
                value={formData.source}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL (optional)
              </label>
              <Input
                placeholder="https://example.com/webhook"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Webhook aktiv
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setWebhookToEdit(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Wird aktualisiert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook löschen</DialogTitle>
            <DialogDescription>
              Möchtest Du den Webhook <strong>&quot;{webhookToDelete?.name}&quot;</strong> wirklich löschen?
              <br />
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setWebhookToDelete(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Wird gelöscht..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Webhook Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook testen</DialogTitle>
            <DialogDescription>
              Testen Sie den Webhook mit einem Beispiel-Payload
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test-Payload (JSON):
              </label>
              <Textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder='{"firstName": "Max", "lastName": "Mustermann", "email": "max@example.com", ...}'
              />
            </div>
            <Button
              onClick={async () => {
                try {
                  const payload = JSON.parse(testPayload);
                  const result = await testWebhook(webhookToTest.id, payload);
                  setTestResult(result);
                  toast.success("Webhook-Test erfolgreich");
                } catch (error: any) {
                  toast.error(error.message || "Fehler beim Testen des Webhooks");
                  setTestResult({ error: error.message });
                }
              }}
              disabled={!testPayload.trim()}
            >
              <Play className="h-4 w-4 mr-2" />
              Test ausführen
            </Button>
            {testResult && (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Gemappte Daten:</h4>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(testResult.mappedData, null, 2)}
                  </pre>
                </div>
                {testResult.mappingDetails && (
                  <div>
                    <h4 className="font-medium mb-2">Feld-Mapping Details:</h4>
                    <div className="space-y-2">
                      {Object.entries(testResult.mappingDetails).map(([key, details]: [string, any]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <span className="font-medium w-32">{key}:</span>
                          <span className="text-gray-600">{details.mappedFrom}</span>
                          <Badge variant={details.found ? "success" : "default"}>
                            {details.found ? "✓ Gefunden" : "✗ Nicht gefunden"}
                          </Badge>
                          {details.value && (
                            <span className="text-gray-500">→ {String(details.value)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTestDialogOpen(false);
                setTestPayload("");
                setTestResult(null);
              }}
            >
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={(open) => {
        setMappingDialogOpen(open);
        if (!open) {
          // Reset JSON wenn Dialog geschlossen wird
          setJsonExample("");
          setDetectedFields([]);
          setPendingMappingDialog(false);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feld-Mapping konfigurieren</DialogTitle>
            <DialogDescription>
              {jsonExample 
                ? "Die Felder aus dem JSON werden automatisch erkannt. Ordne sie den Datenbankfeldern zu."
                : "Gib ein JSON-Beispiel ein, um die Felder automatisch zu erkennen und zuzuordnen. Oder sende einen Test-Webhook, damit das JSON automatisch geladen wird."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
            {/* Linke Seite: JSON-Eingabe und erkannte Felder */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  JSON-Beispiel aus Ihrem System
                </label>
                <Textarea
                  placeholder='{"vorname": "Max", "nachname": "Mustermann", "email": "max@example.com", "telefon": "+49 123 456789", "firma": "Mustermann GmbH", "adresse": "Musterstraße 1", "stadt": "Berlin", "plz": "12345"}'
                  value={jsonExample}
                  onChange={(e) => {
                    setJsonExample(e.target.value);
                    try {
                      const parsed = JSON.parse(e.target.value);
                      const fields = Object.keys(parsed);
                      setDetectedFields(fields);
                    } catch (error) {
                      setDetectedFields([]);
                    }
                  }}
                  rows={15}
                  className="font-mono text-xs bg-white border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  style={{ minHeight: "300px" }}
                />
                {detectedFields.length > 0 && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-xs text-green-700 font-medium mb-1">
                      ✓ {detectedFields.length} Felder erkannt:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {detectedFields.map((field) => (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {jsonExample && detectedFields.length === 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-700">
                      ⚠️ Ungültiges JSON. Bitte korrigiere die Syntax.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rechte Seite: Zuordnung */}
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <p className="text-sm text-blue-800 font-medium mb-1">
                  💡 Wie funktioniert das?
                </p>
                <p className="text-xs text-blue-700">
                  Geben Sie links ein JSON-Beispiel ein. Die erkannten Felder werden automatisch angezeigt.
                  <br />
                  Wählen Sie dann rechts für jedes Datenbankfeld das entsprechende JSON-Feld aus.
                </p>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {[
                  { dbField: "firstName", label: "Vorname", hint: "firstName, first_name, vorname, givenName" },
                  { dbField: "lastName", label: "Nachname", hint: "lastName, last_name, nachname, surname, familyName" },
                  { dbField: "name", label: "Vollständiger Name (Fallback)", hint: "name, fullName, full_name (wird verwendet wenn firstName/lastName fehlen)" },
                  { dbField: "businessName", label: "Firmenname", hint: "company, firma, businessName, unternehmen" },
                  { dbField: "email", label: "E-Mail", hint: "email, emailAddress, eMail" },
                  { dbField: "phone", label: "Telefon", hint: "phone, telephone, phoneNumber, telefon" },
                  { dbField: "website", label: "Website", hint: "website, url, websiteUrl, webseite" },
                  { dbField: "address", label: "Adresse", hint: "address, street, formatted_address, strasse" },
                  { dbField: "city", label: "Stadt", hint: "city, stadt, ort" },
                  { dbField: "state", label: "Bundesland", hint: "state, province, bundesland" },
                  { dbField: "zipCode", label: "Postleitzahl", hint: "zipCode, zip, postalCode, postcode, plz" },
                  { dbField: "country", label: "Land", hint: "country, land" },
                  { dbField: "utmSource", label: "UTM Source", hint: "utmSource, utm_source" },
                  { dbField: "utmMedium", label: "UTM Medium", hint: "utmMedium, utm_medium" },
                  { dbField: "utmCampaign", label: "UTM Campaign", hint: "utmCampaign, utm_campaign" },
                  { dbField: "utmTerm", label: "UTM Term", hint: "utmTerm, utm_term" },
                  { dbField: "utmContent", label: "UTM Content", hint: "utmContent, utm_content" },
                ].map((field) => (
                  <div key={field.dbField} className="border border-gray-200 rounded p-3 bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label} <span className="text-gray-500 font-normal text-xs">({field.dbField})</span>
                    </label>
                    {detectedFields.length > 0 ? (
                      <select
                        value={fieldMapping[field.dbField] || ""}
                        onChange={(e) =>
                          setFieldMapping({
                            ...fieldMapping,
                            [field.dbField]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Automatisch erkennen --</option>
                        {detectedFields.map((jsonField) => (
                          <option key={jsonField} value={jsonField}>
                            {jsonField}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        placeholder={`z.B. ${field.hint.split(", ")[0]}`}
                        value={fieldMapping[field.dbField] || ""}
                        onChange={(e) =>
                          setFieldMapping({
                            ...fieldMapping,
                            [field.dbField]: e.target.value,
                          })
                        }
                        className="bg-white"
                      />
                    )}
                    {detectedFields.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Mögliche Feldnamen: {field.hint}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMappingDialogOpen(false);
                setFieldMapping({});
                setJsonExample("");
                setDetectedFields([]);
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={async () => {
                try {
                  const currentSettings = (webhookToMap.settings as any) || {};
                  await updateWebhook(webhookToMap.id, {
                    settings: {
                      ...currentSettings,
                      fieldMapping: fieldMapping,
                    },
                  });
                  queryClient.invalidateQueries({ queryKey: ["webhooks"] });
                  toast.success("Feld-Mapping gespeichert");
                  setMappingDialogOpen(false);
                  setFieldMapping({});
                  setJsonExample("");
                  setDetectedFields([]);
                } catch (error: any) {
                  toast.error(error.message || "Fehler beim Speichern");
                }
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monitoring Dialog - Auf eingehende Webhooks warten */}
      <Dialog open={monitorDialogOpen} onOpenChange={(open) => {
        setMonitorDialogOpen(open);
        if (!open) {
          setIsMonitoring(false);
          if ((window as any).webhookPollingInterval) {
            clearInterval((window as any).webhookPollingInterval);
            (window as any).webhookPollingInterval = null;
          }
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook-Monitoring</DialogTitle>
            <DialogDescription>
              Warten auf eingehende Webhooks für: <strong>{monitoringWebhook?.name}</strong>
              <br />
              Sende einen Test-Webhook oder warte auf echte eingehende Webhooks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Test-Button */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <p className="text-sm font-medium text-blue-800 mb-2">
                🧪 Test-Webhook senden
              </p>
              <p className="text-xs text-blue-700 mb-3">
                Senden Sie einen Test-Webhook, um die Felder zu erkennen und zuzuordnen.
              </p>
              <Button
                onClick={async () => {
                  try {
                    const testPayload = {
                      vorname: "Max",
                      nachname: "Mustermann",
                      email: "max@mustermann.de",
                      telefon: "+49 123 456789",
                      firma: "Mustermann GmbH",
                      adresse: "Musterstraße 1",
                      stadt: "Berlin",
                      plz: "12345",
                    };
                    // Verwende testWebhook statt testIncomingWebhook - erstellt KEINE Leads
                    const result = await testWebhook(monitoringWebhook.id, testPayload);
                    toast.success("Test-Webhook erfolgreich! (Kein Lead erstellt)");
                    // Öffne Field Mapping Dialog mit dem Payload
                    setWebhookToMap(monitoringWebhook);
                    setJsonExample(JSON.stringify(testPayload, null, 2));
                    setDetectedFields(Object.keys(testPayload));
                    setMappingDialogOpen(true);
                    setMonitorDialogOpen(false);
                  } catch (error: any) {
                    toast.error(error.message || "Fehler beim Testen des Webhooks");
                  }
                }}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Test-Webhook senden
              </Button>
            </div>

            {/* Webhook-URL anzeigen */}
            {monitoringWebhook && (
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <p className="text-xs font-medium text-gray-700 mb-1">
                  Webhook URL:
                </p>
                <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 break-all block">
                  {typeof window !== "undefined" && `${window.location.origin}/api/webhooks/incoming/${monitoringWebhook.webhookId}`}
                </code>
                <p className="text-xs text-gray-500 mt-2">
                  Kopiere diese URL und sende einen POST-Request mit Deinem JSON-Payload.
                </p>
              </div>
            )}

            {/* Status */}
            <div className={`p-3 rounded border ${isMonitoring ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <p className="text-sm font-medium">
                  {isMonitoring ? 'Monitoring aktiv...' : 'Monitoring gestoppt'}
                </p>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {isMonitoring 
                  ? 'Warte auf eingehende Webhooks. Neue Requests werden automatisch erkannt.'
                  : 'Klicke auf "Monitoring starten" um zu beginnen.'}
              </p>
            </div>

            {/* Letzte Requests */}
            <div>
              <h4 className="font-medium mb-2">Letzte eingehende Webhooks:</h4>
              {webhookLogs.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {webhookLogs.map((log, index) => (
                    <div
                      key={log.id || index}
                      className="border border-gray-200 rounded p-3 bg-white hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        // Öffne Field Mapping Dialog mit diesem Payload
                        setWebhookToMap(monitoringWebhook);
                        const jsonString = JSON.stringify(log.payload, null, 2);
                        console.log("Setting JSON for field mapping:", jsonString);
                        console.log("Payload:", log.payload);
                        
                        // Setze JSON und Felder
                        setJsonExample(jsonString);
                        try {
                          const fields = Object.keys(log.payload);
                          console.log("Detected fields:", fields);
                          setDetectedFields(fields);
                        } catch (e) {
                          console.error("Error detecting fields:", e);
                          setDetectedFields([]);
                        }
                        
                        // Schließe Monitoring-Dialog
                        setMonitorDialogOpen(false);
                        
                        // Markiere, dass der Dialog geöffnet werden soll (useEffect wird den Dialog öffnen, wenn JSON gesetzt ist)
                        setPendingMappingDialog(true);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.success ? "success" : "destructive"}>
                            {log.success ? "✓ Erfolg" : "✗ Fehler"}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleString('de-DE')}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWebhookToMap(monitoringWebhook);
                            const jsonString = JSON.stringify(log.payload, null, 2);
                            console.log("Setting JSON for field mapping (button):", jsonString);
                            console.log("Payload (button):", log.payload);
                            
                            // Setze JSON und Felder
                            setJsonExample(jsonString);
                            try {
                              const fields = Object.keys(log.payload);
                              console.log("Detected fields (button):", fields);
                              setDetectedFields(fields);
                            } catch (err) {
                              console.error("Error detecting fields (button):", err);
                              setDetectedFields([]);
                            }
                            
                            // Schließe Monitoring-Dialog
                            setMonitorDialogOpen(false);
                            
                            // Markiere, dass der Dialog geöffnet werden soll (useEffect wird den Dialog öffnen, wenn JSON gesetzt ist)
                            setPendingMappingDialog(true);
                          }}
                        >
                          Felder zuordnen
                        </Button>
                      </div>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                      {log.error && (
                        <p className="text-xs text-red-600 mt-1">Fehler: {log.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  Noch keine Webhooks empfangen. Sende einen Test-Webhook oder warte auf echte Requests.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsMonitoring(!isMonitoring);
                if (!isMonitoring) {
                  // Starte Polling
                  const interval = setInterval(async () => {
                    if (monitoringWebhook) {
                      try {
                        const data = await getRecentWebhookRequests(monitoringWebhook.id);
                        if (data.requests && data.requests.length > 0) {
                          const latestRequest = data.requests[0];
                          if (latestRequest && !webhookLogs.find(r => r.id === latestRequest.id)) {
                            setWebhookLogs([latestRequest, ...webhookLogs]);
                            toast.success("Neuer Webhook empfangen! Klicke darauf, um die Felder zuzuordnen.");
                          }
                        }
                      } catch (error) {
                        console.error("Error fetching webhook requests:", error);
                      }
                    }
                  }, 2000);
                  (window as any).webhookPollingInterval = interval;
                } else {
                  // Stoppe Polling
                  if ((window as any).webhookPollingInterval) {
                    clearInterval((window as any).webhookPollingInterval);
                    (window as any).webhookPollingInterval = null;
                  }
                }
              }}
            >
              {isMonitoring ? "Monitoring stoppen" : "Monitoring starten"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMonitorDialogOpen(false);
                setIsMonitoring(false);
                if ((window as any).webhookPollingInterval) {
                  clearInterval((window as any).webhookPollingInterval);
                  (window as any).webhookPollingInterval = null;
                }
              }}
            >
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
