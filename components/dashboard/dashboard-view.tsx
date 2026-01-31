"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadsTable } from "@/components/leads/leads-table";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { ContactTasksList } from "@/components/dashboard/contact-tasks-list";
import { useQuery } from "@tanstack/react-query";
import { fetchLeads, fetchDashboardStats } from "@/lib/api/leads";

export function DashboardView() {
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", { type: "CONTACT", page: 1, pageSize: 10 }],
    queryFn: () => fetchLeads({ type: "CONTACT", page: 1, pageSize: 10 }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Übersicht über Deine Leads und Aktivitäten
        </p>
      </div>

      <KPICards stats={stats} isLoading={statsLoading} />

      <ContactTasksList />

      <Card>
        <CardHeader>
          <CardTitle>Neueste Leads</CardTitle>
          <CardDescription>
            Die zuletzt hinzugefügten oder aktualisierten Leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadsTable
            // Safety: ensure dashboard never renders more than 10 items
            leads={(leads?.items || []).slice(0, 10)}
            isLoading={leadsLoading}
            showLocationAndRating={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}