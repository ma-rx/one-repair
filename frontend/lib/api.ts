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

  // District Managers
  listDistrictManagers: (orgId?: string) =>
    request<DistrictManager[]>(`/district-managers/${orgId ? `?organization=${orgId}` : ""}`),
  createDistrictManager: (body: Partial<DistrictManager>) =>
    request<DistrictManager>("/district-managers/", { method: "POST", body: JSON.stringify(body) }),
  updateDistrictManager: (id: string, body: Partial<DistrictManager>) =>
    request<DistrictManager>(`/district-managers/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDistrictManager: (id: string) =>
    request<void>(`/district-managers/${id}/`, { method: "DELETE" }),

  // Assets
  getAsset:   (id: string) => request<Asset>(`/assets/${id}/`),
  listAssets: (params?: { store?: string; category?: string; status?: string; active?: boolean; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.store)    qs.set("store", params.store);
    if (params?.category) qs.set("category", params.category);
    if (params?.status)   qs.set("status", params.status);
    if (params?.active)   qs.set("active", "true");
    if (params?.page && params.page > 1) qs.set("page", String(params.page));
    const q = qs.toString();
    return request<{ count: number; next: string | null; previous: string | null; results: Asset[] }>(`/assets/${q ? `?${q}` : ""}`);
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
  updateUser: (id: number, body: Partial<CreateUserBody>) =>
    request<OrgUser>(`/users/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),

  // Tickets
  createTicket: (body: CreateTicketBody) =>
    request<Ticket>("/tickets/", { method: "POST", body: JSON.stringify(body) }),
  listTickets: (ticketStatus?: string) =>
    request<Ticket[]>(`/tickets/${ticketStatus ? `?status=${ticketStatus}` : ""}`),
  getTicket: (id: string) =>
    request<Ticket>(`/tickets/${id}/`),
  patchTicketPriority: (id: string, priority: string) =>
    request<Ticket>(`/tickets/${id}/`, { method: "PATCH", body: JSON.stringify({ priority }) }),
  assignTech: (id: string, tech_id: number, scheduled_date?: string) =>
    request<Ticket>(`/tickets/${id}/assign/`, {
      method: "PATCH",
      body: JSON.stringify({ tech_id, scheduled_date }),
    }),
  listTicketsByDate: (date: string) =>
    request<Ticket[]>(`/tickets/?date=${date}`),
  listTicketsByTechAndDate: (techId: number | string, date: string) =>
    request<Ticket[]>(`/tickets/?tech=${techId}&date=${date}`),
  setRouteOrder: (ticketIds: string[]) =>
    request<{ detail: string }>("/tickets/set-route-order/", {
      method: "POST",
      body: JSON.stringify({ ticket_ids: ticketIds }),
    }),
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

  saveProgress: (ticketId: string, data: {
    resolution_code?: string;
    labor_cost?: number | null;
    parts_used?: Array<{ part_id: string; quantity: number }>;
    parts_needed?: PartRequestInput[];
    tech_notes?: string;
    formatted_report?: string;
    manager_on_site?: string;
    manager_signature?: string;
  }) =>
    request<ServiceReport>(`/tickets/${ticketId}/save-progress/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  markComplete: (ticketId: string) =>
    request<Ticket>(`/tickets/${ticketId}/mark-complete/`, {
      method: "POST",
    }),

  generateInvoice: (ticketId: string, data: {
    resolution_code?: string;
    labor_cost?: number | null;
    tax_rate?: number | null;
    parts_used?: Array<{ part_id: string; quantity: number }>;
    invoice_email?: string;
    tech_notes?: string;
    formatted_report?: string;
  }) =>
    request<ServiceReport>(`/tickets/${ticketId}/generate-invoice/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateServiceReport: (id: string, data: Partial<ServiceReport & { draft_parts: Array<{ part_id: string; quantity: number }> }>) =>
    request<ServiceReport>(`/service-reports/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // KPIs
  getKPIs: () => request<KPIData>("/kpis/"),

  // Invoices
  listInvoices: () => request<ServiceReport[]>("/service-reports/"),
  listAllInvoices: (params?: { invoice_sent?: boolean; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.invoice_sent !== undefined) q.set("invoice_sent", String(params.invoice_sent));
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return request<ServiceReport[]>(`/service-reports/${qs ? `?${qs}` : ""}`);
  },
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

  // Pricing config / ORS Settings
  getPricing: () => request<PricingConfig>("/pricing/"),
  updatePricing: (body: Partial<PricingConfig>) =>
    request<PricingConfig>("/pricing/", { method: "PATCH", body: JSON.stringify(body) }),

  // Invoice
  sendInvoice: (ticketId: string, extraEmails: string[] = [], overrides?: {
    trip_charge?: string;
    labor_cost?: string;
    tax_rate?: string;
    formatted_report?: string;
    extra_line_items?: Array<{ name: string; sku?: string; quantity: number; unit_price: number }>;
    parts_used?: Array<{ id: string; quantity: number; unit_price: number }>;
    new_inventory_parts?: Array<{ part_id: string; quantity: number; unit_price: number }>;
  }) =>
    request<{ sent_to: string[]; payment_url: string; ticket: Ticket }>(
      `/tickets/${ticketId}/send-invoice/`,
      { method: "POST", body: JSON.stringify({ extra_emails: extraEmails, overrides: overrides ?? {} }) },
    ),

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

  // Parts Approvals (new grouped model)
  listPartsApprovals: (params?: { status?: string; ticket?: string }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as string[][]).toString() : "";
    return request<PartsApproval[]>(`/parts-approvals/${qs}`);
  },
  getPartsApproval: (id: string) => request<PartsApproval>(`/parts-approvals/${id}/`),
  approvePartsORS: (id: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/approve-ors/`, { method: "POST" }),
  sendPartsToClient: (id: string, notes_for_client?: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/send-to-client/`, {
      method: "POST",
      body: JSON.stringify({ notes_for_client: notes_for_client ?? "" }),
    }),
  approvePartsClient: (id: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/approve-client/`, { method: "POST" }),
  denyParts: (id: string, denied_reason: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/deny/`, {
      method: "POST",
      body: JSON.stringify({ denied_reason }),
    }),
  resubmitParts: (id: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/resubmit/`, { method: "POST" }),
  markPartsOrdered: (id: string, tracking_number: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/mark-ordered/`, {
      method: "POST",
      body: JSON.stringify({ tracking_number }),
    }),
  markPartsDelivered: (id: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/mark-delivered/`, { method: "POST" }),
  generatePartsFollowup: (id: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/generate-followup/`, { method: "POST" }),
  addPartToApproval: (id: string, data: Record<string, unknown>) =>
    request<PartsApproval>(`/parts-approvals/${id}/add-part/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removePartFromApproval: (id: string, partRequestId: string) =>
    request<PartsApproval>(`/parts-approvals/${id}/remove-part/${partRequestId}/`, { method: "DELETE" }),
  updatePartInApproval: (id: string, partRequestId: string, data: Record<string, unknown>) =>
    request<PartsApproval>(`/parts-approvals/${id}/update-part/${partRequestId}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

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

  // Historical Import
  suggestCodes: async (rows: Array<{
    make: string;
    model_number: string;
    asset_category: string;
    symptom_description: string;
    resolution_description: string;
  }>): Promise<{ results: Array<{
    row_index: number;
    symptom_code: string;
    symptom_is_new: boolean;
    symptom_label: string;
    symptom_make: string;
    symptom_asset_category: string;
    resolution_code: string;
    resolution_is_new: boolean;
    resolution_label: string;
    resolution_make: string;
    resolution_asset_category: string;
  }> }> => {
    return request("/import/suggest-codes/", { method: "POST", body: JSON.stringify({ rows }) });
  },

  bulkImportTickets: async (tickets: Array<Record<string, unknown>>): Promise<{ created: number; errors: string[] }> => {
    return request("/import/bulk-tickets/", { method: "POST", body: JSON.stringify({ tickets }) });
  },

  diagnosticSearch: (params: {
    description: string;
    asset_category?: string;
    make?: string;
    model_number?: string;
  }): Promise<DiagnosticSearchResult> =>
    request("/diagnostic-search/", { method: "POST", body: JSON.stringify(params) }),

  diagnosticChat: (
    messages: { role: "user" | "assistant"; content: string }[],
    context: { asset_name: string; asset_category: string; make: string; model_number: string; store_name: string }
  ): Promise<{ reply: string }> =>
    request("/diagnostic-chat/", { method: "POST", body: JSON.stringify({ messages, context }) }),

  // ORS Verified Answers
  listVerifiedAnswers: (params?: { asset_category?: string }) =>
    request<VerifiedAnswer[]>(`/verified-answers/${params?.asset_category ? `?asset_category=${params.asset_category}` : ""}`),
  createVerifiedAnswer: (body: Partial<VerifiedAnswer>) =>
    request<VerifiedAnswer>("/verified-answers/", { method: "POST", body: JSON.stringify(body) }),
  updateVerifiedAnswer: (id: string, body: Partial<VerifiedAnswer>) =>
    request<VerifiedAnswer>(`/verified-answers/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteVerifiedAnswer: (id: string) =>
    request<void>(`/verified-answers/${id}/`, { method: "DELETE" }),

  // Repair Documents
  listRepairDocuments: () => request<RepairDocument[]>("/repair-documents/"),
  bulkUploadDocuments: (documents: { title: string; make: string; content: string }[]) =>
    request<{ created: number }>("/repair-documents/bulk-upload/", {
      method: "POST",
      body: JSON.stringify({ documents }),
    }),
  deleteRepairDocument: (id: string) =>
    request<void>(`/repair-documents/${id}/`, { method: "DELETE" }),

  // Repair Images
  listRepairImages: (make?: string) =>
    request<RepairImage[]>(`/repair-images/${make ? `?make=${encodeURIComponent(make)}` : ""}`),
  uploadRepairImage: (formData: FormData) => {
    const token = getAccessToken();
    return fetch(`${BASE}/repair-images/upload/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed: ${res.status}`);
      }
      return res.json() as Promise<RepairImage>;
    });
  },
  updateRepairImage: (id: string, body: Partial<RepairImage>) =>
    request<RepairImage>(`/repair-images/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRepairImage: (id: string) =>
    request<void>(`/repair-images/${id}/`, { method: "DELETE" }),
  searchRepairImages: (q: string) =>
    request<RepairImage[]>(`/repair-images/search/?q=${encodeURIComponent(q)}`),

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
  code: string;
  nte_limit: string;
  payment_terms: string;
  invoice_emails: string[];
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

export interface DistrictManager {
  id: string;
  organization: string;
  name: string;
  phone: string;
  email: string;
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
  hours: string;
  manager: number | null;
  manager_name: string | null;
  district_manager: string | null;
  district_manager_name: string | null;
  district_manager_phone: string | null;
  district_manager_email: string | null;
  tax_rate: string | null;
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
  equipment_model_display: { id: string; make: string; model_number: string; model_name: string } | null;
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
  parts_approval: string | null;
  ticket: string;
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
  created_at: string;
  updated_at: string;
}

export interface PartsApprovalPartRequest {
  id: string;
  parts_approval: string | null;
  ticket: string;
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
  created_at: string;
  updated_at: string;
}

export interface PartsApprovalTicketDetail {
  id: string;
  ticket_number: string;
  store_name: string;
  asset_name: string;
  symptom_code: string;
  tech_notes: string;
  formatted_report: string;
  status: string;
}

export interface PartsApproval {
  id: string;
  ticket: string;
  ticket_detail: PartsApprovalTicketDetail;
  status: string;
  notes_for_client: string;
  denied_reason: string;
  tracking_number: string;
  followup_ticket: string | null;
  followup_ticket_number: string | null;
  total_selling_price: string;
  nte_limit: string;
  requires_client_approval: boolean;
  part_requests: PartsApprovalPartRequest[];
  sent_at: string | null;
  approved_at: string | null;
  denied_at: string | null;
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
  ticket_number: string;
  asset: string | null;
  asset_name: string;
  asset_description: string;
  asset_category: string;
  asset_make: string;
  asset_model_number: string;
  store: string | null;
  store_name: string;
  store_address: string;
  store_phone: string;
  store_hours: string;
  store_district_manager_name: string | null;
  store_district_manager_phone: string | null;
  symptom_code: string;
  description: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
  route_order: number | null;
  assigned_tech: number | null;
  assigned_tech_name: string | null;
  assets: TicketAsset[];
  needs_coding: boolean;
  parts_approval_status: string | null;
  has_service_report: boolean;
  total_labor_minutes: number;
  completed_at: string | null;
  service_reports: ServiceReport[];
  org_invoice_emails: string[];
  default_tax_rate: string;
  created_at: string;
}

export interface ServiceReport {
  id: string;
  ticket: string;
  ticket_status: string | null;
  ticket_number: string | null;
  org_name: string | null;
  store_name: string | null;
  asset_name: string | null;
  resolution_code: string;
  trip_charge: string;
  labor_cost: string;
  tech_notes: string;
  formatted_report: string;
  manager_on_site: string;
  manager_signature: string;
  invoice_email: string;
  draft_parts: Array<{ part_id: string; quantity: number; part_name?: string; part_sku?: string; unit_price?: string }>;
  extra_line_items: Array<{ name: string; sku?: string; quantity: number; unit_price: number }>;
  tax_rate: string;
  sales_tax: string;
  parts_total: string;
  grand_total: string;
  invoice_sent: boolean;
  stripe_session_id: string;
  stripe_payment_url: string;
  parts_used: PartUsed[];
  created_at: string;
}

export interface PartUsed {
  id: string;
  part: string;
  part_name: string;
  part_sku: string;
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
  tax_rate: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  logo_url: string;
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

export interface DiagnosticStep {
  action: string;
  finding: string;
  next_action: string;
}

export interface KnowledgeEntry {
  id: string;
  equipment_model: string | null;
  equipment_model_display: { id: string; make: string; model_number: string; model_name: string } | null;
  asset_category: string;
  make: string;
  model_number: string;
  symptom_code: string;
  symptom_description: string;
  diagnostic_steps: DiagnosticStep[];
  difficulty: string;
  cause_summary: string;
  parts_commonly_used: string;
  pro_tips: string;
  contributed_by: number | null;
  contributed_by_name: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticTicketResult {
  id: string;
  asset_description: string;
  description: string;
  resolution_code: string;
  tech_notes: string;
  parts_used: { name: string; sku: string }[];
  similarity: number;
  closed_at: string | null;
}

export interface DiagnosticKnowledgeResult {
  id: string;
  make: string;
  model_number: string;
  asset_category: string;
  cause_summary: string;
  procedure: string;
  parts_commonly_used: string;
  pro_tips: string;
  difficulty: string;
  is_verified: boolean;
  similarity: number;
}

export interface DiagnosisPart {
  name: string;
  sku: string;
  reason: string;
}

export interface Diagnosis {
  likely_cause: string;
  recommended_steps: string[];
  parts_to_order: DiagnosisPart[];
  confidence: "low" | "medium" | "high";
  difficulty: string;
  caution: string | null;
}

export interface DiagnosticSearchResult {
  diagnosis: Diagnosis | null;
  tickets: DiagnosticTicketResult[];
  knowledge: DiagnosticKnowledgeResult[];
}

export interface VerifiedAnswer {
  id: string;
  question: string;
  answer: string;
  make: string;
  asset_category: string;
  aliases: string[];
  created_by: number | null;
  created_by_name: string | null;
  is_embedded: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepairDocument {
  id: string;
  title: string;
  make: string;
  content: string;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  is_embedded: boolean;
  created_at: string;
}

export interface RepairImage {
  id: string;
  title: string;
  url: string;
  tags: string[];
  make: string;
  asset_category: string;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  created_at: string;
}

