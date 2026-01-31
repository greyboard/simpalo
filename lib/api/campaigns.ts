import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface CampaignStats {
  campaigns: Campaign[];
  totalLeads: number;
  totalCampaigns: number;
  sources: string[];
}

export interface Campaign {
  source: string;
  sourceDisplay: string;
  campaign: string;
  medium: string | null;
  term: string | null;
  content: string | null;
  leadCount: number;
  firstLead: Date;
  lastLead: Date;
}

export async function fetchCampaignStats(): Promise<CampaignStats> {
  const { data } = await api.get("/campaigns/stats");
  return data;
}

export interface CampaignLeadsResponse {
  source: string;
  campaign: string;
  leads: any[];
  totalLeads: number;
}

export async function fetchCampaignLeads(
  source: string,
  campaign: string
): Promise<CampaignLeadsResponse> {
  const encodedSource = encodeURIComponent(source);
  const encodedCampaign = encodeURIComponent(campaign);
  const { data } = await api.get(
    `/campaigns/${encodedSource}/${encodedCampaign}/leads`
  );
  return data;
}

export interface CampaignTimelineResponse {
  period: "day" | "week" | "month";
  timeline: Array<{
    date: string;
    leads: number;
  }>;
  totalLeads: number;
}

export async function fetchCampaignTimeline(
  source: string,
  campaign: string,
  period: "day" | "week" | "month" = "day"
): Promise<CampaignTimelineResponse> {
  const encodedSource = encodeURIComponent(source);
  const encodedCampaign = encodeURIComponent(campaign);
  const { data } = await api.get(
    `/campaigns/${encodedSource}/${encodedCampaign}/timeline?period=${period}`
  );
  return data;
}
