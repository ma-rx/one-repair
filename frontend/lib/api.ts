import { getAccessToken, clearAuth } from "./auth";

const BASE     = "http://localhost:8000/api";
const AUTH_BASE = "http://localhost:8000/api/auth";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}${path}`, { headers, ...options });

  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetch(`${AUTH_BASE}/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed.");
      return data as { access: string; refresh: string; user: AuthUser };
    }),

  me: () => request<AuthUser>("/auth/me/"),

  // Assets
  getAsset:   (id: string)    => request<Asset>(`/assets/${id}/`),
  listAssets: (storeId?: string) =>
    request<Asset[]>(`/assets/${storeId ? `?store=${storeId}` : ""}`),

  // Parts
  listParts: (assetCategory?: string) =>
    request<Part[]>(`/parts/${assetCategory ? `?asset_category=${assetCategory}` : ""}`),

  // Users
  listTechs: () => request<AppUser[]>("/users/?role=TECH"),

  // Tickets
  createTicket: (body: CreateTicketBody) =>
    request<Ticket>("/tickets/", { method: "POST", body: JSON.stringify(body) }),
  listTickets: (ticketStatus?: string) =>
    request<Ticket[]>(`/tickets/${ticketStatus ? `?status=${ticketStatus}` : ""}`),
  getTicket: (id: string) =>
    request<Ticket>(`/tickets/${id}/`),
  assignTech: (id: string, tech_id: number) =>
    request<Ticket>(`/tickets/${id}/assign/`, {
      method: "PATCH",
      body: JSON.stringify({ tech_id }),
    }),
  closeTicket: (id: string, body: CloseTicketBody) =>
    request<ServiceReport>(`/tickets/${id}/close/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "ORS_ADMIN" | "CLIENT_ADMIN" | "CLIENT_MANAGER" | "TECH";
  organization: { id: string; name: string } | null;
}

export interface AppUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  make: string;
  serial_number: string;
  model_number: string;
  status: string;
  store: string;
  store_name: string;
  organization_name: string;
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  asset_category: string;
  quantity_on_hand: number;
  unit_price: string;
}

export interface Ticket {
  id: string;
  asset: string;
  asset_name: string;
  store_name: string;
  symptom_code: string;
  priority: string;
  status: string;
  assigned_tech: number | null;
  assigned_tech_name: string | null;
  service_reports: ServiceReport[];
  created_at: string;
}

export interface ServiceReport {
  id: string;
  ticket: string;
  resolution_code: string;
  labor_cost: string;
  parts_total: string;
  grand_total: string;
  invoice_sent: boolean;
  parts_used: PartUsed[];
}

export interface PartUsed {
  id: string;
  part: string;
  part_name: string;
  quantity: number;
  unit_price_at_time: string;
  line_total: string;
}

export interface CreateTicketBody {
  asset: string;
  symptom_code: string;
  priority?: string;
  opened_by?: number;
}

export interface CloseTicketBody {
  resolution_code: string;
  labor_cost: number;
  parts_used: { part_id: string; quantity: number }[];
  invoice_email?: string;
}
