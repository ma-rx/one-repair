"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, PartRequest } from "@/lib/api";
import { PartRequestStatusLabels, PartRequestUrgencyLabels } from "@/types/enums";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink,
  Loader2, Package, Truck,
} from "lucide-react";

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved (ORS)", value: "APPROVED_ORS" },
  { label: "Sent to Client", value: "SENT_TO_CLIENT" },
  { label: "Approved (Client)", value: "APPROVED_CLIENT" },
  { label: "Ordered", value: "ORDERED" },
  { label: "Delivered", value: "DELIVERED" },
];

const statusBadge: Record<string, string> = {
  PENDING:         "bg-amber-100 text-amber-700",
  APPROVED_ORS:    "bg-blue-100 text-blue-700",
  SENT_TO_CLIENT:  "bg-purple-100 text-purple-700",
  APPROVED_CLIENT: "bg-emerald-100 text-emerald-700",
  DENIED:          "bg-red-100 text-red-700",
  ORDERED:         "bg-cyan-100 text-cyan-700",
  DELIVERED:       "bg-green-100 text-green-700",
};

function EditDetailsModal({
  pr,
  onClose,
  onSave,
}: {
  pr: PartRequest;
  onClose: () => void;
  onSave: (updated: PartRequest) => void;
}) {
  const [fields, setFields] = useState({
    part_name: pr.part_name,
    sku: pr.sku,
    make: pr.make,
    model_number: pr.model_number,
    vendor: pr.vendor,
    cost_price: pr.cost_price ?? "",
    selling_price: pr.selling_price ?? "",
  });
  const [promote, setPromote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const updated = await api.updatePartRequestDetails(pr.id, { ...fields, promote_to_inventory: promote });
      onSave(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-slate-800 text-lg">Edit Part Details</h3>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="space-y-3">
          {(["part_name", "sku", "make", "model_number", "vendor"] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs text-slate-500 mb-1 capitalize">{field.replace("_", " ")}</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fields[field]}
                onChange={(e) => setFields((f) => ({ ...f, [field]: e.target.value }))}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cost Price</label>
              <input type="number" step="0.01"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fields.cost_price}
                onChange={(e) => setFields((f) => ({ ...f, cost_price: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Selling Price</label>
              <input type="number" step="0.01"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fields.selling_price}
                onChange={(e) => setFields((f) => ({ ...f, selling_price: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} className="rounded" />
            Also add to inventory
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function TrackingModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (tracking: string) => void;
}) {
  const [tracking, setTracking] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold text-slate-800">Mark as Ordered</h3>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Tracking Number (optional)</label>
          <input
            autoFocus
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 1Z999AA1..."
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
          <button onClick={() => onConfirm(tracking)}
            className="flex-1 bg-cyan-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-cyan-700">
            Confirm Order
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DispatchPartsPage() {
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingPr, setEditingPr] = useState<PartRequest | null>(null);
  const [orderingPr, setOrderingPr] = useState<PartRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    api.listPartRequests(activeTab ? { status: activeTab } : {})
      .then(setPartRequests)
      .catch(() => setError("Failed to load part requests."))
      .finally(() => setLoading(false));
  }, [activeTab]);

  function setLoaderFor(id: string, val: boolean) {
    setActionLoading((prev) => ({ ...prev, [id]: val }));
  }

  async function doAction(id: string, fn: () => Promise<PartRequest>) {
    setLoaderFor(id, true);
    try {
      const updated = await fn();
      setPartRequests((prev) => prev.map((p) => p.id === id ? updated : p));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoaderFor(id, false);
    }
  }

  async function handleGenerateFollowup(id: string) {
    setLoaderFor(id, true);
    try {
      await api.generateFollowupTicket(id);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate follow-up.");
    } finally {
      setLoaderFor(id, false);
    }
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const displayed = partRequests;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Needed</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage part requests from technicians</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No part requests found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Part</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Ticket</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Urgency</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Actions</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayed.map((pr) => {
                  const expanded = expandedRows.has(pr.id);
                  const loading_ = actionLoading[pr.id];
                  return (
                    <>
                      <tr key={pr.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{pr.part_name_display}</p>
                          {!pr.part && <p className="text-xs text-amber-600 mt-0.5">New part</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700">{pr.ticket_summary.store_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{pr.ticket_summary.asset_name}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{pr.quantity_needed}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${pr.urgency === "ASAP" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                            {PartRequestUrgencyLabels[pr.urgency] ?? pr.urgency}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge[pr.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {PartRequestStatusLabels[pr.status] ?? pr.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {pr.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => doAction(pr.id, () => api.approvePartRequestORS(pr.id))}
                                  disabled={loading_}
                                  className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {loading_ ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  Approve (ORS)
                                </button>
                                <button
                                  onClick={() => doAction(pr.id, () => api.sendPartRequestToClient(pr.id))}
                                  disabled={loading_}
                                  className="px-2.5 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                                >
                                  Send to Client
                                </button>
                              </>
                            )}
                            {pr.status === "APPROVED_ORS" && (
                              <>
                                <button
                                  onClick={() => setOrderingPr(pr)}
                                  disabled={loading_}
                                  className="px-2.5 py-1 bg-cyan-600 text-white rounded text-xs font-medium hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Truck className="w-3 h-3" /> Mark Ordered
                                </button>
                                <button
                                  onClick={() => doAction(pr.id, () => api.sendPartRequestToClient(pr.id))}
                                  disabled={loading_}
                                  className="px-2.5 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                                >
                                  Send to Client
                                </button>
                              </>
                            )}
                            {pr.status === "SENT_TO_CLIENT" && (
                              <span className="text-xs text-slate-400 italic">Awaiting client response</span>
                            )}
                            {pr.status === "APPROVED_CLIENT" && (
                              <button
                                onClick={() => setOrderingPr(pr)}
                                disabled={loading_}
                                className="px-2.5 py-1 bg-cyan-600 text-white rounded text-xs font-medium hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                <Truck className="w-3 h-3" /> Mark Ordered
                              </button>
                            )}
                            {pr.status === "ORDERED" && (
                              <button
                                onClick={() => doAction(pr.id, () => api.markPartRequestDelivered(pr.id))}
                                disabled={loading_}
                                className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {loading_ ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Mark Delivered
                              </button>
                            )}
                            {pr.status === "DELIVERED" && (
                              <button
                                onClick={() => handleGenerateFollowup(pr.id)}
                                disabled={loading_}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {loading_ ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                                Generate Follow-up
                              </button>
                            )}
                            {!pr.part && (
                              <button
                                onClick={() => setEditingPr(pr)}
                                className="px-2.5 py-1 border border-slate-300 text-slate-600 rounded text-xs hover:bg-slate-50"
                              >
                                Edit Details
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleRow(pr.id)} className="text-slate-400 hover:text-slate-600">
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${pr.id}-expanded`} className="bg-slate-50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              {pr.sku && <div><p className="text-xs text-slate-400">SKU</p><p className="text-slate-700">{pr.sku}</p></div>}
                              {pr.make && <div><p className="text-xs text-slate-400">Make</p><p className="text-slate-700">{pr.make}</p></div>}
                              {pr.model_number && <div><p className="text-xs text-slate-400">Model</p><p className="text-slate-700">{pr.model_number}</p></div>}
                              {pr.vendor && <div><p className="text-xs text-slate-400">Vendor</p><p className="text-slate-700">{pr.vendor}</p></div>}
                              {pr.cost_price && <div><p className="text-xs text-slate-400">Cost</p><p className="text-slate-700">${pr.cost_price}</p></div>}
                              {pr.selling_price && <div><p className="text-xs text-slate-400">Sell Price</p><p className="text-slate-700">${pr.selling_price}</p></div>}
                              {pr.tracking_number && <div><p className="text-xs text-slate-400">Tracking</p><p className="text-slate-700">{pr.tracking_number}</p></div>}
                              {pr.notes && <div className="col-span-3"><p className="text-xs text-slate-400">Notes</p><p className="text-slate-700">{pr.notes}</p></div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingPr && (
        <EditDetailsModal
          pr={editingPr}
          onClose={() => setEditingPr(null)}
          onSave={(updated) => {
            setPartRequests((prev) => prev.map((p) => p.id === updated.id ? updated : p));
            setEditingPr(null);
          }}
        />
      )}

      {orderingPr && (
        <TrackingModal
          onClose={() => setOrderingPr(null)}
          onConfirm={async (tracking) => {
            setOrderingPr(null);
            await doAction(orderingPr.id, () => api.markPartRequestOrdered(orderingPr.id, tracking));
          }}
        />
      )}
    </DashboardShell>
  );
}
