import { CampaignsOverview } from "@/components/campaigns/campaigns-overview";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kampagnen - simpalo",
};

export default function CampaignsPage() {
  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F7FAFC" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Kampagnen</h1>
              <p className="text-gray-500 mt-1">
                Übersicht Ihrer Marketing-Kampagnen basierend auf UTM-Parametern
              </p>
            </div>
            <CampaignsOverview />
          </div>
        </main>
      </div>
    </div>
  );
}
