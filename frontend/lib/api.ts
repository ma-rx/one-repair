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

  // Organizations
  listOrganizations: () => request<Organization[]>("/organizations/"),
  createOrganization: (body: Partial<Organization>) =>
    request<Organization>("/organizations/", { method: "POST", body: JSON.stringify(body) }),
  updateOrganization: (id: string, body: Partial<Organization>) =>
    request<Organization>(`/organizations/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),

  // Stores
  listStores: (orgId?: string) =>
    request<Store[]>(`/stores/${orgId ? `?organization=${orgId}` : ""}`),
  createStore: (body: Partial<Store>) =>
    request<Store>("/stores/", { method: "POST", body: JSON.stringify(body) }),
  updateStore: (id: string, body: Partial<Store>) =>
    request<Store>(`/stores/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),

  // Assets
  getAsset:   (id: string) => request<Asset>(`/assets/${id}/`),
  listAssets: (params?: { store?: string; active?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.store)  qs.set("store", params.store);
    if (params?.active) qs.set("active", "true");
    const q = qs.toString();
    return request<Asset[]>(`/assets/${q ? `?${q}` : ""}`);
  },
  createAsset: (body: Partial<Asset>) =>
    request<Asset>("/assets/", { method: "POST", body: JSON.stringify(body) }),
  updateAsset: (id: string, body: Partial<Asset>) =>
    request<Asset>(`/assets/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),

  // Parts
  listParts: (assetCategory?: string) =>
    request<Part[]>(`/parts/${assetCategory ? `?asset_category=${assetCategory}` : ""}`),

  // Users
  listTechs: () => request<AppUser[]>("/users/?role=TECH"),
  listUsers: (role?: string) =>
    request<OrgUser[]>(`/users/${role ? `?role=${role}` : ""}`),
  createUser: (body: CreateUserBody) =>
    request<OrgUser>("/users/", { method: "POST", body: JSON.stringify(body) }),
  toggleUserActive: (id: number) =>
    request<OrgUser>(`/users/${id}/deactivate/`, { method: "PATCH" }),

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

  // KPIs
  getKPIs: () => request<KPIData>("/kpis/"),

  // Invoices
  listInvoices: () => request<ServiceReport[]>("/service-reports/"),
  downloadInvoicePDF: async (id: string) => {
    const token = getAccessToken();
    const res = await fetch(`${BASE}/invoices/${id}/pdf/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed.");
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `invoice-${id.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Parts CRUD (ORS Admin)
  createPart: (body: Partial<Part>) =>
    request<Part>("/parts/", { method: "POST", body: JSON.stringify(body) }),
  updatePart: (id: string, body: Partial<Part>) =>
    request<Part>(`/parts/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  plan: string;
  is_active: boolean;
  store_count: number;
  created_at: string;
}

export interface Store {
  id: string;
  name: string;
  organization: string;
  organization_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  manager: number | null;
  manager_name: string | null;
  is_active: boolean;
  asset_count: number;
  created_at: string;
}

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "ORS_ADMIN" | "CLIENT_ADMIN" | "CLIENT_MANAGER" | "TECH";
  organization: { id: string; name: string } | null;
  store: { id: string; name: string } | null;
}

export interface AppUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export interface OrgUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  organization: { id: string; name: string } | null;
  store: { id: string; name: string } | null;
}

export interface CreateUserBody {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: string;
  organization?: string;
  store?: string;
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
  install_date: string | null;
  warranty_expiry: string | null;
  is_active: boolean;
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  category: string;
  asset_category: string;
  make: string;
  model_number: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
  unit_price: string;
  is_low_stock: boolean;
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

export interface KPIData {
  tickets: {
    total: number;
    OPEN: number;
    IN_PROGRESS: number;
    PENDING_PARTS: number;
    RESOLVED: number;
    CLOSED: number;
    CANCELLED: number;
  };
  avg_resolution_hours: number | null;
  total_revenue: number;
  low_stock_count: number;
  top_symptoms:    { symptom_code: string; count: number }[];
  top_resolutions: { resolution_code: string; count: number }[];
  top_assets:      { asset_name: string; store_name: string; count: number }[];
  monthly_trend:   { month: string; count: number }[];
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
