"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Loader2, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";

export function CallTrainerView() {
  const [leadInfo, setLeadInfo] = useState("");
  const [scenario, setScenario] = useState("");
  const [trainingResult, setTrainingResult] = useState<any>(null);

  const generateTrainingMutation = useMutation({
    mutationFn: async ({ leadInfo, scenario }: { leadInfo: string; scenario: string }) => {
      // Call-Training Feature (noch nicht implementiert)
      // Placeholder: Simuliere Training-Generierung
      const response = await fetch("/api/ai/call-trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadInfo, scenario }),
      });
      if (!response.ok) throw new Error("Failed to generate training");
      return response.json();
    },
    onSuccess: (data) => {
      setTrainingResult(data);
      toast.success("Training generiert");
    },
    onError: () => {
      toast.error("Fehler bei der Training-Generierung");
    },
  });

  const handleGenerate = () => {
    if (!leadInfo.trim()) {
      toast.error("Bitte gib Lead-Informationen ein");
      return;
    }
    generateTrainingMutation.mutate({ leadInfo, scenario });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI-Cold-Call-Trainer</h1>
        <p className="text-gray-500 mt-1">
          Simulationen und Tipps zur professionellen Gesprächsführung
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Training konfigurieren</CardTitle>
            <CardDescription>
              Gib Informationen zum Lead und gewünschtem Szenario ein
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lead-Informationen *
              </label>
              <textarea
                className="w-full h-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                placeholder="z.B. Restaurant in Berlin, 4.2 Sterne, 45 Bewertungen, hat Website aber keine Online-Reservierung..."
                value={leadInfo}
                onChange={(e) => setLeadInfo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Szenario (optional)
              </label>
              <Input
                placeholder="z.B. Erstkontakt, Follow-Up, Angebotspräsentation..."
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateTrainingMutation.isPending}
              className="w-full"
            >
              {generateTrainingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Training wird generiert...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Training generieren
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {trainingResult && (
          <Card>
            <CardHeader>
              <CardTitle>Trainings-Vorschlag</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trainingResult.opening && (
                <div>
                  <h3 className="font-semibold mb-2">Einstieg:</h3>
                  <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">
                    {trainingResult.opening}
                  </p>
                </div>
              )}
              {trainingResult.talkingPoints && (
                <div>
                  <h3 className="font-semibold mb-2">Gesprächspunkte:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    {trainingResult.talkingPoints.map((point: string, index: number) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {trainingResult.objectionHandling && (
                <div>
                  <h3 className="font-semibold mb-2">Einwände:</h3>
                  <div className="space-y-2 text-sm">
                    {Object.entries(trainingResult.objectionHandling).map(
                      ([objection, response]) => (
                        <div key={objection} className="bg-gray-50 p-3 rounded">
                          <p className="font-medium text-gray-900">&quot;{objection}&quot;</p>
                          <p className="text-gray-700 mt-1">{response as string}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
              {trainingResult.closing && (
                <div>
                  <h3 className="font-semibold mb-2">Abschluss:</h3>
                  <p className="text-sm text-gray-700 bg-green-50 p-3 rounded">
                    {trainingResult.closing}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {!trainingResult && (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              Gib Lead-Informationen ein, um ein personalisiertes Call-Training zu generieren
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <p className="text-sm text-yellow-800">
            <strong>Hinweis:</strong> Das Call-Training nutzt aktuell eine Platzhalter-Implementierung.
            Dieses Feature ist noch nicht implementiert.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}