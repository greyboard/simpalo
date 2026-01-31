"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCampaignStats, type Campaign } from "@/lib/api/campaigns";
import { formatDate } from "@/lib/utils";
import { TrendingUp, Users, Target, Calendar } from "lucide-react";
import Link from "next/link";

export function CampaignsOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["campaign-stats"],
    queryFn: fetchCampaignStats,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-gray-500">Lade Kampagnen-Statistiken...</div>
      </div>
    );
  }

  if (!stats || stats.campaigns.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Kampagnen-Übersicht</CardTitle>
            <CardDescription>
              Keine Kampagnen-Daten gefunden. Leads mit UTM-Parametern werden hier angezeigt.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gesamt Leads</p>
                <p className="text-2xl font-bold" style={{ color: "#2D3748" }}>{stats.totalLeads}</p>
              </div>
              <Users className="h-8 w-8" style={{ color: "#1A365D" }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Kampagnen</p>
                <p className="text-2xl font-bold" style={{ color: "#2D3748" }}>{stats.totalCampaigns}</p>
              </div>
              <Target className="h-8 w-8" style={{ color: "#1A365D" }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Quellen</p>
                <p className="text-2xl font-bold" style={{ color: "#2D3748" }}>{stats.sources.length}</p>
              </div>
              <TrendingUp className="h-8 w-8" style={{ color: "#1A365D" }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ø Leads/Kampagne</p>
                <p className="text-2xl font-bold" style={{ color: "#2D3748" }}>
                  {stats.totalCampaigns > 0
                    ? Math.round((stats.totalLeads / stats.totalCampaigns) * 10) / 10
                    : 0}
                </p>
              </div>
              <Calendar className="h-8 w-8" style={{ color: "#1A365D" }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kampagnen-Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle>Kampagnen-Details</CardTitle>
          <CardDescription>
            Übersicht aller Kampagnen basierend auf UTM-Parametern
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Quelle</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Kampagne</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Medium</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Leads</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Erste Lead</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Letzte Lead</th>
                </tr>
              </thead>
              <tbody>
                {stats.campaigns.map((campaign: Campaign, index: number) => {
                  const campaignUrl = `/dashboard/campaigns/${encodeURIComponent(campaign.sourceDisplay)}/${encodeURIComponent(campaign.campaign)}`;
                  return (
                    <tr
                      key={`${campaign.sourceDisplay}-${campaign.campaign}-${index}`}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <Link href={campaignUrl}>
                          <Badge 
                            className={typeof getSourceBadgeColor(campaign.sourceDisplay) === "string" ? getSourceBadgeColor(campaign.sourceDisplay) as string : undefined}
                            style={typeof getSourceBadgeColor(campaign.sourceDisplay) === "object" ? getSourceBadgeColor(campaign.sourceDisplay) as React.CSSProperties : undefined}
                          >
                            {campaign.sourceDisplay}
                          </Badge>
                        </Link>
                      </td>
                      <td className="py-4 px-4">
                        <Link href={campaignUrl} className="block">
                          <div>
                            <p className="font-medium hover:underline"
                               style={{ color: "#2D3748", "--hover-color": "#1A365D" } as React.CSSProperties}
                               onMouseEnter={(e) => {
                                 e.currentTarget.style.color = "#1A365D";
                               }}
                               onMouseLeave={(e) => {
                                 e.currentTarget.style.color = "#2D3748";
                               }}
                            >
                              {campaign.campaign}
                            </p>
                            {campaign.term && (
                              <p className="text-xs text-gray-500 mt-1">Term: {campaign.term}</p>
                            )}
                            {campaign.content && (
                              <p className="text-xs text-gray-500 mt-1">Content: {campaign.content}</p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="py-4 px-4">
                        <Link href={campaignUrl}>
                          <span className="text-sm text-gray-600 hover:underline"
                                 style={{ "--hover-color": "#1A365D" } as React.CSSProperties}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.color = "#1A365D";
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.color = "#4b5563";
                                 }}
                          >
                            {campaign.medium || "-"}
                          </span>
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Link href={campaignUrl}>
                          <span className="font-semibold hover:underline"
                                 style={{ color: "#2D3748", "--hover-color": "#1A365D" } as React.CSSProperties}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.color = "#1A365D";
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.color = "#2D3748";
                                 }}
                          >
                            {campaign.leadCount}
                          </span>
                        </Link>
                      </td>
                      <td className="py-4 px-4">
                        <Link href={campaignUrl}>
                          <span className="text-sm text-gray-600 hover:underline"
                                 style={{ "--hover-color": "#1A365D" } as React.CSSProperties}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.color = "#1A365D";
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.color = "#4b5563";
                                 }}
                          >
                            {formatDate(new Date(campaign.firstLead))}
                          </span>
                        </Link>
                      </td>
                      <td className="py-4 px-4">
                        <Link href={campaignUrl}>
                          <span className="text-sm text-gray-600 hover:underline"
                                 style={{ "--hover-color": "#1A365D" } as React.CSSProperties}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.color = "#1A365D";
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.color = "#4b5563";
                                 }}
                          >
                            {formatDate(new Date(campaign.lastLead))}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
