import { CampaignDetailView } from "@/components/campaigns/campaign-detail-view";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Metadata } from "next";

interface CampaignPageProps {
  params: {
    source: string;
    campaign: string;
  };
}

export async function generateMetadata({
  params,
}: CampaignPageProps): Promise<Metadata> {
  const source = decodeURIComponent(params.source);
  const campaign = decodeURIComponent(params.campaign);
  
  return {
    title: `${campaign} (${source}) - Kampagnen - simpalo`,
  };
}

export default function CampaignDetailPage({ params }: CampaignPageProps) {
  const source = decodeURIComponent(params.source);
  const campaign = decodeURIComponent(params.campaign);

  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F7FAFC" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <CampaignDetailView source={source} campaign={campaign} />
        </main>
      </div>
    </div>
  );
}
