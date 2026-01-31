"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCampaignLeads, fetchCampaignTimeline } from "@/lib/api/campaigns";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft, Users, Calendar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/leads/leads-table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CampaignDetailViewProps {
  source: string;
  campaign: string;
}

export function CampaignDetailView({ source, campaign }: CampaignDetailViewProps) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-leads", source, campaign],
    queryFn: () => fetchCampaignLeads(source, campaign),
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["campaign-timeline", source, campaign, period],
    queryFn: () => fetchCampaignTimeline(source, campaign, period),
    enabled: !!data, // Nur laden wenn campaign data vorhanden ist
  });

  const getSourceBadgeColor = (source: string) => {
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes("meta") || lowerSource.includes("facebook")) {
      return { backgroundColor: "#1A365D20", color: "#1A365D" };
    }
    if (lowerSource.includes("google")) {
      return "bg-green-100 text-green-800";
    }
    if (lowerSource.includes("linkedin")) {
      return { backgroundColor: "#1A365D20", color: "#1A365D" };
    }
    if (lowerSource.includes("tiktok")) {
      return "bg-black text-white";
    }
    return "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-gray-500">Lade Kampagnen-Details...</div>
      </div>
    );
  }

  if (!data || !data.leads) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Kampagne nicht gefunden</CardTitle>
            <CardDescription>
              Die angeforderte Kampagne konnte nicht gefunden werden.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const firstLead = data.leads.length > 0 
    ? new Date(Math.min(...data.leads.map((l: any) => new Date(l.createdAt).getTime())))
    : null;
  const lastLead = data.leads.length > 0
    ? new Date(Math.max(...data.leads.map((l: any) => new Date(l.createdAt).getTime())))
    : null;

  return (
    <div className="space-y-6">
      {/* Header mit Zurück-Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/campaigns">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Übersicht
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold" style={{ color: "#2D3748" }}>{data.campaign}</h1>
            <Badge 
              className={typeof getSourceBadgeColor(data.source) === "string" ? getSourceBadgeColor(data.source) as string : undefined}
              style={typeof getSourceBadgeColor(data.source) === "object" ? getSourceBadgeColor(data.source) as React.CSSProperties : undefined}
            >
              {data.source}
            </Badge>
          </div>
          <p className="text-gray-500 mt-1">
            Alle Leads dieser Kampagne im Detail
          </p>
        </div>
      </div>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gesamt Leads</p>
                <p className="text-2xl font-bold" style={{ color: "#2D3748" }}>{data.totalLeads}</p>
              </div>
              <Users className="h-8 w-8" style={{ color: "#1A365D" }} />
            </div>
          </CardContent>
        </Card>

        {firstLead && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Erste Lead</p>
                  <p className="text-sm font-semibold" style={{ color: "#2D3748" }}>
                    {formatDateTime(firstLead)}
                  </p>
                </div>
                <Calendar className="h-8 w-8" style={{ color: "#1A365D" }} />
              </div>
            </CardContent>
          </Card>
        )}

        {lastLead && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Letzte Lead</p>
                  <p className="text-sm font-semibold" style={{ color: "#2D3748" }}>
                    {formatDateTime(lastLead)}
                  </p>
                </div>
                <Calendar className="h-8 w-8" style={{ color: "#1A365D" }} />
              </div>
            </CardContent>
          </Card>
        )}

        {data.leads.length > 0 && firstLead && lastLead && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Laufzeit</p>
                  <p className="text-sm font-semibold" style={{ color: "#2D3748" }}>
                    {Math.ceil((lastLead.getTime() - firstLead.getTime()) / (1000 * 60 * 60 * 24))} Tage
                  </p>
                </div>
                <TrendingUp className="h-8 w-8" style={{ color: "#1A365D" }} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Timeline Graph */}
      {timelineData && timelineData.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lead-Entwicklung</CardTitle>
                <CardDescription>
                  Anzahl der Leads pro {period === "day" ? "Tag" : period === "week" ? "Woche" : "Monat"}
                </CardDescription>
              </div>
              <Select 
                value={period} 
                onValueChange={(value: string) => {
                  if (value === "day" || value === "week" || value === "month") {
                    setPeriod(value);
                  }
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Täglich" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Täglich</SelectItem>
                  <SelectItem value="week">Wöchentlich</SelectItem>
                  <SelectItem value="month">Monatlich</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {timelineLoading ? (
              <div className="h-[400px] flex items-center justify-center text-gray-500">
                Lade Graph-Daten...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timelineData.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px"
                    }}
                    labelFormatter={(label) => {
                      if (period === "month") {
                        const [year, month] = label.split("-");
                        const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
                        return `${monthNames[parseInt(month) - 1]} ${year}`;
                      } else if (period === "week") {
                        return `Kalenderwoche ${label}`;
                      } else {
                        const date = new Date(label);
                        return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
                      }
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="#1A365D" 
                    strokeWidth={2}
                    name="Leads"
                    dot={{ fill: "#1A365D", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leads-Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle>Leads ({data.totalLeads})</CardTitle>
          <CardDescription>
            Alle Leads, die über diese Kampagne generiert wurden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadsTable leads={data.leads} isLoading={false} showLocationAndRating={false} />
        </CardContent>
      </Card>
    </div>
  );
}
