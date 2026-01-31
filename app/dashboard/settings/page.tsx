import { SettingsView } from "@/components/settings/settings-view";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Einstellungen - simpalo",
};

export default function SettingsPage() {
  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F7FAFC" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <SettingsView />
        </main>
      </div>
    </div>
  );
}
