"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchLead, deleteNote, fetchTags, createTag, addTagToLead, removeTagFromLead, fetchCompanies } from "@/lib/api/leads";
import { updateLeadAction, createNoteAction, type UpdateLeadInput } from "@/lib/actions/leads";
import { createCallTaskForLead, completeAllTasksForLead, resetCallTaskCounter } from "@/lib/actions/tasks";
import { Phone, Mail, Globe, MapPin, Star, MessageSquare, Calendar, CheckCircle2, Plus, Trash2, FileText, ExternalLink, X, Building2, Send, CheckCircle, Eye, MousePointerClick, AlertCircle, Clock, Bot, ChevronDown, ChevronUp, Loader2, Circle } from "lucide-react";
import { useSession } from "next-auth/react";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import toast from "react-hot-toast";

interface LeadDetailViewProps {
  leadId: string;
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

export function LeadDetailView({ leadId }: LeadDetailViewProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [deleteNoteDialogOpen, setDeleteNoteDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    status: "",
    priority: "",
    source: "",
  });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [expandedCommId, setExpandedCommId] = useState<string | null>(null);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callReached, setCallReached] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [selectedCallPhone, setSelectedCallPhone] = useState<{ phone: string; label: string } | null>(null);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => fetchLead(leadId),
  });

  const { data: allTags } = useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
    enabled: lead?.type === "CONTACT", // Nur laden wenn es ein Kontakt ist
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const result = await createNoteAction(leadId, { content });
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Erstellen der Notiz");
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success("Notiz erfolgreich hinzugefügt");
      setNoteDialogOpen(false);
      setNoteContent("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Hinzufügen der Notiz");
    },
  });

  const createCallCommunicationMutation = useMutation({
    mutationFn: async (input: { content: string; phone?: string | null; phoneLabel?: string | null }) => {
      const userName = session?.user?.name || "Unbekannt";
      const response = await fetch(`/api/leads/${leadId}/communications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "CALL",
          direction: "OUTBOUND",
          subject: `Anruf von ${userName} erfolgreich`,
          phone: input.phone ?? null,
          phoneLabel: input.phoneLabel ?? null,
          content: input.content,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error || "Fehler beim Speichern des Anrufs");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success("Anruf gespeichert");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Speichern des Anrufs");
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return await deleteNote(leadId, noteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success("Notiz erfolgreich gelöscht");
      setDeleteNoteDialogOpen(false);
      setNoteToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Löschen der Notiz");
    },
  });

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast.error("Bitte gib eine Notiz ein");
      return;
    }
    createNoteMutation.mutate(noteContent);
  };

  const normalizePhone = (value?: string | null) => (value || "").replace(/\D/g, "");
  const hasSuccessfulOutboundCallForPhone = (phone: string) => {
    const target = normalizePhone(phone);
    if (!target) return false;
    const comms = (lead?.communications || []) as any[];
    return comms.some((c) => {
      const status = String(c?.status || "").toLowerCase();
      if (c?.type !== "CALL" || c?.direction !== "OUTBOUND") return false;
      if (!["reached", "completed"].includes(status)) return false;

      const metaPhone = normalizePhone((c?.metadata as any)?.phone);
      if (metaPhone) return metaPhone === target;

      // Backward compatibility: older records without metadata.phone verify the primary lead phone
      const primary = normalizePhone(lead?.phone);
      return primary && primary === target;
    });
  };

  const phoneOptions = (() => {
    const opts: Array<{ phone: string; label: string }> = [];
    if (lead?.phone) opts.push({ phone: lead.phone, label: "Kontakt" });
    return opts;
  })();

  const handleDeleteNoteClick = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteNoteDialogOpen(true);
  };

  const handleDeleteNoteConfirm = () => {
    if (noteToDelete) {
      deleteNoteMutation.mutate(noteToDelete);
    }
  };

  const addTagMutation = useMutation({
    mutationFn: async ({ tagId, tagName }: { tagId?: string; tagName?: string }) => {
      return await addTagToLead(leadId, tagId, tagName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag erfolgreich hinzugefügt");
      setTagDialogOpen(false);
      setNewTagName("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Hinzufügen des Tags");
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return await removeTagFromLead(leadId, tagId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Tag erfolgreich entfernt");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Entfernen des Tags");
    },
  });

  const handleAddTag = () => {
    if (newTagName.trim()) {
      addTagMutation.mutate({ tagName: newTagName.trim() });
    }
  };

  const handleAddExistingTag = (tagId: string) => {
    addTagMutation.mutate({ tagId });
  };

  const handleRemoveTag = (tagId: string) => {
    removeTagMutation.mutate(tagId);
  };

  const updateLeadMutation = useMutation({
    mutationFn: async (data: UpdateLeadInput) => {
      const result = await updateLeadAction(leadId, data);
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Aktualisieren des Kontakts");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Kontakt erfolgreich aktualisiert");
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || "Fehler beim Aktualisieren des Kontakts");
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: { companyId: string }) => {
      console.log("[DEBUG] updateCompanyMutation called with:", {
        companyId: data.companyId,
        type: typeof data.companyId,
        length: data.companyId?.length,
      });
      
      // Hole aktuellen Lead, um alle Felder zu behalten
      const currentLead = lead;
      if (!currentLead) {
        throw new Error("Lead nicht gefunden");
      }
      
      // Normalisiere companyId: Leerer String bleibt leer, ansonsten trim und verwenden
      // Für "Kein Unternehmen" wird "" übergeben (Zod akzeptiert das)
      // Für ein Unternehmen wird die getrimmte UUID übergeben
      const normalizedCompanyId = data.companyId === "" 
        ? "" 
        : (typeof data.companyId === "string" ? data.companyId.trim() : "");
      
      console.log("[DEBUG] updateCompanyMutation normalized:", {
        normalizedCompanyId,
        type: typeof normalizedCompanyId,
        length: normalizedCompanyId?.length,
        isEmpty: normalizedCompanyId === "",
        isUUID: normalizedCompanyId && normalizedCompanyId.length === 36,
      });
      
      const input: UpdateLeadInput = {
        name: currentLead.name,
        firstName: currentLead.firstName || undefined,
        lastName: currentLead.lastName || undefined,
        email: currentLead.email || undefined,
        phone: currentLead.phone || undefined,
        status: currentLead.status as UpdateLeadInput["status"],
        priority: currentLead.priority as UpdateLeadInput["priority"],
        source: currentLead.source || undefined,
        companyId: normalizedCompanyId, // Leerer String "" für "Kein Unternehmen", UUID für Unternehmen
      };
      
      console.log("[DEBUG] updateCompanyMutation input:", {
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        status: input.status,
        priority: input.priority,
        source: input.source,
        companyId: input.companyId,
        companyIdType: typeof input.companyId,
      });
      
      const result = await updateLeadAction(leadId, input);
      
      console.log("[DEBUG] updateCompanyMutation result:", {
        success: result.success,
        error: result.error,
      });
      
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Aktualisieren der Zuordnung");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Zuordnung aktualisiert");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Aktualisieren der Zuordnung");
    },
  });

  // Initialisiere Edit-Formular wenn Lead geladen wird
  useEffect(() => {
    if (lead) {
      setEditFormData({
        name: lead.name || "",
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        email: lead.email || "",
        phone: lead.phone || "",
        status: lead.status || "NEW",
        priority: lead.priority || "MEDIUM",
        source: lead.source || "",
      });
    }
  }, [lead]);

  const handleEdit = () => {
    if (lead) {
      setEditFormData({
        name: lead.name || "",
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        email: lead.email || "",
        phone: lead.phone || "",
        status: lead.status || "NEW",
        priority: lead.priority || "MEDIUM",
        source: lead.source || "",
      });
      setEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    // Validierung wird jetzt im Server Action durchgeführt
    const input: UpdateLeadInput = {
      name: editFormData.name.trim(),
      firstName: editFormData.firstName.trim() || undefined,
      lastName: editFormData.lastName.trim() || undefined,
      email: editFormData.email.trim() || undefined,
      phone: editFormData.phone.trim() || undefined,
      status: editFormData.status as UpdateLeadInput["status"],
      priority: editFormData.priority as UpdateLeadInput["priority"],
      source: editFormData.source.trim() || undefined,
    };
    updateLeadMutation.mutate(input);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; content: string; cc?: string; bcc?: string; attachments?: File[] }) => {
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

      const response = await fetch(`/api/leads/${leadId}/send-email`, {
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
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      // Invalidiere auch Dashboard-Stats, damit die Kontaktquote aktualisiert wird
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("E-Mail erfolgreich gesendet");
      setEmailDialogOpen(false);
      setEmailSubject("");
      setEmailContent("");
      setEmailCc("");
      setEmailBcc("");
      setEmailAttachments([]);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Senden der E-Mail");
    },
  });

  const createCallTaskMutation = useMutation({
    mutationFn: async () => {
      const result = await createCallTaskForLead(leadId);
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Erstellen der Aufgabe");
      }
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
      
      if (result.isThirdAttempt && result.taskCompleted) {
        toast.success("3. Versuch erreicht. Kontakt wurde als 'Nicht erreichbar' markiert und Aufgaben wurden abgeschlossen.");
        setCallDialogOpen(false);
      } else if (result.taskId) {
        toast.success(`Aufgabe 'Kontakt anrufen' wurde erstellt (Versuch ${result.attemptCount}/3)`);
      } else {
        // Task existiert bereits
        toast(`Aufgabe existiert bereits (Versuch ${result.attemptCount}/3)`);
      }
      setCallDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Erstellen der Aufgabe");
    },
  });

  const completeTasksMutation = useMutation({
    mutationFn: async () => {
      const result = await completeAllTasksForLead(leadId);
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Abschließen der Aufgaben");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
    },
    onError: (error: any) => {
      console.error("Error completing tasks:", error);
      // Nicht als Fehler anzeigen, da es nicht kritisch ist
    },
  });

  const resetCallCounterMutation = useMutation({
    mutationFn: async () => {
      const result = await resetCallTaskCounter(leadId);
      if (!result.success) {
        throw new Error(result.error || "Fehler beim Zurücksetzen des Zählers");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["contact-tasks"] });
    },
    onError: (error: any) => {
      console.error("Fehler beim Zurücksetzen des Zählers:", error);
      // Nicht als Fehler anzeigen, da dies nicht kritisch ist
    },
  });

  const handleSendEmail = () => {
    if (!emailSubject.trim()) {
      toast.error("Bitte gib einen Betreff ein");
      return;
    }
    if (!emailContent.trim()) {
      toast.error("Bitte gib einen E-Mail-Inhalt ein");
      return;
    }
    if (!lead?.email) {
      toast.error("Keine E-Mail-Adresse für diesen Kontakt vorhanden");
      return;
    }
    sendEmailMutation.mutate({
      subject: emailSubject,
      content: emailContent,
      cc: emailCc.trim() || undefined,
      bcc: emailBcc.trim() || undefined,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setEmailAttachments((prev) => [...prev, ...files]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setEmailAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleCommExpanded = (commId: string) => {
    setExpandedCommId(expandedCommId === commId ? null : commId);
  };


  const handleCompanyChange = (newCompanyId: string) => {
    console.log("[DEBUG] handleCompanyChange called with:", {
      newCompanyId,
      type: typeof newCompanyId,
      length: newCompanyId?.length,
      currentLeadCompanyId: lead?.companyId,
    });
    
    // Normalisiere: Leerer String bedeutet "Kein Unternehmen", UUIDs werden getrimmt
    const normalizedCompanyId = newCompanyId === "" 
      ? "" 
      : (typeof newCompanyId === "string" ? newCompanyId.trim() : "");
    
    console.log("[DEBUG] handleCompanyChange normalized:", {
      normalizedCompanyId,
      type: typeof normalizedCompanyId,
      length: normalizedCompanyId?.length,
      willUpdate: normalizedCompanyId !== (lead?.companyId || ""),
    });
    
    if (normalizedCompanyId !== (lead?.companyId || "")) {
      updateCompanyMutation.mutate({ companyId: normalizedCompanyId });
    }
  };

  const leadTagIds = lead?.tags?.map((lt: any) => lt.tag.id) || [];
  const availableTags = allTags?.filter((tag: any) => !leadTagIds.includes(tag.id)) || [];

  if (isLoading) {
    return <div className="space-y-4">Laden...</div>;
  }

  if (!lead) {
    return <div>Lead nicht gefunden</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#2D3748" }}>
            {lead.type === "CONTACT" 
              ? (lead.name || "Unbekannt")
              : (lead.company?.name || lead.name || "Unbekannt")}
          </h1>
          {lead.type === "CONTACT" && lead.company?.name && lead.company.name !== "Unbekannt" && (
            <p className="text-lg text-gray-500 mt-1">{lead.company.name}</p>
          )}
          {lead.type === "COMPANY" && lead.company?.name && lead.name && lead.company.name !== lead.name && (
            <p className="text-lg text-gray-500 mt-1">{lead.name}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {lead.tasks && lead.tasks.some((task: any) => 
              task.status === "PENDING" || task.status === "IN_PROGRESS"
            ) && (
              <div 
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 border border-amber-200"
                title="Dieser Lead hat offene Aufgaben"
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: "#F59E0B" }} />
                <span className="text-sm font-medium" style={{ color: "#F59E0B" }}>
                  Offene Aufgabe
                </span>
              </div>
            )}
            <Badge variant={statusColors[lead.status] || "default"}>
              {statusLabels[lead.status] || lead.status}
            </Badge>
            {lead.company?.category && (
              <Badge variant="secondary">{lead.company.category}</Badge>
            )}
            {lead.source && (
              <Badge variant="secondary" style={{ backgroundColor: "#1A365D20", color: "#1A365D" }}>
                Quelle: {lead.source}
              </Badge>
            )}
            {lead.company?.hasBadReviews && (
              <Badge variant="warning">Schlechte Reviews</Badge>
            )}
            {lead.company?.hasPoorProfile && (
              <Badge variant="warning">Unvollständiges Profil</Badge>
            )}
          </div>
          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {lead.tags.map((leadTag: any) => (
                <Badge
                  key={leadTag.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                  style={{
                    backgroundColor: leadTag.tag.color + "20",
                    color: leadTag.tag.color,
                    borderColor: leadTag.tag.color + "40",
                  }}
                >
                  {leadTag.tag.name}
                  <button
                    onClick={() => handleRemoveTag(leadTag.tag.id)}
                    disabled={removeTagMutation.isPending}
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTagDialogOpen(true)}
                className="h-6 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Tag hinzufügen
              </Button>
            </div>
          )}
          {(!lead.tags || lead.tags.length === 0) && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTagDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Tag hinzufügen
              </Button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {lead.phone && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCallPhone(phoneOptions[0] ?? null);
                setCallDialogOpen(true);
              }}
              className="inline-flex items-center justify-center"
            >
              <Phone className="h-4 w-4 mr-2" />
              Anrufen
            </Button>
          )}
          <Button variant="outline" onClick={handleEdit}>Bearbeiten</Button>
          <Button onClick={() => setEmailDialogOpen(true)}>E-Mail senden</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kontaktdaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lead.source && (
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <MessageSquare className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Lead-Quelle</p>
                    <p className="text-sm font-medium" style={{ color: "#2D3748" }}>{lead.source}</p>
                  </div>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <a href={`tel:${lead.phone}`} className="hover:underline" style={{ color: "#1A365D" }}>
                    {lead.phone}
                  </a>
                  <span className="text-xs text-gray-400">(Kontakt)</span>
                  {hasSuccessfulOutboundCallForPhone(lead.phone) && (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: "#48BB7820",
                        color: "#48BB78",
                        borderColor: "#48BB7840",
                      }}
                    >
                      Verifiziert
                    </Badge>
                  )}
                </div>
              )}
              {lead.company?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <a href={`tel:${lead.company.phone}`} className="hover:underline" style={{ color: "#1A365D" }}>
                    {lead.company.phone}
                  </a>
                  <span className="text-xs text-gray-400">(Unternehmen)</span>
                  {hasSuccessfulOutboundCallForPhone(lead.company.phone) && (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: "#48BB7820",
                        color: "#48BB78",
                        borderColor: "#48BB7840",
                      }}
                    >
                      Verifiziert
                    </Badge>
                  )}
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <a href={`mailto:${lead.email}`} className="hover:underline" style={{ color: "#1A365D" }}>
                    {lead.email}
                  </a>
                  {(() => {
                    // "Verifiziert" if we have at least one outbound EMAIL that was delivered/opened/clicked
                    const comms = (lead.communications || []) as any[];
                    const isVerified = comms.some(
                      (c) =>
                        c?.type === "EMAIL" &&
                        c?.direction === "OUTBOUND" &&
                        ["delivered", "opened", "clicked"].includes((c?.status || "").toLowerCase())
                    );
                    if (!isVerified) return null;
                    return (
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{
                          backgroundColor: "#48BB7820",
                          color: "#48BB78",
                          borderColor: "#48BB7840",
                        }}
                      >
                        Verifiziert
                      </Badge>
                    );
                  })()}
                </div>
              )}
              {lead.company?.website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <a
                    href={lead.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: "#1A365D" }}
                  >
                    {lead.company.website}
                  </a>
                </div>
              )}
              {lead.company?.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p>{lead.company.address}</p>
                    {lead.company.city && (
                      <p className="text-gray-500">
                        {lead.company.city}
                        {lead.company.state && `, ${lead.company.state}`}
                        {lead.company.zipCode && ` ${lead.company.zipCode}`}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Rating nur für Unternehmen anzeigen, nicht für Kontakte */}
              {lead.type === "COMPANY" && lead.company?.rating && (
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                  <div>
                    <span className="font-medium">{lead.company.rating.toFixed(1)}</span>
                    {lead.company.reviewCount && (
                      <span className="text-gray-500 ml-2">
                        ({lead.company.reviewCount} Bewertungen)
                      </span>
                    )}
                  </div>
                </div>
              )}
              {/* Für Kontakte: Unternehmen-Zuordnung anzeigen und ändern */}
              {lead.type === "CONTACT" && (
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Unternehmen</p>
                    <Select
                      value={lead.companyId || ""}
                      onValueChange={handleCompanyChange}
                      disabled={updateLeadMutation.isPending}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unternehmen auswählen">
                          {lead.company?.name && lead.company.name.trim() !== "" 
                            ? lead.company.name 
                            : "Kein Unternehmen"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Kein Unternehmen</SelectItem>
                        {companies
                          ?.filter((company: any) => 
                            company.name && 
                            company.name.trim() !== "" && 
                            company.name.trim().toLowerCase() !== "unbekannt"
                          )
                          ?.map((company: any) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Google Reviews nur für Unternehmen anzeigen */}
          {lead.type === "COMPANY" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Google Reviews</CardTitle>
                    <CardDescription>
                      Bewertungen von Google Business Profile
                      {lead.company?.reviewCount && ` (${lead.company.reviewCount} insgesamt)`}
                    </CardDescription>
                  </div>
                  {lead.company?.googlePlaceId && (
                    <a
                      href={`https://www.google.com/maps/place/?q=place_id:${lead.company.googlePlaceId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        Alle Reviews
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {lead.company?.reviews && lead.company.reviews.length > 0 ? (
                  <div className="space-y-4">
                    {lead.company.reviews.map((review: any) => (
                      <div
                        key={review.id}
                        className="border-l-2 border-yellow-500 pl-4 py-3 hover:bg-gray-50 rounded-r"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={review.rating >= 4 ? "success" : review.rating >= 3 ? "default" : "warning"}
                                className="flex items-center gap-1 text-xs"
                              >
                                <Star className="h-3 w-3 fill-current" />
                                {review.rating}
                              </Badge>
                              <p className="text-sm font-medium" style={{ color: "#2D3748" }}>
                                {review.authorName}
                              </p>
                            </div>
                            {review.text && (
                              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                                {review.text}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              {formatDateTime(review.reviewTime)}
                            </p>
                          </div>
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 ml-2 flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Star className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                      {lead.company?.rating
                        ? `Dieses Unternehmen hat ${lead.company.reviewCount || 0} Bewertungen, aber die einzelnen Reviews wurden noch nicht importiert.`
                        : "Noch keine Reviews vorhanden"}
                    </p>
                    {lead.company?.rating && (
                      <p className="text-xs text-gray-400 mt-2">
                        Durchschnittsbewertung: {lead.company.rating.toFixed(1)} ⭐
                      </p>
                    )}
                    {lead.company?.googlePlaceId && (
                      <a
                        href={`https://www.google.com/maps/place/?q=place_id:${lead.company.googlePlaceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 flex items-center gap-2"
                        >
                          Alle Reviews auf Google ansehen
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Verbundene Kontakte nur für Unternehmen anzeigen */}
          {lead.type === "COMPANY" && (lead as any).relatedContacts && (lead as any).relatedContacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Verbundene Kontakte</CardTitle>
                <CardDescription>
                  Alle Kontakte, die diesem Unternehmen zugeordnet sind
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(lead as any).relatedContacts.map((contact: any) => (
                    <Link
                      key={contact.id}
                      href={`/dashboard/leads/${contact.id}`}
                      className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      style={{ "--hover-border-color": "#1A365D" } as React.CSSProperties}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#1A365D";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium" style={{ color: "#2D3748" }}>{contact.name || "Unbekannt"}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {contact.email && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </span>
                            )}
                            {contact.phone && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </span>
                            )}
                          </div>
                          {contact.tags && contact.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {contact.tags.slice(0, 3).map((leadTag: any) => (
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
                        </div>
                        <Badge variant={statusColors[contact.status] || "default"} className="ml-2">
                          {statusLabels[contact.status] || contact.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}


          <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Notiz hinzufügen</DialogTitle>
                <DialogDescription>
                  Füge eine Notiz zu diesem Lead hinzu. Datum und Uhrzeit werden automatisch gesetzt.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Textarea
                  placeholder="Notiz eingeben..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNoteDialogOpen(false);
                    setNoteContent("");
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleAddNote}
                  disabled={createNoteMutation.isPending || !noteContent.trim()}
                >
                  {createNoteMutation.isPending ? "Wird gespeichert..." : "Notiz hinzufügen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteNoteDialogOpen} onOpenChange={setDeleteNoteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Notiz löschen</DialogTitle>
                <DialogDescription>
                  Möchtest Du diese Notiz wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteNoteDialogOpen(false);
                    setNoteToDelete(null);
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteNoteConfirm}
                  disabled={deleteNoteMutation.isPending}
                >
                  {deleteNoteMutation.isPending ? "Wird gelöscht..." : "Löschen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Kommunikation</CardTitle>
                  <CardDescription>Verlauf aller Kommunikationen</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Antwort hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lead.communications && lead.communications.length > 0 ? (
                <div className="space-y-4">
                  {lead.communications.map((comm: any) => {
                    const metadata = (comm.metadata as any) || {};
                    const statusLabels: Record<string, string> = {
                      sent: "Gesendet",
                      scheduled: "Geplant",
                      delivered: "Zugestellt",
                      opened: "Geöffnet",
                      clicked: "Geklickt",
                      bounced: "Zurückgewiesen",
                      failed: "Fehlgeschlagen",
                      complained: "Beschwerde",
                      unsubscribed: "Abgemeldet",
                    };

                    const statusColors: Record<string, string> = {
                      sent: "#3B82F6",
                      scheduled: "#6B7280",
                      delivered: "#10B981",
                      opened: "#8B5CF6",
                      clicked: "#F59E0B",
                      bounced: "#EF4444",
                      failed: "#DC2626",
                      complained: "#F97316",
                      unsubscribed: "#6B7280",
                    };

                    const statusIcons: Record<string, any> = {
                      sent: Send,
                      scheduled: Clock,
                      delivered: CheckCircle,
                      opened: Eye,
                      clicked: MousePointerClick,
                      bounced: AlertCircle,
                      failed: AlertCircle,
                      complained: AlertCircle,
                      unsubscribed: AlertCircle,
                    };

                    const StatusIcon = comm.status && statusIcons[comm.status] ? statusIcons[comm.status] : null;

                    const isExpanded = expandedCommId === comm.id;

                    return (
                      <div key={comm.id} className="border-b border-gray-100 pb-4 last:border-0">
                        <div 
                          className="flex items-start justify-between cursor-pointer hover:bg-gray-50 p-2 rounded -m-2 transition-colors"
                          onClick={() => toggleCommExpanded(comm.id)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary">{comm.type}</Badge>
                              <Badge variant={comm.direction === "INBOUND" ? "default" : "success"}>
                                {comm.direction === "INBOUND" ? "Eingehend" : "Ausgehend"}
                              </Badge>
                              {(metadata.type === "auto-reply" || metadata.type === "account-activation") && comm.type === "EMAIL" && comm.direction === "OUTBOUND" && (
                                <Badge
                                  variant="secondary"
                                  className="flex items-center gap-1"
                                  style={{
                                    backgroundColor: "#48BB7820",
                                    color: "#48BB78",
                                    border: "1px solid #48BB78",
                                  }}
                                >
                                  <Bot className="h-3 w-3" />
                                  Automatisch
                                </Badge>
                              )}
                              {comm.status && comm.type === "EMAIL" && (
                                <Badge
                                  variant="secondary"
                                  className="flex items-center gap-1"
                                  style={{
                                    backgroundColor: `${statusColors[comm.status] || "#6B7280"}20`,
                                    color: statusColors[comm.status] || "#6B7280",
                                    border: `1px solid ${statusColors[comm.status] || "#6B7280"}`,
                                  }}
                                >
                                  {StatusIcon && <StatusIcon className="h-3 w-3" />}
                                  {statusLabels[comm.status] || comm.status}
                                </Badge>
                              )}
                            </div>
                            {comm.subject && (
                              <p className="font-medium mt-2" style={{ color: "#2D3748" }}>{comm.subject}</p>
                            )}
                            {!isExpanded && !comm.subject && (
                              <p className="text-sm text-gray-500 mt-2 line-clamp-1">
                                {comm.content.substring(0, 100)}{comm.content.length > 100 ? "..." : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <p className="text-xs text-gray-500">
                              {formatDateTime(comm.createdAt)}
                            </p>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p 
                              className="text-sm whitespace-pre-wrap break-words max-w-full" 
                              style={{ 
                                color: "#2D3748",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word"
                              }}
                            >
                              {comm.content}
                            </p>
                            
                            {/* Email tracking information */}
                            {comm.type === "EMAIL" && comm.direction === "OUTBOUND" && metadata && (
                              <div className="mt-2 space-y-1">
                                {metadata.deliveredAt && (
                                  <p className="text-xs text-gray-500">
                                    Zugestellt: {formatDateTime(new Date(metadata.deliveredAt))}
                                  </p>
                                )}
                                {metadata.openedAt && (
                                  <p className="text-xs text-gray-500">
                                    Geöffnet: {formatDateTime(new Date(metadata.openedAt))}
                                    {metadata.openedCount > 1 && ` (${metadata.openedCount}x)`}
                                  </p>
                                )}
                                {metadata.clickedAt && (
                                  <p className="text-xs text-gray-500">
                                    Geklickt: {formatDateTime(new Date(metadata.clickedAt))}
                                    {metadata.clickedUrl && ` - ${metadata.clickedUrl}`}
                                  </p>
                                )}
                                {metadata.bouncedAt && (
                                  <p className="text-xs text-red-500">
                                    Zurückgewiesen: {formatDateTime(new Date(metadata.bouncedAt))}
                                    {metadata.bounceReason && ` - ${metadata.bounceReason}`}
                                  </p>
                                )}
                                {metadata.failedAt && (
                                  <p className="text-xs text-red-500">
                                    Fehlgeschlagen: {formatDateTime(new Date(metadata.failedAt))}
                                    {metadata.failureReason && ` - ${metadata.failureReason}`}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Noch keine Kommunikation</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Aufgaben-Sektion - nur anzeigen wenn offene Tasks vorhanden sind */}
          {lead.tasks && lead.tasks.some((task: any) => 
            task.status === "PENDING" || task.status === "IN_PROGRESS"
          ) && (
            <Card>
              <CardHeader>
                <CardTitle>Aufgaben</CardTitle>
                <CardDescription>
                  Offene Aufgaben für diesen Lead
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lead.tasks
                    .filter((task: any) => task.status === "PENDING" || task.status === "IN_PROGRESS")
                    .map((task: any) => (
                      <div
                        key={task.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4" style={{ color: "#F59E0B" }} />
                              <h4 className="font-medium text-gray-900">{task.title}</h4>
                              <Badge variant="warning" className="text-xs">
                                {task.status === "PENDING" ? "Offen" : "In Bearbeitung"}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-2">
                                {task.description}
                              </p>
                            )}
                            {task.dueDate && (
                              <p className="text-xs text-gray-500">
                                Fällig: {formatDateTime(task.dueDate)}
                              </p>
                            )}
                            {task.createdAt && (
                              <p className="text-xs text-gray-500">
                                Erstellt: {formatDateTime(task.createdAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Aktivitäten</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Erstellt</p>
                    <p className="text-xs text-gray-500">{formatDateTime(lead.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Aktualisiert</p>
                    <p className="text-xs text-gray-500">{formatDateTime(lead.updatedAt)}</p>
                  </div>
                </div>
                {lead.source && (
                  <div className="flex items-start gap-3 pt-3 border-t border-gray-200">
                    <MessageSquare className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-2">Lead-Quelle</p>
                      <p className="text-sm" style={{ color: "#2D3748" }}>{lead.source}</p>
                      {(lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmTerm || lead.utmContent) && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">UTM Parameter</p>
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            {lead.utmSource && (
                              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                                <span className="text-gray-600">Source:</span>
                                <span className="font-medium" style={{ color: "#2D3748" }}>{lead.utmSource}</span>
                              </div>
                            )}
                            {lead.utmMedium && (
                              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                                <span className="text-gray-600">Medium:</span>
                                <span className="font-medium" style={{ color: "#2D3748" }}>{lead.utmMedium}</span>
                              </div>
                            )}
                            {lead.utmCampaign && (
                              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                                <span className="text-gray-600">Campaign:</span>
                                <span className="font-medium" style={{ color: "#2D3748" }}>{lead.utmCampaign}</span>
                              </div>
                            )}
                            {lead.utmTerm && (
                              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                                <span className="text-gray-600">Term:</span>
                                <span className="font-medium" style={{ color: "#2D3748" }}>{lead.utmTerm}</span>
                              </div>
                            )}
                            {lead.utmContent && (
                              <div className="flex items-center justify-between py-1 border-b border-gray-100">
                                <span className="text-gray-600">Content:</span>
                                <span className="font-medium" style={{ color: "#2D3748" }}>{lead.utmContent}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notizen</CardTitle>
              <CardDescription>Interne Notizen zu diesem Lead</CardDescription>
            </CardHeader>
            <CardContent>
              {lead.notes && lead.notes.length > 0 ? (
                <div className="space-y-4">
                  {lead.notes.map((note: any) => (
                    <div key={note.id} className="border-l-2 pl-4 py-2 relative group" style={{ borderColor: "#1A365D" }}>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">
                          {formatDateTime(note.createdAt)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNoteClick(note.id)}
                          disabled={deleteNoteMutation.isPending}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 hover:opacity-80 hover:bg-gray-50"
                          style={{ color: "#1A365D" }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Noch keine Notizen</p>
              )}
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setNoteDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Notiz hinzufügen
              </Button>
            </CardContent>
          </Card>

          {lead.crmId && (
            <Card>
              <CardHeader>
                <CardTitle>CRM Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500">CRM System</p>
                    <p className="font-medium">{lead.crmType}</p>
                  </div>
                  {lead.crmUrl && (
                    <a href={lead.crmUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        Im CRM öffnen
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Tag Management Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag hinzufügen</DialogTitle>
            <DialogDescription>
              Wähle einen vorhandenen Tag oder erstelle einen neuen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Vorhandene Tags */}
            {availableTags && availableTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vorhandene Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag: any) => (
                    <Button
                      key={tag.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddExistingTag(tag.id)}
                      disabled={addTagMutation.isPending}
                      style={{
                        backgroundColor: tag.color + "20",
                        color: tag.color,
                        borderColor: tag.color + "40",
                      }}
                    >
                      {tag.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Neuer Tag */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Neuen Tag erstellen
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag-Name eingeben..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                />
                <Button
                  onClick={handleAddTag}
                  disabled={addTagMutation.isPending || !newTagName.trim()}
                >
                  {addTagMutation.isPending ? "..." : "Erstellen"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTagDialogOpen(false);
                setNewTagName("");
              }}
            >
              Schließen
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Bearbeiten Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="!max-w-[60vw] w-[60vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kontakt bearbeiten</DialogTitle>
            <DialogDescription>
              Aktualisiere die Kontaktdaten
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Max Mustermann"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-Mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="max@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">Vorname</Label>
                <Input
                  id="edit-firstName"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  placeholder="Max"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Nachname</Label>
                <Input
                  id="edit-lastName"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  placeholder="Mustermann"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefon</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="+49 123 456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-source">Quelle</Label>
                <Input
                  id="edit-source"
                  value={editFormData.source}
                  onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
                  placeholder="z.B. Website, Empfehlung"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">Neu</SelectItem>
                    <SelectItem value="CONTACTED">Kontaktiert</SelectItem>
                    <SelectItem value="QUALIFIED">Qualifiziert</SelectItem>
                    <SelectItem value="PROPOSAL">Angebot</SelectItem>
                    <SelectItem value="NEGOTIATION">Verhandlung</SelectItem>
                    <SelectItem value="WON">Kunde</SelectItem>
                    <SelectItem value="LOST">Verloren</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priorität</Label>
                <Select
                  value={editFormData.priority}
                  onValueChange={(value) => setEditFormData({ ...editFormData, priority: value })}
                >
                  <SelectTrigger id="edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Niedrig</SelectItem>
                    <SelectItem value="MEDIUM">Mittel</SelectItem>
                    <SelectItem value="HIGH">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={updateLeadMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateLeadMutation.isPending || !editFormData.name.trim()}
            >
              {updateLeadMutation.isPending ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E-Mail senden Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="!max-w-[60vw] w-[60vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail senden</DialogTitle>
            <DialogDescription>
              Sende eine E-Mail an {lead?.name || lead?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">An</Label>
              <Input
                id="email-to"
                type="email"
                value={lead?.email || ""}
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
              }}
              disabled={sendEmailMutation.isPending}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailContent.trim() || !lead?.email}
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
          setSelectedCallPhone(null);
        }
      }}>
        <DialogContent className="!max-w-[60vw] w-[60vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anruf</DialogTitle>
            <DialogDescription>
              Rufe {lead?.name || lead?.email} an
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
                      try {
                        // Markiere alle offenen Tasks als abgeschlossen
                        await completeTasksMutation.mutateAsync();
                      } catch (error) {
                        console.error("Fehler beim Abschließen der Tasks:", error);
                        // Weiter mit der Logik, auch wenn das Abschließen fehlschlägt
                      }

                      // Zähler zurücksetzen + Tag "Nicht erreichbar" entfernen (nicht blockierend)
                      await resetCallCounterMutation.mutateAsync().catch((error) => {
                        console.error("Fehler beim Zurücksetzen des Zählers:", error);
                      });
                      
                      // Zeige Notizfeld
                      setCallNotes("");
                      setCallReached(true);
                    }}
                    className="flex-1"
                  >
                    Erreicht
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Erstelle neue Aufgabe "Kontakt anrufen" (bestehende Tasks bleiben offen)
                      createCallTaskMutation.mutate();
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
            {callReached && (
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
                      if (!lead?.id) {
                        setCallDialogOpen(false);
                        setCallReached(false);
                        setCallNotes("");
                        return;
                      }
                      
                      try {
                        // Reset Zähler (alle "anrufen" Tasks löschen) - ZUERST
                        await resetCallCounterMutation.mutateAsync().catch((error) => {
                          console.error("Fehler beim Zurücksetzen des Zählers:", error);
                          // Weiter mit Notiz-Erstellung, auch wenn Reset fehlschlägt
                        });
                        
                        // Erstelle Notiz auch beim Schließen (auch wenn leer)
                        const now = new Date();
                        const dateTimeStr = formatDateTime(now);
                        const userName = session?.user?.name || "Unbekannt";
                        const noteContent = `📞 Anruf erfolgreich\n\n${callNotes.trim() || "Anruf erfolgreich abgeschlossen"}\n\n— ${userName}, ${dateTimeStr}`;
                        
                        await createCallCommunicationMutation.mutateAsync({
                          content: noteContent,
                          phone: selectedCallPhone?.phone ?? null,
                          phoneLabel: selectedCallPhone?.label ?? null,
                        });
                      } catch (error: any) {
                        console.error("Fehler beim Erstellen der Notiz:", error);
                        toast.error(error.message || "Fehler beim Speichern des Anrufs");
                      }
                      
                      setCallDialogOpen(false);
                      setCallReached(false);
                      setCallNotes("");
                    }}
                    disabled={resetCallCounterMutation.isPending || createCallCommunicationMutation.isPending}
                    className="flex-1"
                  >
                    {resetCallCounterMutation.isPending || createCallCommunicationMutation.isPending ? (
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
                      if (!lead?.id) return;
                      
                      // Reset Zähler (alle "anrufen" Tasks löschen)
                      await resetCallCounterMutation.mutateAsync().catch(() => {
                        // Ignoriere Fehler beim Reset
                      });
                      
                      // Formatiere Notiz mit Username, Datum und Zeit
                      const now = new Date();
                      const dateTimeStr = formatDateTime(now);
                      const userName = session?.user?.name || "Unbekannt";
                      const noteContent = `📞 Anruf erfolgreich\n\n${callNotes.trim() || "Anruf erfolgreich abgeschlossen"}\n\n— ${userName}, ${dateTimeStr}`;
                      
                      await createCallCommunicationMutation.mutateAsync({
                        content: noteContent,
                        phone: selectedCallPhone?.phone ?? null,
                        phoneLabel: selectedCallPhone?.label ?? null,
                      });
                      setCallDialogOpen(false);
                      setCallReached(false);
                      setCallNotes("");
                    }}
                    disabled={createCallCommunicationMutation.isPending || resetCallCounterMutation.isPending}
                    className="flex-1"
                  >
                    {createCallCommunicationMutation.isPending || resetCallCounterMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Wird gespeichert...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Notiz erstellen
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>
    );
  }