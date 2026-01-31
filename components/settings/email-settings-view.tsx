"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import { Mail, Loader2, X, Send } from "lucide-react";
import { fetchWebhooks, fetchLeads } from "@/lib/api/leads";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmailSettings {
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  autoReplyEnabled?: boolean;
  autoReplyDelayMinutes?: number;
  autoReplyWebhookIds?: string[];
  ownerNotificationEnabled?: boolean;
  ownerNotificationEmail?: string;
  leadTemplate?: {
    subject: string;
    content: string;
  };
  ownerTemplate?: {
    subject: string;
    content: string;
  };
}

export function EmailSettingsView() {
  const queryClient = useQueryClient();
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyDelayMinutes, setAutoReplyDelayMinutes] = useState(0);
  const [selectedWebhookIds, setSelectedWebhookIds] = useState<string[]>([]);
  const [ownerNotificationEnabled, setOwnerNotificationEnabled] = useState(false);
  const [ownerNotificationEmail, setOwnerNotificationEmail] = useState("");
  const [leadSubject, setLeadSubject] = useState("");
  const [leadContent, setLeadContent] = useState("");
  const [ownerSubject, setOwnerSubject] = useState("");
  const [ownerContent, setOwnerContent] = useState("");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [testLeadId, setTestLeadId] = useState<string>("");
  const [testSending, setTestSending] = useState(false);

  const { data: accountSettings, isLoading } = useQuery({
    queryKey: ["account-settings"],
    queryFn: async () => {
      const response = await fetch("/api/account/settings");
      if (!response.ok) throw new Error("Fehler beim Laden der Einstellungen");
      const data = await response.json();
      return data;
    },
  });

  const { data: webhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: fetchWebhooks,
  });

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", { type: "CONTACT" }],
    queryFn: () => fetchLeads({ type: "CONTACT", page: 1, pageSize: 200 }),
    enabled: testDialogOpen, // Nur laden wenn Dialog offen ist
  });

  useEffect(() => {
    if (accountSettings?.settings) {
      const settings = accountSettings.settings as any;
      const emailSettings = settings.emailSettings as EmailSettings | undefined;
      if (emailSettings) {
        setSenderName(emailSettings.senderName || "");
        setSenderEmail(emailSettings.senderEmail || "");
        setReplyTo(emailSettings.replyTo || "");
        setAutoReplyEnabled(emailSettings.autoReplyEnabled || false);
        setAutoReplyDelayMinutes(emailSettings.autoReplyDelayMinutes || 0);
        setSelectedWebhookIds(emailSettings.autoReplyWebhookIds || []);
        setOwnerNotificationEnabled(emailSettings.ownerNotificationEnabled || false);
        setOwnerNotificationEmail(emailSettings.ownerNotificationEmail || "");
        setLeadSubject(emailSettings.leadTemplate?.subject || "");
        setLeadContent(emailSettings.leadTemplate?.content || "");
        setOwnerSubject(emailSettings.ownerTemplate?.subject || "");
        setOwnerContent(emailSettings.ownerTemplate?.content || "");
      }
    }
  }, [accountSettings]);

  const saveMutation = useMutation({
    mutationFn: async (emailSettings: EmailSettings) => {
      const response = await fetch("/api/account/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailSettings }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Speichern");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      toast.success("E-Mail-Einstellungen erfolgreich gespeichert");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Fehler beim Speichern der E-Mail-Einstellungen");
    },
  });

  const handleSave = () => {
    const emailSettings: EmailSettings = {
      senderName,
      senderEmail,
      replyTo,
      autoReplyEnabled,
      autoReplyDelayMinutes: autoReplyEnabled ? autoReplyDelayMinutes : 0,
      autoReplyWebhookIds: autoReplyEnabled ? selectedWebhookIds : [],
      ownerNotificationEnabled,
      ownerNotificationEmail: ownerNotificationEnabled ? ownerNotificationEmail : "",
      leadTemplate: {
        subject: leadSubject,
        content: leadContent,
      },
      ownerTemplate: {
        subject: ownerSubject,
        content: ownerContent,
      },
    };

    saveMutation.mutate(emailSettings);
  };

  const handleToggleWebhook = (webhookId: string) => {
    setSelectedWebhookIds((prev) =>
      prev.includes(webhookId)
        ? prev.filter((id) => id !== webhookId)
        : [...prev, webhookId]
    );
  };

  const handleRemoveWebhook = (webhookId: string) => {
    setSelectedWebhookIds((prev) => prev.filter((id) => id !== webhookId));
  };

  const activeWebhooks = (webhooks || []).filter((wh: any) => wh.isActive);
  const selectedWebhooks = activeWebhooks.filter((wh: any) =>
    selectedWebhookIds.includes(wh.id)
  );

  const handleTestEmail = async (type: "auto-reply" | "owner-notification") => {
    if (!testRecipientEmail.trim()) {
      toast.error("Bitte gib eine Empfänger-E-Mail-Adresse ein");
      return;
    }

    if (!testLeadId) {
      toast.error("Bitte wähle einen Kontakt aus");
      return;
    }

    setTestSending(true);
    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: testLeadId,
          type: type,
          recipientEmail: testRecipientEmail.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Senden der Test-E-Mail");
      }

      toast.success(`Test-E-Mail (${type === "auto-reply" ? "Auto-Reply" : "Owner-Notification"}) erfolgreich gesendet!`);
      setTestDialogOpen(false);
      setTestRecipientEmail("");
      setTestLeadId("");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Senden der Test-E-Mail");
    } finally {
      setTestSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" style={{ color: "#1A365D" }} />
            E-Mail-Einstellungen
          </CardTitle>
          <CardDescription>
            Konfigurieren Sie die E-Mail-Einstellungen für automatische Antworten und Benachrichtigungen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Absendername */}
          <div className="space-y-2">
            <Label htmlFor="senderName">Absendername</Label>
            <Input
              id="senderName"
              type="text"
              placeholder="Dein Name oder Firmenname"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              Der Name, der als Absender in E-Mails angezeigt wird
            </p>
          </div>

          {/* Absenderadresse */}
          <div className="space-y-2">
            <Label htmlFor="senderEmail">Absenderadresse</Label>
            <Input
              id="senderEmail"
              type="email"
              placeholder="noreply@example.com"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              Die E-Mail-Adresse, die als Absender verwendet wird
            </p>
          </div>

          {/* Standard Reply-To */}
          <div className="space-y-2">
            <Label htmlFor="replyTo">Standard Reply-To</Label>
            <Input
              id="replyTo"
              type="email"
              placeholder="support@example.com"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              Standard-E-Mail-Adresse für Antworten
            </p>
          </div>

          {/* Automatische Antwort */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoReply">Automatische Antwort</Label>
                <p className="text-sm text-gray-500">
                  Aktiviere automatische Antwort-E-Mails an Leads
                </p>
              </div>
              <Switch
                id="autoReply"
                checked={autoReplyEnabled}
                onCheckedChange={setAutoReplyEnabled}
              />
            </div>

            {autoReplyEnabled && (
              <div className="space-y-2 pl-6 border-l-2 border-gray-200">
                <Label htmlFor="delayMinutes">Verzögerung (Minuten)</Label>
                <Input
                  id="delayMinutes"
                  type="number"
                  min="0"
                  value={autoReplyDelayMinutes}
                  onChange={(e) => setAutoReplyDelayMinutes(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-gray-500">
                  Anzahl der Minuten, die nach dem Eintreffen der Anfrage gewartet wird, bevor die automatische Antwort gesendet wird
                </p>
              </div>
            )}

            {autoReplyEnabled && (
              <div className="space-y-3 pl-6 border-l-2 border-gray-200 mt-4">
                <Label>Webhooks für automatische Antwort</Label>
                <p className="text-sm text-gray-500">
                  Wähle die Webhooks aus, für die automatische Antworten gesendet werden sollen
                </p>

                {webhooksLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Lade Webhooks...
                  </div>
                ) : activeWebhooks.length > 0 ? (
                  <div className="space-y-2">
                    {activeWebhooks.map((webhook: any) => (
                      <label
                        key={webhook.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedWebhookIds.includes(webhook.id)}
                          onChange={() => handleToggleWebhook(webhook.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm" style={{ color: "#2D3748" }}>{webhook.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Keine aktiven Webhooks vorhanden</p>
                )}

                {selectedWebhooks.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2" style={{ color: "#2D3748" }}>Ausgewählte Webhooks:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedWebhooks.map((webhook: any) => (
                        <Badge
                          key={webhook.id}
                          variant="secondary"
                          className="flex items-center gap-1"
                          style={{ backgroundColor: "#1A365D20", color: "#1A365D" }}
                        >
                          {webhook.name}
                          <button
                            type="button"
                            onClick={() => handleRemoveWebhook(webhook.id)}
                            className="ml-1 hover:opacity-70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <div className="space-y-0.5">
                <Label htmlFor="ownerNotification">Benachrichtigung an Leadbesitzer</Label>
                <p className="text-sm text-gray-500">
                  Aktiviere E-Mail-Benachrichtigungen an den Besitzer/User des Leads
                </p>
              </div>
              <Switch
                id="ownerNotification"
                checked={ownerNotificationEnabled}
                onCheckedChange={setOwnerNotificationEnabled}
              />
            </div>

            {/* E-Mail-Adresse für Owner-Notification - nur wenn aktiviert */}
            {ownerNotificationEnabled && (
              <div className="space-y-2 mt-4">
                <Label htmlFor="ownerNotificationEmail">E-Mail-Adresse für Benachrichtigungen</Label>
                <Input
                  id="ownerNotificationEmail"
                  type="email"
                  placeholder="benachrichtigung@example.com"
                  value={ownerNotificationEmail}
                  onChange={(e) => setOwnerNotificationEmail(e.target.value)}
                />
                <p className="text-sm text-gray-500">
                  E-Mail-Adresse, an die Benachrichtigungen über neue Leads gesendet werden
                </p>
              </div>
            )}
          </div>

          {/* Mailtemplate an den Lead - nur wenn automatische Antwort aktiv */}
          {autoReplyEnabled && (
            <div className="space-y-4 border-t pt-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Mailtemplate an den Lead</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Template für automatische Antworten an Leads. Verfügbare Platzhalter: {" "}
                  <code className="bg-gray-100 px-1 rounded">{"{{vorname}}"}</code>, {" "}
                  <code className="bg-gray-100 px-1 rounded">{"{{nachname}}"}</code>, {" "}
                  <code className="bg-gray-100 px-1 rounded">{"{{email}}"}</code>, {" "}
                  <code className="bg-gray-100 px-1 rounded">{"{{telefon}}"}</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadSubject">Betreff</Label>
                <Input
                  id="leadSubject"
                  placeholder="Vielen Dank für Deine Anfrage, {{vorname}}"
                  value={leadSubject}
                  onChange={(e) => setLeadSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadContent">Nachricht</Label>
                <Textarea
                  id="leadContent"
                  rows={8}
                  placeholder="Hallo {{vorname}} {{nachname}},&#10;&#10;vielen Dank für Deine Anfrage...&#10;&#10;Mit freundlichen Grüßen&#10;Dein Team"
                  value={leadContent}
                  onChange={(e) => setLeadContent(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Mailtemplate an den Besitzer/User - nur wenn aktiviert */}
          {ownerNotificationEnabled && (
            <div className="space-y-4 border-t pt-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Mailtemplate an den Lead-Besitzer</h3>
              <p className="text-sm text-gray-500 mb-4">
                Template für Benachrichtigungen an den Besitzer/User des Leads. Verfügbare Platzhalter: {" "}
                <code className="bg-gray-100 px-1 rounded">{"{{vorname}}"}</code>, {" "}
                <code className="bg-gray-100 px-1 rounded">{"{{nachname}}"}</code>, {" "}
                <code className="bg-gray-100 px-1 rounded">{"{{anfrage}}"}</code>, {" "}
                <code className="bg-gray-100 px-1 rounded">{"{{email}}"}</code>, {" "}
                <code className="bg-gray-100 px-1 rounded">{"{{telefon}}"}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerSubject">Betreff</Label>
              <Input
                id="ownerSubject"
                placeholder="Neue Anfrage von {{vorname}} {{nachname}}"
                value={ownerSubject}
                onChange={(e) => setOwnerSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerContent">Nachricht</Label>
              <Textarea
                id="ownerContent"
                rows={8}
                placeholder="Hallo,&#10;&#10;es gibt eine neue Anfrage:&#10;&#10;Von: {{vorname}} {{nachname}}&#10;E-Mail: {{email}}&#10;Telefon: {{telefon}}&#10;Anfrage: {{anfrage}}&#10;&#10;Bitte kümmere Dich darum."
                value={ownerContent}
                onChange={(e) => setOwnerContent(e.target.value)}
              />
            </div>
          </div>
          )}

          {/* Speichern Button */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setTestDialogOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              E-Mail-Templates testen
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                "Einstellungen speichern"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test E-Mail Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>E-Mail-Templates testen</DialogTitle>
            <DialogDescription>
              Sende eine Test-E-Mail mit den konfigurierten Templates an eine beliebige E-Mail-Adresse
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testRecipientEmail">Empfänger-E-Mail-Adresse</Label>
              <Input
                id="testRecipientEmail"
                type="email"
                placeholder="test@example.com"
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Die E-Mail-Adresse, an die die Test-E-Mail gesendet werden soll
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testLead">Kontakt für Template-Daten</Label>
              {leadsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lade Kontakte...
                </div>
              ) : (
                <Select value={testLeadId} onValueChange={setTestLeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wähle einen Kontakt aus">
                      {testLeadId && (() => {
                        const selectedLead = (leads?.items || []).find((lead: any) => lead.id === testLeadId);
                        return selectedLead ? `${selectedLead.name}${selectedLead.email ? ` (${selectedLead.email})` : ""}` : null;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(leads?.items || []).map((lead: any) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} {lead.email && `(${lead.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-gray-500">
                Die Daten dieses Kontakts werden für die Platzhalter verwendet ({`{{vorname}}`}, {`{{nachname}}`}, etc.)
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleTestEmail("auto-reply")}
              disabled={testSending || !testRecipientEmail || !testLeadId || !autoReplyEnabled}
            >
              {testSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Auto-Reply Template testen
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleTestEmail("owner-notification")}
              disabled={testSending || !testRecipientEmail || !testLeadId || !ownerNotificationEnabled}
            >
              {testSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Owner-Notification Template testen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
