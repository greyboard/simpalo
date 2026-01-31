import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export interface LeadFilters {
  status?: string;
  category?: string;
  city?: string;
  minRating?: number;
  hasWebsite?: boolean;
  hasBadReviews?: boolean;
  hasPoorProfile?: boolean;
  source?: string;
  type?: string; // "COMPANY" or "CONTACT"
  excludeSource?: string; // Deprecated: Use type instead
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchLeads<T = any>(filters?: LeadFilters): Promise<PaginatedResponse<T>> {
  const { data } = await api.get("/leads", { params: filters });
  return data;
}

export async function fetchLead(id: string) {
  const { data } = await api.get(`/leads/${id}`);
  return data;
}

export async function createLead(leadData: any) {
  const { data } = await api.post("/leads", leadData);
  return data;
}

export async function updateLead(id: string, leadData: any) {
  const { data } = await api.put(`/leads/${id}`, leadData);
  return data;
}

export async function deleteLead(id: string) {
  const { data } = await api.delete(`/leads/${id}`);
  return data;
}

export async function fetchCompanies() {
  const { data } = await api.get("/companies");
  return data;
}

export async function fetchDashboardStats() {
  const { data } = await api.get("/leads/stats");
  return data;
}

export interface SearchResult {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type: string;
  source?: string | null;
  company: {
    id: string;
    name: string;
    businessName?: string | null;
    city?: string | null;
    address?: string | null;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    color?: string | null;
  }>;
}

export interface SearchResponse {
  results: SearchResult[];
  count: number;
}

/**
 * Sucht nach Leads/Kontakten und Unternehmen
 * @param query - Suchbegriff (mindestens 2 Zeichen)
 */
export async function searchLeads(query: string): Promise<SearchResponse> {
  if (!query || query.trim().length < 2) {
    return { results: [], count: 0 };
  }
  const { data } = await api.get("/leads/search", {
    params: { q: query.trim() },
  });
  return data;
}

export async function searchGoogleBusiness(query: string, filters?: any) {
  const { data } = await api.post("/leads/search-google", { query, filters });
  return data;
}

export async function importLeadFromPlace(placeId: string) {
  const { data } = await api.post("/leads/import-place", { placeId });
  return data;
}

export async function createNote(leadId: string, content: string) {
  const { data } = await api.post(`/leads/${leadId}/notes`, { content });
  return data;
}

export async function deleteNote(leadId: string, noteId: string) {
  const { data } = await api.delete(`/leads/${leadId}/notes/${noteId}`);
  return data;
}

export async function fetchRecentNotes(limit: number = 10) {
  const { data } = await api.get("/notes/recent", { params: { limit } });
  return data;
}

export async function fetchRecentReviews(limit: number = 10) {
  const { data } = await api.get("/reviews/recent", { params: { limit } });
  return data;
}

export async function fetchTags() {
  const { data } = await api.get("/tags");
  return data;
}

export async function createTag(name: string, color?: string) {
  const { data } = await api.post("/tags", { name, color });
  return data;
}

export async function addTagToLead(leadId: string, tagId?: string, tagName?: string) {
  const { data } = await api.post(`/leads/${leadId}/tags`, { tagId, tagName });
  return data;
}

export async function removeTagFromLead(leadId: string, tagId: string) {
  const { data } = await api.delete(`/leads/${leadId}/tags/${tagId}`);
  return data;
}

// Webhook API Functions
export async function fetchWebhooks() {
  const { data } = await api.get("/webhooks");
  return data;
}

export async function fetchWebhook(id: string) {
  const { data } = await api.get(`/webhooks/${id}`);
  return data;
}

export async function createWebhook(webhookData: {
  name: string;
  source: string;
  url?: string;
  settings?: any;
}) {
  const { data } = await api.post("/webhooks", webhookData);
  return data;
}

export async function updateWebhook(id: string, webhookData: {
  name?: string;
  source?: string;
  url?: string;
  isActive?: boolean;
  settings?: any;
}) {
  const { data } = await api.put(`/webhooks/${id}`, webhookData);
  return data;
}

export async function deleteWebhook(id: string) {
  const { data } = await api.delete(`/webhooks/${id}`);
  return data;
}

export async function testWebhook(id: string, testPayload: any) {
  const { data } = await api.post(`/webhooks/${id}/test`, { testPayload });
  return data;
}

export async function getRecentWebhookRequests(webhookId: string) {
  const { data } = await api.get(`/webhooks/${webhookId}/recent-requests`);
  return data;
}

export async function testIncomingWebhook(webhookId: string, payload: any) {
  const { data } = await api.post(`/webhooks/incoming/${webhookId}`, payload);
  return data;
}

/**
 * Markiert alle nicht kontaktierten Kontakte (type: CONTACT, status: NEW) als kontaktiert
 */
export async function bulkMarkAsContacted() {
  const { data } = await api.post("/leads/bulk-mark-contacted");
  return data;
}
