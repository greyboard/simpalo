"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Phone, ExternalLink, Send, Loader2, X, FileText } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";
import { createCallTaskForLead, completeAllTasksForLead, resetCallTaskCounter } from "@/lib/actions/tasks";
import { useSession } from "next-auth/react";
import { fetchLead } from "@/lib/api/leads";

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

export function ContactTasksList() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callReached, setCallReached] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedLeadData, setSelectedLeadData] = useState<any>(null); // Speichere Lead-Daten separat
  const [selectedCallPhone, setSelectedCallPhone] = useState<{ phone: string; label: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const selectedLead = selectedTask?.lead || selectedLeadData;

  // Lade echte Tasks "Lead kontaktieren" aus der Datenbank
  const { data: tasksData, isLoading, error, isFetching } = useQuery({
    queryKey: ["contact-tasks"],
    queryFn: async () => {
      const response = await axios.get("/api/tasks/contact");
      return response.data;
    },
    staleTime: 0, // Daten sind sofort veraltet, damit sie immer neu geladen werden
  });

  // Prüfe, ob die Antwort erfolgreich war und Daten enthält
  // Filtere Tasks ohne Lead heraus
  const allTasks = (tasksData?.success && tasksData?.data) ? tasksData.data : [];
  const tasks = allTasks.filter((task: any) => task.lead !== null && task.lead !== undefined);
  const hasTasks = tasks.length > 0;
  const keepMountedForDialogs = emailDialogOpen || callDialogOpen;

  const selectedLeadId = selectedLead?.id || selectedTask?.lead?.id || selectedLeadData?.id;
  const { data: modalLead } = useQuery({
    queryKey: ["lead", selectedLeadId],
    queryFn: () => fetchLead(String(selectedLeadId)),
    enabled: callDialogOpen && !!selectedLeadId,
    staleTime: 0,
  });

  const callLead = (modalLead && (modalLead as any)?.id) ? (modalLead as any) : selectedLead;
  const normalizePhone = (value?: string | null) => (value || "").replace(/\D/g, "");
  const phoneOptions = (() => {
    const opts: Array<{ phone: string; label: string }> = [];
    if (callLead?.phone) opts.push({ phone: callLead.phone, label: "Kontakt" });
    return opts;
  })();

  const hasSuccessfulOutboundCallForPhone = (phone: string) => {
    const target = normalizePhone(phone);
    if (!target) return false;
    const comms = ((callLead?.communications || []) as any[]) ?? [];
    return comms.some((c) => {
      const status = String(c?.status || "").toLowerCase();
      if (c?.type !== "CALL" || c?.direction !== "OUTBOUND") return false;
      if (!["reached", "completed"].includes(status)) return false;
      const metaPhone = normalizePhone((c?.metadata as any)?.phone);
      if (metaPhone) return metaPhone === target;
      const primary = normalizePhone(callLead?.phone);
      return primary && primary === target;
    });
  };

  const phoneOptionsKey = phoneOptions.map((p) => `${p.label}:${p.phone}`).join("|");
  useEffect(() => {
    if (!callDialogOpen) return;
    if (selectedCallPhone) return;
    if (phoneOptions.length > 0) setSelectedCallPhone(phoneOptions[0]);
  }, [callDialogOpen, selectedCallPhone, phoneOptionsKey, phoneOptions]);

  // Debug: Log für Fehlerbehandlung
  if (error) {
    console.error("Error loading contact tasks:", error);
  }
  if (tasksData && !tasksData.success) {
    console.error("Failed to load contact tasks:", tasksData.error);
  }
  if (tasksData && tasksData.success && allTasks.length > 0 && tasks.length === 0) {
    console.warn("Tasks loaded but all filtered out (no lead):", allTasks);
  }

  // E-Mail-Versand Mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { leadId: string; subject: string; content: string; cc?: string; bcc?: string; attachments?: File[] }) => {
      const formData = new FormData();
      formData.append("subject", data.subject);
      formData.append("content", data.content);
      if (data.cc) {
        formData.append("cc", data.cc);
      }
      if (data.bcc) {
        formData.append("bcc", data.bcc);
      }
      if (data.attachments && data.attachments.length > 0) {
        data.attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file);
        });
      }

      const response = await fetch(`/api/leads/${data.leadId}/send-email`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Senden der E-Mail");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("E-Mail erfolgreich gesendet");
      setEmailDialogOpen(false);
      setEmailSubject("");
      setEmailContent("");
      setEmailCc("");
      setEmailBcc("");
      setEmailAttachments([]);
      setSelectedTask(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Senden der E-Mail");
    },
  });

  const handleOpenEmailDialog = (task: any) => {
    setSelectedTask(task);
    setEmailDialogOpen(true);
  };

  const handleSendEmail = () => {
    if (!emailSubject.trim()) {
      toast.error("Bitte gib einen Betreff ein");
      return;
    }
    if (!emailContent.trim()) {
      toast.error("Bitte gib einen E-Mail-Inhalt ein");
      return;
    }
    if (!selectedTask?.lead?.email) {
      toast.error("Keine E-Mail-Adresse für diesen Kontakt vorhanden");
      return;
    }
    sendEmailMutation.mutate({
      leadId: selectedTask.lead.id,
      subject: emailSubject,
      content: emailContent,
      cc: emailCc.trim() || undefined,
      bcc: emailBcc.trim() || undefined,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEmailAttachments(Array.from(e.target.files));
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setEmailAttachments(emailAttachments.filter((_, i) => i !== index));
  };

  const handleOpenCallDialog = (task: any) => {
    setSelectedTask(task);
    setSelectedLeadData(null);
    setSelectedCallPhone(null);
    setCallDialogOpen(true);
  };

  const createCallTaskMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const result = await createCallTaskForLead(leadId);
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Erstellen der Aufgabe");
      }
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["lead", selectedTask?.lead?.id] });
      
      if (result.isThirdAttempt && result.taskCompleted) {
        toast.success("3. Versuch erreicht. Kontakt wurde als 'Nicht erreichbar' markiert und Aufgaben wurden abgeschlossen.");
        setCallDialogOpen(false);
        setSelectedTask(null);
        setSelectedLeadData(null);
      } else if (result.taskId) {
        toast.success(`Aufgabe 'Kontakt anrufen' wurde erstellt (Versuch ${result.attemptCount}/3)`);
      } else {
        // Task existiert bereits
        toast(`Aufgabe existiert bereits (Versuch ${result.attemptCount}/3)`);
      }
      setCallDialogOpen(false);
      setSelectedTask(null);
      setSelectedLeadData(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Erstellen der Aufgabe");
    },
  });

  const completeTasksMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const result = await completeAllTasksForLead(leadId);
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Abschließen der Aufgaben");
      }
      return result;
    },
    onSuccess: () => {
      // Verzögere Query-Invalidierung, damit selectedTask nicht verloren geht
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
      }, 100);
    },
    onError: (error: any) => {
      console.error("Error completing tasks:", error);
      // Nicht als Fehler anzeigen, da es nicht kritisch ist
    },
  });

  const resetCallCounterMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const result = await resetCallTaskCounter(leadId);
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Zurücksetzen des Zählers");
      }
      return result;
    },
    onSuccess: (_result, leadId) => {
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
    },
    onError: (error: any) => {
      console.error("Fehler beim Zurücksetzen des Zählers:", error);
      // Nicht als Fehler anzeigen, da dies nicht kritisch ist
    },
  });

  // Prüfe, ob Task-Titel "kontaktieren" oder "anrufen" enthält
  const isContactTask = (title: string) => {
    const lowerTitle = title.toLowerCase();
    return lowerTitle.includes("kontaktieren") || lowerTitle.includes("anrufen");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aufgaben</CardTitle>
          <CardDescription>
            Offene Aufgaben für Leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Aufgaben</CardTitle>
            <CardDescription>
              {tasks.length > 0 ? `${tasks.length} offene Aufgabe(n)` : "Offene Aufgaben für Leads"}
            </CardDescription>
          </div>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {tasks.length} offen
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              Du hast keine offenen Aufgaben
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task: any) => {
              const lead = task.lead;
              if (!lead) return null; // Fallback: Überspringe Tasks ohne Lead
              return (
                <div
                  key={task.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                        >
                          {lead.name || "Unbekannt"}
                        </Link>
                        {lead.company?.name && 
                         lead.company.name.trim() !== "" && 
                         lead.company.name.trim().toLowerCase() !== "unbekannt" &&
                         lead.company.name !== lead.name && (
                          <span className="text-sm text-gray-500">
                            @ {lead.company.name}
                          </span>
                        )}
                        <Badge variant="warning" className="text-xs">
                          {task.status === "PENDING" ? "Offen" : "In Bearbeitung"}
                        </Badge>
                        <Badge variant={statusColors[lead.status] || "default"}>
                          {statusLabels[lead.status] || lead.status}
                        </Badge>
                        {lead.source && (
                          <Badge variant="secondary" className="text-xs">
                            {lead.source}
                          </Badge>
                        )}
                        {lead.utmSource && lead.utmCampaign && (() => {
                          const normalizeUtmSource = (utmSource: string) => {
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
                          const getUtmSourceBadgeColor = (utmSource: string) => {
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
                          const sourceDisplay = normalizeUtmSource(lead.utmSource);
                          const badgeColor = getUtmSourceBadgeColor(lead.utmSource);
                          const colorClassName = typeof badgeColor === "string" ? badgeColor : undefined;
                          const colorStyle = typeof badgeColor === "object" ? badgeColor : undefined;
                          return (
                            <Link href={`/dashboard/campaigns/${encodeURIComponent(sourceDisplay)}/${encodeURIComponent(lead.utmCampaign)}`}>
                              <Badge 
                                className={colorClassName ? `${colorClassName} text-xs hover:opacity-80 cursor-pointer` : "text-xs hover:opacity-80 cursor-pointer"}
                                style={colorStyle}
                                variant="secondary"
                              >
                                {sourceDisplay}
                              </Badge>
                            </Link>
                          );
                        })()}
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-1 hover:text-blue-600"
                          title={lead.email}
                        >
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">{lead.email}</span>
                        </a>
                      )}
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1 hover:text-blue-600"
                          title={lead.phone}
                        >
                          <Phone className="h-3 w-3" />
                          <span>{lead.phone}</span>
                        </a>
                      )}
                    </div>
                    {task.createdAt && (
                      <p className="text-xs text-gray-500">
                        Aufgabe erstellt: {formatDateTime(task.createdAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {isContactTask(task.title) && lead.email && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenEmailDialog(task)}
                        className="flex items-center gap-1"
                      >
                        <Mail className="h-4 w-4" />
                        E-Mail
                      </Button>
                    )}
                    {isContactTask(task.title) && lead.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCallDialog(task)}
                        className="flex items-center gap-1"
                      >
                        <Phone className="h-4 w-4" />
                        Anrufen
                      </Button>
                    )}
                    <Link href={`/dashboard/leads/${lead.id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Öffnen
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </CardContent>

      {/* E-Mail senden Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="!max-w-[60vw] w-[60vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail senden</DialogTitle>
            <DialogDescription>
              Sende eine E-Mail an {selectedTask?.lead?.name || selectedTask?.lead?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">An</Label>
              <Input
                id="email-to"
                type="email"
                value={selectedTask?.lead?.email || ""}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email-cc">CC</Label>
                <Input
                  id="email-cc"
                  type="email"
                  value={emailCc}
                  onChange={(e) => setEmailCc(e.target.value)}
                  placeholder="cc@example.com"
                  multiple
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-bcc">BCC</Label>
                <Input
                  id="email-bcc"
                  type="email"
                  value={emailBcc}
                  onChange={(e) => setEmailBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  multiple
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject">Betreff *</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Betreff der E-Mail"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-content">Nachricht *</Label>
              <Textarea
                id="email-content"
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                placeholder="E-Mail-Inhalt..."
                rows={10}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-attachments">Anhänge</Label>
              <Input
                id="email-attachments"
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="cursor-pointer"
              />
              {emailAttachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {emailAttachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAttachment(index)}
                        className="h-8 w-8 p-0 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEmailDialogOpen(false);
                setEmailSubject("");
                setEmailContent("");
                setEmailCc("");
                setEmailBcc("");
                setEmailAttachments([]);
                setSelectedTask(null);
              }}
              disabled={sendEmailMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailContent.trim() || !selectedTask?.lead?.email}
            >
              {sendEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Senden
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anruf Dialog */}
      <Dialog open={callDialogOpen} onOpenChange={(open) => {
        setCallDialogOpen(open);
        if (!open) {
          setCallReached(false);
          setCallNotes("");
          setSelectedTask(null);
          setSelectedLeadData(null);
          setSelectedCallPhone(null);
        }
      }}>
        <DialogContent className="!max-w-[60vw] w-[60vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anruf</DialogTitle>
            <DialogDescription>
              Rufe {selectedLead?.name || selectedLead?.email} an
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {phoneOptions.length > 0 && !callReached && (
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  {phoneOptions.map((opt) => {
                    const isSelected =
                      normalizePhone(opt.phone) === normalizePhone(selectedCallPhone?.phone) &&
                      opt.label === selectedCallPhone?.label;
                    const isVerified = hasSuccessfulOutboundCallForPhone(opt.phone);
                    return (
                      <a
                        key={`${opt.label}-${opt.phone}`}
                        href={`tel:${opt.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSelectedCallPhone(opt)}
                        className="inline-flex items-center justify-between rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-white h-10 px-4 py-2 w-full"
                        style={{ backgroundColor: "#48BB78" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#38A169";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#48BB78";
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{opt.phone}</span>
                          <span className="text-xs opacity-90">({opt.label})</span>
                        </span>
                        <span className="inline-flex items-center gap-2">
                          {isVerified && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                              style={{
                                backgroundColor: "#FFFFFF20",
                                color: "#FFFFFF",
                                borderColor: "#FFFFFF40",
                              }}
                            >
                              Verifiziert
                            </Badge>
                          )}
                          {isSelected && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                              style={{
                                backgroundColor: "#FFFFFF20",
                                color: "#FFFFFF",
                                borderColor: "#FFFFFF40",
                              }}
                            >
                              Ausgewählt
                            </Badge>
                          )}
                        </span>
                      </a>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const leadId = selectedTask?.lead?.id || selectedLeadData?.id;
                      const lead = selectedTask?.lead || selectedLeadData;
                      if (!lead || !leadId) {
                        toast.error("Lead-Informationen fehlen");
                        return;
                      }
                      
                      // Speichere Lead-Daten separat, um sicherzustellen, dass sie nicht verloren gehen
                      const leadData = {
                        id: leadId,
                        phone: lead.phone,
                        name: lead.name,
                        firstName: lead.firstName,
                        lastName: lead.lastName,
                        email: lead.email,
                      };
                      
                      // Speichere Lead-Daten in separatem State (wird nicht von Query-Invalidierung betroffen)
                      setSelectedLeadData(leadData);
                      
                      // Stelle sicher, dass selectedTask mit Lead-Daten gesetzt ist, BEVOR die Mutation ausgeführt wird
                      setSelectedTask((prev: any) => {
                        const prevObj = prev ?? {};
                        const prevLead = prevObj.lead ?? {};
                        return { ...prevObj, lead: { ...prevLead, ...leadData } };
                      });

                      // Zeige Notizfeld sofort
                      setCallNotes("");
                      setCallReached(true);

                      // Markiere alle offenen Tasks als abgeschlossen
                      await completeTasksMutation.mutateAsync(leadId).catch((error) => {
                        console.error("Fehler beim Abschließen der Tasks:", error);
                      });

                      // Zähler zurücksetzen + Tag "Nicht erreichbar" entfernen + Telefonnummer verifizieren
                      await resetCallCounterMutation.mutateAsync(leadId).catch((error) => {
                        console.error("Fehler beim Zurücksetzen des Zählers:", error);
                      });
                    }}
                    className="flex-1"
                  >
                    Erreicht
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const leadId = selectedTask?.lead?.id || selectedLeadData?.id;
                      if (!leadId) return;
                      // Erstelle neue Aufgabe "Kontakt anrufen" (bestehende Tasks bleiben offen)
                      createCallTaskMutation.mutate(leadId);
                    }}
                    disabled={createCallTaskMutation.isPending}
                    className="flex-1"
                  >
                    {createCallTaskMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Wird erstellt...
                      </>
                    ) : (
                      "Nicht erreicht"
                    )}
                  </Button>
                </div>
              </div>
            )}
            {callReached && (selectedTask || selectedLeadData) && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="call-notes">Notizen zum Gespräch</Label>
                  <Textarea
                    id="call-notes"
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Notizen zum Gespräch..."
                    rows={10}
                    className="resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // Speichere selectedTask/selectedLeadData und andere Werte vor allen Operationen
                      const taskToProcess = selectedTask || { lead: selectedLeadData };
                      const notesToSave = callNotes;
                      
                      const leadIdForCheck = taskToProcess?.lead?.id || selectedLeadData?.id;
                      if (!leadIdForCheck) {
                        setCallDialogOpen(false);
                        setCallReached(false);
                        setCallNotes("");
                        setSelectedTask(null);
                        setSelectedLeadData(null);
                        return;
                      }
                      
                      // leadId außerhalb des try-Blocks, damit es im finally-Block verfügbar ist
                      const leadId = taskToProcess?.lead?.id || selectedLeadData?.id;
                      
                      try {
                        // Reset Zähler (alle "anrufen" Tasks löschen) - ZUERST
                        console.log("[DEBUG] Resetting call counter for leadId:", leadId);
                        await resetCallCounterMutation.mutateAsync(leadId);
                        console.log("[DEBUG] Call counter reset successful");
                        
                        // Erstelle Notiz auch beim Schließen (auch wenn leer)
                        const now = new Date();
                        const dateTimeStr = formatDateTime(now);
                        const userName = session?.user?.name || "Unbekannt";
                        const noteContent = `📞 Anruf erfolgreich\n\n${notesToSave.trim() || "Anruf erfolgreich abgeschlossen"}\n\n— ${userName}, ${dateTimeStr}`;
                        
                        console.log("[DEBUG] Creating call communication for leadId:", leadId);
                        const response = await fetch(`/api/leads/${leadId}/communications`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            type: "CALL",
                            direction: "OUTBOUND",
                            subject: `Anruf von ${userName} erfolgreich`,
                            phone: selectedCallPhone?.phone ?? null,
                            phoneLabel: selectedCallPhone?.label ?? null,
                            content: noteContent,
                          }),
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.error || "Fehler beim Erstellen der Notiz");
                        }
                        
                        console.log("[DEBUG] Call communication created successfully");
                        toast.success("Anruf gespeichert");
                      } catch (error: any) {
                        console.error("[ERROR] Fehler beim Schließen:", error);
                        toast.error(error.message || "Fehler beim Speichern");
                      } finally {
                        // Schließe Modal erst NACH allen Operationen
                        setCallDialogOpen(false);
                        setCallReached(false);
                        setCallNotes("");
                        setSelectedTask(null);
                        setSelectedLeadData(null);
                        
                        // Invalidiere Queries NACH dem Schließen des Modals
                        // Verwende setTimeout, um sicherzustellen, dass das Modal erst geschlossen ist
                        setTimeout(() => {
                          queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
                          queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
                        }, 100);
                      }
                    }}
                    disabled={resetCallCounterMutation.isPending}
                    className="flex-1"
                  >
                    {resetCallCounterMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Wird gespeichert...
                      </>
                    ) : (
                      "Schließen"
                    )}
                  </Button>
                  <Button
                    variant="default"
                    onClick={async () => {
                      const leadId = selectedTask?.lead?.id || selectedLeadData?.id;
                      if (!leadId) {
                        toast.error("Lead-Informationen fehlen");
                        return;
                      }
                      try {
                        // Reset Zähler (alle "anrufen" Tasks löschen)
                        await resetCallCounterMutation.mutateAsync(leadId).catch(() => {
                          // Ignoriere Fehler beim Reset
                        });
                        
                        // Formatiere Notiz mit Username, Datum und Zeit
                        const now = new Date();
                        const dateTimeStr = formatDateTime(now);
                        const userName = session?.user?.name || "Unbekannt";
                        const noteContent = `📞 Anruf erfolgreich\n\n${callNotes.trim() || "Anruf erfolgreich abgeschlossen"}\n\n— ${userName}, ${dateTimeStr}`;
                        
                        const response = await fetch(`/api/leads/${leadId}/communications`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            type: "CALL",
                            direction: "OUTBOUND",
                            subject: `Anruf von ${userName} erfolgreich`,
                            phone: selectedCallPhone?.phone ?? null,
                            phoneLabel: selectedCallPhone?.label ?? null,
                            content: noteContent,
                          }),
                        });
                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.error || "Fehler beim Erstellen der Notiz");
                        }
                        queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
                        toast.success("Anruf gespeichert");
                        setCallDialogOpen(false);
                        setCallReached(false);
                        setCallNotes("");
                        setSelectedTask(null);
                        setSelectedLeadData(null);
                      } catch (error: any) {
                        toast.error(error.message || "Fehler beim Erstellen der Notiz");
                      }
                    }}
                    disabled={resetCallCounterMutation.isPending}
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Notiz erstellen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
