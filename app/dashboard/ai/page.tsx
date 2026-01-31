import { AIFeaturesView } from "@/components/ai/ai-features-view";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "KI-Funktionen - simpalo",
};

export default function AIPage() {
  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F7FAFC" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <AIFeaturesView />
        </main>
      </div>
    </div>
  );
}