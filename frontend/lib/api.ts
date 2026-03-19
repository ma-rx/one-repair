import { getAccessToken, clearAuth } from "./auth";

const BASE      = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const AUTH_BASE = `${BASE}/auth`;

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

  if (res.status === 204) return undefined as T;
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
  listParts: (params?: { assetCategory?: string; make?: string; compatibleModel?: string }) => {
    const qs = new URLSearchParams();
    if (params?.assetCategory)    qs.set("asset_category",   params.assetCategory);
    if (params?.make)             qs.set("make",              params.make);
    if (params?.compatibleModel)  qs.set("compatible_model", params.compatibleModel);
    const q = qs.toString();
    return request<Part[]>(`/parts/${q ? `?${q}` : ""}`);
  },

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
  assignTech: (id: string, tech_id: number, scheduled_date?: string) =>
    request<Ticket>(`/tickets/${id}/assign/`, {
      method: "PATCH",
      body: JSON.stringify({ tech_id, scheduled_date }),
    }),
  listTicketsByDate: (date: string) =>
    request<Ticket[]>(`/tickets/?date=${date}`),
  listTicketsByMonth: (month: string) =>
    request<Ticket[]>(`/tickets/?month=${month}`),
  rescheduleTicket: (id: string, scheduled_date: string) =>
    request<Ticket>(`/tickets/${id}/reschedule/`, {
      method: "PATCH",
      body: JSON.stringify({ scheduled_date }),
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

  // Pricing config
  getPricing: () => request<PricingConfig>("/pricing/"),
  updatePricing: (body: Partial<PricingConfig>) =>
    request<PricingConfig>("/pricing/", { method: "PATCH", body: JSON.stringify(body) }),

  // Time tracking
  getTimeEntry: (ticketId: string) =>
    request<TimeEntryStatus>(`/time-entries/?ticket_id=${ticketId}`),
  clockIn: (ticketId: string) =>
    request<TimeEntry>("/time-entries/", { method: "POST", body: JSON.stringify({ action: "clock_in", ticket_id: ticketId }) }),
  clockOut: (ticketId: string) =>
    request<TimeEntry>("/time-entries/", { method: "POST", body: JSON.stringify({ action: "clock_out", ticket_id: ticketId }) }),

  // Work images
  getWorkImages: (ticketId: string) =>
    request<WorkImage[]>(`/work-images/?ticket_id=${ticketId}`),
  uploadWorkImage: async (ticketId: string, file: File): Promise<WorkImage> => {
    const token = getAccessToken();
    const form = new FormData();
    form.append("ticket_id", ticketId);
    form.append("image", file);
    const res = await fetch(`${BASE}/work-images/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Upload failed"); }
    return res.json();
  },
  deleteWorkImage: (id: string) =>
    request<void>(`/work-images/${id}/`, { method: "DELETE" }),

  // AI report formatting
  formatReport: (notes: string) =>
    request<{ formatted_report: string }>("/format-report/", { method: "POST", body: JSON.stringify({ notes }) }),

  // Client KPIs
  getClientKPIs: (params?: { timeframe?: string; store?: string }) => {
    const qs = new URLSearchParams();
    if (params?.timeframe) qs.set("timeframe", params.timeframe);
    if (params?.store) qs.set("store", params.store);
    const q = qs.toString();
    return request<ClientKPIData>(`/client-kpis/${q ? `?${q}` : ""}`);
  },

  // Parts CRUD (ORS Admin)
  createPart: (body: Partial<Part> & { compatible_model_ids?: string[] }) =>
    request<Part>("/parts/", { method: "POST", body: JSON.stringify(body) }),
  updatePart: (id: string, body: Partial<Part> & { compatible_model_ids?: string[] }) =>
    request<Part>(`/parts/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),

  // TicketAsset management
  addTicketAsset: (ticketId: string, data: { asset_id?: string; asset_description?: string }) =>
    request<TicketAsset>(`/tickets/${ticketId}/add-asset/`, { method: "POST", body: JSON.stringify(data) }),
  removeTicketAsset: (ticketId: string, taId: string) =>
    request<void>(`/tickets/${ticketId}/remove-asset/${taId}/`, { method: "DELETE" }),
  updateAssetCodes: (ticketId: string, taId: string, data: { symptom_code?: string; resolution_code?: string }) =>
    request<TicketAsset>(`/tickets/${ticketId}/update-asset/${taId}/`, { method: "PATCH", body: JSON.stringify(data) }),

  // PartRequest
  listPartRequests: (params?: { ticket?: string; status?: string }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as string[][]).toString() : "";
    return request<PartRequest[]>(`/part-requests/${qs}`);
  },
  createPartRequest: (data: Partial<PartRequest>) =>
    request<PartRequest>("/part-requests/", { method: "POST", body: JSON.stringify(data) }),
  approvePartRequestORS: (id: string) =>
    request<PartRequest>(`/part-requests/${id}/approve-ors/`, { method: "POST" }),
  sendPartRequestToClient: (id: string) =>
    request<PartRequest>(`/part-requests/${id}/send-to-client/`, { method: "POST" }),
  approvePartRequestClient: (id: string) =>
    request<PartRequest>(`/part-requests/${id}/approve-client/`, { method: "POST" }),
  denyPartRequest: (id: string) =>
    request<PartRequest>(`/part-requests/${id}/deny/`, { method: "POST" }),
  markPartRequestOrdered: (id: string, tracking_number: string) =>
    request<PartRequest>(`/part-requests/${id}/mark-ordered/`, { method: "POST", body: JSON.stringify({ tracking_number }) }),
  markPartRequestDelivered: (id: string) =>
    request<PartRequest>(`/part-requests/${id}/mark-delivered/`, { method: "POST" }),
  generateFollowupTicket: (id: string) =>
    request<Ticket>(`/part-requests/${id}/generate-followup/`, { method: "POST" }),
  updatePartRequestDetails: (id: string, data: Record<string, unknown>) =>
    request<PartRequest>(`/part-requests/${id}/update-part-details/`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteTicket: (id: string) =>
    request<void>(`/tickets/${id}/`, { method: "DELETE" }),

  // Symptom & Resolution Codes
  listSymptomCodes: (params?: { make?: string; asset_category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.make) qs.set("make", params.make);
    if (params?.asset_category) qs.set("asset_category", params.asset_category);
    const q = qs.toString();
    return request<SymptomCodeEntry[]>(`/symptom-codes/${q ? `?${q}` : ""}`);
  },
  createSymptomCode: (body: Partial<SymptomCodeEntry>) =>
    request<SymptomCodeEntry>("/symptom-codes/", { method: "POST", body: JSON.stringify(body) }),
  updateSymptomCode: (id: string, body: Partial<SymptomCodeEntry>) =>
    request<SymptomCodeEntry>(`/symptom-codes/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSymptomCode: (id: string) =>
    request<void>(`/symptom-codes/${id}/`, { method: "DELETE" }),

  listResolutionCodes: (params?: { make?: string; asset_category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.make) qs.set("make", params.make);
    if (params?.asset_category) qs.set("asset_category", params.asset_category);
    const q = qs.toString();
    return request<ResolutionCodeEntry[]>(`/resolution-codes/${q ? `?${q}` : ""}`);
  },
  createResolutionCode: (body: Partial<ResolutionCodeEntry>) =>
    request<ResolutionCodeEntry>("/resolution-codes/", { method: "POST", body: JSON.stringify(body) }),
  updateResolutionCode: (id: string, body: Partial<ResolutionCodeEntry>) =>
    request<ResolutionCodeEntry>(`/resolution-codes/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteResolutionCode: (id: string) =>
    request<void>(`/resolution-codes/${id}/`, { method: "DELETE" }),
  // Equipment Models
  listEquipmentModels: (category?: string) =>
    request<EquipmentModel[]>(`/equipment-models/${category ? `?category=${category}` : ""}`),
  getEquipmentModel: (id: string) => request<EquipmentModel>(`/equipment-models/${id}/`),
  createEquipmentModel: (body: Partial<EquipmentModel>) =>
    request<EquipmentModel>("/equipment-models/", { method: "POST", body: JSON.stringify(body) }),
  updateEquipmentModel: (id: string, body: Partial<EquipmentModel>) =>
    request<EquipmentModel>(`/equipment-models/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEquipmentModel: (id: string) =>
    request<void>(`/equipment-models/${id}/`, { method: "DELETE" }),

  deleteAsset: (id: string) =>
    request<void>(`/assets/${id}/`, { method: "DELETE" }),
  deletePart: (id: string) =>
    request<void>(`/parts/${id}/`, { method: "DELETE" }),

  // Knowledge Base
  listKnowledgeEntries: (params?: { asset_category?: string; symptom_code?: string; resolution_code?: string; verified?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.asset_category)  q.set("asset_category",  params.asset_category);
    if (params?.symptom_code)    q.set("symptom_code",    params.symptom_code);
    if (params?.resolution_code) q.set("resolution_code", params.resolution_code);
    if (params?.verified)        q.set("verified",        "true");
    return request<KnowledgeEntry[]>(`/knowledge/${q.toString() ? `?${q}` : ""}`);
  },
  createKnowledgeEntry: (body: Partial<KnowledgeEntry>) =>
    request<KnowledgeEntry>("/knowledge/", { method: "POST", body: JSON.stringify(body) }),
  updateKnowledgeEntry: (id: string, body: Partial<KnowledgeEntry>) =>
    request<KnowledgeEntry>(`/knowledge/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  verifyKnowledgeEntry: (id: string) =>
    request<KnowledgeEntry>(`/knowledge/${id}/verify/`, { method: "POST" }),
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

export interface EquipmentModel {
  id: string;
  make: string;
  model_number: string;
  model_name: string;
  category: string;
  description: string;
  instance_count: number;
  created_at: string;
  updated_at: string;
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
  email: string;
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
  equipment_model: string | null;
  equipment_model_display: { id: string; make: string; model_number: string } | null;
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  asset_category: string;
  make: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
  unit_price: string;
  selling_price: string;
  vendor: string;
  compatible_models_display: { id: string; make: string; model_number: string; model_name: string }[];
  is_low_stock: boolean;
}

export interface TicketAsset {
  id: string;
  asset: string | null;
  asset_name: string;
  asset_description: string;
  symptom_code: string;
  resolution_code: string;
  created_at: string;
}

export interface PartRequest {
  id: string;
  ticket: string;
  ticket_summary: {
    id: string;
    store_name: string;
    asset_name: string;
    status: string;
  };
  part: string | null;
  part_name_display: string;
  part_name: string;
  sku: string;
  asset_category: string;
  make: string;
  model_number: string;
  vendor: string;
  cost_price: string | null;
  selling_price: string | null;
  quantity_needed: number;
  urgency: string;
  notes: string;
  status: string;
  tracking_number: string;
  approved_by_ors_at: string | null;
  approved_by_client_at: string | null;
  ordered_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartRequestInput {
  part_id?: string;
  part_name?: string;
  sku?: string;
  asset_category?: string;
  make?: string;
  model_number?: string;
  vendor?: string;
  cost_price?: string;
  selling_price?: string;
  quantity_needed: number;
  urgency: string;
  notes?: string;
}

export interface Ticket {
  id: string;
  asset: string | null;
  asset_name: string;
  asset_description: string;
  store: string | null;
  store_name: string;
  store_address: string;
  symptom_code: string;
  description: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
  assigned_tech: number | null;
  assigned_tech_name: string | null;
  assets: TicketAsset[];
  needs_coding: boolean;
  service_reports: ServiceReport[];
  created_at: string;
}

export interface ServiceReport {
  id: string;
  ticket: string;
  resolution_code: string;
  tech_notes: string;
  formatted_report: string;
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

export interface PricingConfig {
  id: string;
  trip_charge: string;
  hourly_rate: string;
  min_hours: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  ticket: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  total_minutes: number | null;
  created_at: string;
}

export interface TimeEntryStatus {
  active_entry: TimeEntry | null;
  total_minutes: number;
  is_clocked_in: boolean;
  estimated_labor: number;
  pricing: PricingConfig;
}

export interface WorkImage {
  id: string;
  ticket: string;
  url: string;
  created_at: string;
}

export interface ClientKPIData {
  total_spend: number;
  total_repairs: number;
  avg_resolution_hours: number | null;
  tickets: {
    total: number;
    OPEN: number;
    IN_PROGRESS: number;
    PENDING_PARTS: number;
    RESOLVED: number;
    CLOSED: number;
    CANCELLED: number;
  };
  by_store: { store_id: string; store_name: string; count: number; spend: number }[];
  by_category: { category: string; count: number }[];
  monthly_trend: { month: string; count: number }[];
}

export interface CreateTicketBody {
  asset?: string;
  asset_description?: string;
  store?: string;
  description?: string;
  symptom_code?: string;
  priority?: string;
  opened_by?: number;
}

export interface CloseTicketBody {
  resolution_code: string;
  labor_cost?: number | null;
  parts_used: { part_id: string; quantity: number }[];
  parts_needed?: PartRequestInput[];
  invoice_email?: string;
  tech_notes?: string;
  formatted_report?: string;
}

export interface SymptomCodeEntry {
  id: string;
  code: string;
  label: string;
  make: string;
  asset_category: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ResolutionCodeEntry {
  id: string;
  code: string;
  label: string;
  make: string;
  asset_category: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntry {
  id: string;
  equipment_model: string | null;
  equipment_model_display: { id: string; make: string; model_number: string } | null;
  asset_category: string;
  make: string;
  model_number: string;
  symptom_code: string;
  resolution_code: string;
  difficulty: string;
  cause_summary: string;
  procedure: string;
  parts_commonly_used: string;
  pro_tips: string;
  contributed_by: number | null;
  contributed_by_name: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}
