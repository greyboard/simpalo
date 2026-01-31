import { LeadSearchView } from "@/components/search/lead-search-view";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suche - simpalo",
};

export default function SearchPage() {
  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F7FAFC" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <LeadSearchView />
        </main>
      </div>
    </div>
  );
}