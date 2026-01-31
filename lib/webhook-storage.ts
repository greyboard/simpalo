/**
 * In-Memory Storage für Webhook-Requests (für Monitoring)
 * Hinweis: Für Production sollte dies in der Datenbank gespeichert werden
 */
export interface WebhookRequestLog {
  id: string;
  webhookId: string;
  timestamp: Date;
  payload: any;
  success: boolean;
  error?: string;
  leadId?: string;
}

const webhookRequests = new Map<string, WebhookRequestLog[]>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function logWebhookRequest(
  webhookId: string,
  payload: any,
  success: boolean,
  error?: string,
  leadId?: string
) {
  if (!webhookRequests.has(webhookId)) {
    webhookRequests.set(webhookId, []);
  }
  
  const logs = webhookRequests.get(webhookId)!;
  logs.unshift({
    id: generateId(),
    webhookId,
    payload,
    success,
    error,
    leadId,
    timestamp: new Date(),
  });
  
  // Behalte nur die letzten 50 Logs pro Webhook
  if (logs.length > 50) {
    logs.splice(50);
  }
}

export function getWebhookRequests(webhookId: string): WebhookRequestLog[] {
  return webhookRequests.get(webhookId) || [];
}
