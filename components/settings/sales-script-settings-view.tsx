"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Save, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

const DEFAULT_SALES_SCRIPT = `📞 Verkaufsscript: Coaching-Performance

1. Einleitung & Connect
„Hallo {{vorname}}, hier ist {{benutzername}} von {{account}}.

Ich melde mich bei dir, weil du dich über {{quelle}} bei uns gemeldet hast. Ich habe gesehen, dass du über unsere {{utmCampaign}} Kampagne auf uns aufmerksam geworden bist – freut mich, dass du den Weg zu uns gefunden hast!

Hast du gerade zwei Minuten Zeit, oder erwische ich dich mitten in einem Meeting?“

2. Qualifizierung & Kontext
„Du hattest bei der Anmeldung ja die Firma {{firma}} angegeben. Sitzt ihr aktuell direkt in {{stadt}}?

(Kurzer Smalltalk über den Standort)

{{vorname}}, damit ich das Gespräch heute so wertvoll wie möglich für dich gestalten kann: Was war der Hauptgrund, warum du dich ausgerechnet jetzt eingetragen hast?“

3. Der Pitch (Problem & Lösung)
„Das verstehe ich gut. Viele unserer Kunden aus der Branche kommen zu uns, weil sie genau an diesem Punkt feststecken.

Unser Coaching-Ansatz ist darauf ausgelegt, genau diese Hürden zu nehmen. Da du uns über {{utmSource}} gefunden hast, weißt du ja bereits, dass wir uns auf messbare Ergebnisse konzentrieren. Wir wollen sicherstellen, dass {{firma}} in den nächsten Monaten deutlich effizienter aufgestellt ist.“

4. Einwandbehandlung (Interaktiv)
Einwand: „Ich muss mir das erst noch überlegen.“

„Völlig berechtigt, {{vorname}}. Oft liegt das daran, dass noch eine spezifische Frage offen ist. Wenn wir auf deine aktuelle Situation bei {{firma}} schauen: Ist es eher die zeitliche Komponente oder die methodische Umsetzung, bei der du noch zögerst?“

Einwand: „Schick mir erst mal Infos per Mail.“

„Das mache ich sehr gerne an {{email}}. Aber Hand aufs Herz: Meistens landen diese Mails im Postfach-Dschungel. Wenn du jetzt hier am Telefon bist – was ist die eine Info, die dir noch fehlt, um zu sagen: 'Das ist genau das, was wir brauchen'?“

5. Abschluss & Next Steps
„Alles klar. Der nächste logische Schritt wäre, dass wir uns das Ganze mal im Detail für deine Situation anschauen.

Ich habe hier noch deine Nummer {{telefon}} hinterlegt – falls wir mal kurzfristig einen Termin verschieben müssen, ist das noch die beste Nummer?

Lass uns direkt einen Termin fixieren. Passt es dir nächste Woche Dienstag?"`;

export function SalesScriptSettingsView() {
  const queryClient = useQueryClient();
  const [salesScript, setSalesScript] = useState("");

  const { data: userSettings, isLoading } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const response = await axios.get("/api/user/settings");
      return response.data;
    },
  });

  useEffect(() => {
    if (userSettings?.settings) {
      const settings = userSettings.settings as any;
      setSalesScript(settings.salesScript || "");
    } else if (!isLoading && userSettings !== undefined) {
      // Wenn keine Settings vorhanden sind, leere das Feld
      setSalesScript("");
    }
  }, [userSettings, isLoading]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { salesScript: string }) => {
      const response = await axios.put("/api/user/settings", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Verkaufsscript erfolgreich gespeichert");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Fehler beim Speichern des Verkaufsscripts");
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({ salesScript: salesScript || "" });
  };

  const handleLoadTemplate = () => {
    setSalesScript(DEFAULT_SALES_SCRIPT);
  };

  if (isLoading) {
    return <div className="text-gray-500">Lade Einstellungen...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Persönliches Verkaufsscript
          </CardTitle>
          <CardDescription>
            Erstelle Dein persönliches Verkaufsscript für Telefonanrufe. Nutze Platzhalter wie in E-Mail-Templates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sales-script">Verkaufsscript</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadTemplate}
              >
                Vorlage nutzen
              </Button>
            </div>
            <Textarea
              id="sales-script"
              value={salesScript}
              onChange={(e) => setSalesScript(e.target.value)}
              placeholder="Klicke auf 'Vorlage nutzen' um die Standard-Vorlage zu laden, oder erstelle Dein eigenes Verkaufsscript..."
              rows={20}
              className="resize-none font-mono text-sm"
            />
            <p className="text-sm text-gray-500">
              Verfügbare Platzhalter:{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{vorname}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{nachname}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{name}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{email}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{telefon}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{firma}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{adresse}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{stadt}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{plz}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{quelle}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{utmSource}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{utmCampaign}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{benutzername}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{account}}"}</code>
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
