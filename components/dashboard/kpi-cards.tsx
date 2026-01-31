"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Phone, TrendingUp, CheckCircle2 } from "lucide-react";

interface DashboardStats {
  totalLeads: number;
  totalContacts: number;
  totalCompanies: number;
  newLeads: number;
  contactedLeads: number;
  conversionRate: number;
}

interface KPICardsProps {
  stats?: DashboardStats;
  isLoading: boolean;
}

export function KPICards({ stats, isLoading }: KPICardsProps) {
  const kpis = [
    {
      title: "Neue Leads",
      value: stats?.newLeads || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Kontaktierte Leads",
      value: stats?.contactedLeads || 0,
      icon: Phone,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Gesamte Kontakte",
      value: `${stats?.totalContacts || 0} / ${stats?.totalCompanies || 0}`,
      subtitle: "Kontakte / Unternehmen",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Kontaktquote",
      value: `${stats?.conversionRate?.toFixed(1) || 0}%`,
      icon: CheckCircle2,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {kpi.title}
              </CardTitle>
              <div className={`${kpi.bgColor} p-2 rounded-lg`}>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
              ) : (
                <div>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  {kpi.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{kpi.subtitle}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}