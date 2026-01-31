"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeadsTable } from "./leads-table";
import { LeadFilters } from "./lead-filters";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Filter, X } from "lucide-react";
import Link from "next/link";
import { fetchLeads, type LeadFilters as LeadFiltersType } from "@/lib/api/leads";

export function LeadsListView() {
  const [activeTab, setActiveTab] = useState<"companies" | "contacts">("contacts");
  const [filters, setFilters] = useState<LeadFiltersType>({});
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50>(25);

  // Filter leads based on tab
  // For companies: type = "COMPANY"
  // For contacts: type = "CONTACT"
  const allFilters: LeadFiltersType = {
    ...filters,
    ...(activeTab === "companies" 
      ? { type: "COMPANY" } 
      : { type: "CONTACT" }),
    page,
    pageSize,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["leads", allFilters],
    queryFn: () => fetchLeads(allFilters),
  });

  const leads = data?.items || [];
  const total = data?.total || 0;

  // Reset paging when filters/tab change
  // (the queryKey includes filters, but we also want UX to start from page 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resetPage = () => setPage(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-gray-500 mt-1">
            Verwalte alle Deine Kontakte und Firmen an einem Ort
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Filter ausblenden
              </>
            ) : (
              <>
                <Filter className="h-4 w-4 mr-2" />
                Filter anzeigen
              </>
            )}
          </Button>
          <Link href="/dashboard/search">
            <Button variant="outline">Lead-Suche</Button>
          </Link>
          {activeTab === "contacts" && (
            <Link href="/dashboard/leads/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neuer Kontakt
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as "companies" | "contacts");
          resetPage();
        }}
      >
        <TabsList>
          <TabsTrigger value="contacts">Kontakte</TabsTrigger>
          <TabsTrigger value="companies">Firmen</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts">
          {showFilters && (
            <div className="mb-4">
              <LeadFilters
                filters={filters}
                onFiltersChange={(next) => {
                  setFilters(next);
                  resetPage();
                }}
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Alle Kontakte</CardTitle>
                  <CardDescription>
                    {total} Kontakte gefunden
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Einträge pro Seite</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      const next = (parseInt(value, 10) as 25 | 50) || 25;
                      setPageSize(next);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue>{pageSize}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LeadsTable
                leads={leads}
                isLoading={isLoading}
                showLocationAndRating={false}
                pagination={{
                  page,
                  pageSize,
                  total,
                  onPageChange: setPage,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="companies">
          {showFilters && (
            <div className="mb-4">
              <LeadFilters
                filters={filters}
                onFiltersChange={(next) => {
                  setFilters(next);
                  resetPage();
                }}
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Alle Firmen</CardTitle>
                  <CardDescription>
                    {total} Firmen gefunden
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Einträge pro Seite</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      const next = (parseInt(value, 10) as 25 | 50) || 25;
                      setPageSize(next);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue>{pageSize}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LeadsTable
                leads={leads}
                isLoading={isLoading}
                showLocationAndRating={true}
                pagination={{
                  page,
                  pageSize,
                  total,
                  onPageChange: setPage,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}