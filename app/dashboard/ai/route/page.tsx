import { RoutePlannerView } from "@/components/ai/route-planner-view";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Routenplaner - simpalo",
};

export default function RoutePlannerPage() {
  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F7FAFC" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <RoutePlannerView />
        </main>
      </div>
    </div>
  );
}