export interface AdminAccount {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  country: string;
  website: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }>;
  _count: {
    leads: number;
    users: number;
    webhooks: number;
    securityEvents: number;
    campaigns?: number;
    tags?: number;
    contactsCount?: number;
  };
}

export interface UpdateAccountData {
  isActive?: boolean;
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null;
  country?: string;
  website?: string | null;
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: "USER" | "ADMIN" | "OWNER" | "SUPERADMIN";
}

/**
 * Fetch all accounts (Superadmin only)
 */
export async function fetchAllAccounts(): Promise<AdminAccount[]> {
  const response = await fetch("/api/admin/accounts");
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Laden der Accounts");
  }
  
  return response.json();
}

/**
 * Fetch account details (Superadmin only)
 */
export async function fetchAccountDetails(id: string): Promise<AdminAccount> {
  const response = await fetch(`/api/admin/accounts/${id}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Laden des Accounts");
  }
  
  return response.json();
}

/**
 * Update account (Superadmin only)
 */
export async function updateAccount(
  id: string,
  data: UpdateAccountData
): Promise<AdminAccount> {
  const response = await fetch(`/api/admin/accounts/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Aktualisieren des Accounts");
  }
  
  return response.json();
}

/**
 * Fetch users for an account (Superadmin only)
 */
export async function fetchAccountUsers(accountId: string): Promise<AdminUser[]> {
  const response = await fetch(`/api/admin/accounts/${accountId}/users`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Laden der Benutzer");
  }
  
  return response.json();
}

/**
 * Create user for an account (Superadmin only)
 */
export async function createAccountUser(
  accountId: string,
  data: CreateUserData
): Promise<AdminUser> {
  const response = await fetch(`/api/admin/accounts/${accountId}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Erstellen des Benutzers");
  }
  
  return response.json();
}

export interface SecurityEvent {
  id: string;
  userId: string | null;
  accountId: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  description: string;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  account: {
    id: string;
    name: string;
  };
}

export interface SecurityEventsResponse {
  items: SecurityEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetch security events (Superadmin only)
 */
export async function fetchSecurityEvents(params?: {
  accountId?: string;
  eventType?: string;
  page?: number;
  pageSize?: number;
}): Promise<SecurityEventsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.accountId) {
    searchParams.append("accountId", params.accountId);
  }
  if (params?.eventType) {
    searchParams.append("eventType", params.eventType);
  }
  if (params?.page) {
    searchParams.append("page", params.page.toString());
  }
  if (params?.pageSize) {
    searchParams.append("pageSize", params.pageSize.toString());
  }

  const response = await fetch(`/api/admin/security-events?${searchParams.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Laden der Security Events");
  }
  
  return response.json();
}

export interface SecurityEventsCleanupStats {
  totalEvents: number;
  eventsToDelete: number;
  eventsToKeep: number;
  cutoffDate: string;
  daysToCheck: number;
  estimatedSize: {
    totalMB: string;
    toDeleteMB: string;
    toKeepMB: string;
  };
}

/**
 * Get cleanup statistics for security events
 */
export async function getSecurityEventsCleanupStats(days: number = 30): Promise<SecurityEventsCleanupStats> {
  const response = await fetch(`/api/admin/security-events/cleanup?days=${days}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Abrufen der Cleanup-Statistiken");
  }
  
  return response.json();
}

/**
 * Clean up old security events
 */
export async function cleanupSecurityEvents(days: number = 30): Promise<{ success: boolean; deleted: number; message: string }> {
  const response = await fetch(`/api/admin/security-events/cleanup?days=${days}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Löschen der Security Events");
  }
  
  return response.json();
}

/**
 * Delete account (Superadmin only)
 */
export async function deleteAccount(id: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/admin/accounts/${id}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Fehler beim Löschen des Accounts");
  }
  
  return response.json();
}
