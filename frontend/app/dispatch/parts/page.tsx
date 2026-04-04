"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, PartsApproval } from "@/lib/api";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink,
  Loader2, Package, Pencil, Truck, X,
} from "lucide-react";

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Sent to Client", value: "SENT_TO_CLIENT" },
  { label: "Approved", value: "APPROVED" },
  { label: "Denied", value: "DENIED" },
  { label: "Ordered", value: "ORDERED" },
  { label: "Delivered", value: "DELIVERED" },
];

const statusBadge: Record<string, string> = {
  PENDING:        "bg-amber-100 text-amber-700",
  SENT_TO_CLIENT: "bg-purple-100 text-purple-700",
  APPROVED:       "bg-emerald-100 text-emerald-700",
  DENIED:         "bg-red-100 text-red-700",
  ORDERED:        "bg-cyan-100 text-cyan-700",
  DELIVERED:      "bg-green-100 text-green-700",
};

const statusLabel: Record<string, string> = {
  PENDING:        "Pending ORS Review",
  SENT_TO_CLIENT: "Sent to Client",
  APPROVED:       "Approved",
  DENIED:         "Denied by Client",
  ORDERED:        "Ordered",
  DELIVERED:      "Delivered",
};

function fmt(val: string | null | undefined) {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? val : `$${n.toFixed(2)}`;
}

function lineTotal(selling_price: string | null, qty: number) {
  if (!selling_price) return "—";
  const n = parseFloat(selling_price);
  return isNaN(n) ? "—" : `$${(n * qty).toFixed(2)}`;
}

export default function DispatchPartsPage() {
  const [approvals, setApprovals] = useState<PartsApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Inline UI state
  const [sendNotesId, setSendNotesId] = useState<string | null>(null);
  const [sendNotes, setSendNotes] = useState("");
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingVal, setTrackingVal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [activeTab]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listPartsApprovals(activeTab ? { status: activeTab } : {});
      setApprovals(data);
    } catch {
      setError("Failed to load parts approvals.");
    } finally {
      setLoading(false);
    }
  }

  function setLoaderFor(id: string, val: boolean) {
    setActionLoading((prev) => ({ ...prev, [id]: val }));
  }

  async function doAction(id: string, fn: () => Promise<PartsApproval>) {
    setLoaderFor(id, true);
    try {
      const updated = await fn();
      setApprovals((prev) => prev.map((a) => a.id === id ? updated : a));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoaderFor(id, false);
    }
  }

  async function handleGenerateFollowup(id: string) {
    setLoaderFor(id, true);
    try {
      await api.generatePartsFollowup(id);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate follow-up.");
    } finally {
      setLoaderFor(id, false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Approvals</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage parts approval requests from technicians</p>
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
        ) : approvals.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No parts approvals found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((pa) => {
              const expanded = expandedIds.has(pa.id);
              const busy = actionLoading[pa.id];
              const td = pa.ticket_detail;
              const total = parseFloat(pa.total_selling_price) || 0;
              const nte = parseFloat(pa.nte_limit) || 500;
              const overNte = pa.requires_client_approval;
              const isSending = sendNotesId === pa.id;
              const isTracking = trackingId === pa.id;
              const isEditing = editingId === pa.id;

              return (
                <div key={pa.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 flex items-start gap-4 border-b border-slate-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {td.ticket_number || td.id.slice(0, 8)}
                        </span>
                        <span className="text-slate-400 text-xs">·</span>
                        <span className="text-slate-700 text-sm">{td.store_name}</span>
                        <span className="text-slate-400 text-xs">·</span>
                        <span className="text-slate-600 text-sm">{td.asset_name}</span>
                        {td.symptom_code && (
                          <>
                            <span className="text-slate-400 text-xs">·</span>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{td.symptom_code}</span>
                          </>
                        )}
                      </div>
                      {td.tech_notes && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{td.tech_notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge[pa.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {statusLabel[pa.status] ?? pa.status}
                      </span>
                      <button onClick={() => toggleExpand(pa.id)} className="text-slate-400 hover:text-slate-600 ml-1">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Parts table */}
                  <div className="px-5 py-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 border-b border-slate-100">
                          <th className="text-left pb-2 font-medium">Part Name</th>
                          <th className="text-left pb-2 font-medium">SKU</th>
                          <th className="text-center pb-2 font-medium">Qty</th>
                          <th className="text-right pb-2 font-medium">Unit Price</th>
                          <th className="text-right pb-2 font-medium">Line Total</th>
                          {isEditing && <th className="pb-2" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {pa.part_requests.map((pr) => (
                          <tr key={pr.id}>
                            <td className="py-1.5 text-slate-800 font-medium">{pr.part_name_display}</td>
                            <td className="py-1.5 text-slate-500">{pr.sku || "—"}</td>
                            <td className="py-1.5 text-center text-slate-700">{pr.quantity_needed}</td>
                            <td className="py-1.5 text-right text-slate-700">{fmt(pr.selling_price)}</td>
                            <td className="py-1.5 text-right text-slate-700">{lineTotal(pr.selling_price, pr.quantity_needed)}</td>
                            {isEditing && (
                              <td className="py-1.5 pl-3">
                                <button
                                  onClick={() => doAction(pa.id, () => api.removePartFromApproval(pa.id, pr.id))}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200">
                          <td colSpan={isEditing ? 4 : 3} className="pt-2 text-xs text-slate-400">
                            NTE Limit: ${nte.toFixed(2)}
                          </td>
                          <td className="pt-2 text-right font-bold text-slate-900">
                            ${total.toFixed(2)}
                          </td>
                          {isEditing && <td />}
                        </tr>
                        <tr>
                          <td colSpan={isEditing ? 5 : 4} className="pb-1">
                            {overNte ? (
                              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                Requires Client Approval (over NTE)
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                Under NTE — Direct Approval
                              </span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    {pa.status === "PENDING" && (
                      <>
                        {!overNte && (
                          <button
                            onClick={() => doAction(pa.id, () => api.approvePartsORS(pa.id))}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Approve & Order
                          </button>
                        )}
                        {overNte && (
                          <button
                            onClick={() => doAction(pa.id, () => api.approvePartsORS(pa.id))}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
                          >
                            Approve Anyway
                          </button>
                        )}
                        {!isSending ? (
                          <button
                            onClick={() => { setSendNotesId(pa.id); setSendNotes(""); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"
                          >
                            Send to Client
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 w-full mt-1">
                            <textarea
                              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                              rows={2}
                              placeholder="Notes for client (optional)..."
                              value={sendNotes}
                              onChange={(e) => setSendNotes(e.target.value)}
                            />
                            <button
                              onClick={() => {
                                setSendNotesId(null);
                                doAction(pa.id, () => api.sendPartsToClient(pa.id, sendNotes));
                              }}
                              disabled={busy}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button onClick={() => setSendNotesId(null)} className="px-2 py-1.5 text-slate-500 text-xs hover:text-slate-700">Cancel</button>
                          </div>
                        )}
                        <button
                          onClick={() => setEditingId(isEditing ? null : pa.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-white"
                        >
                          <Pencil className="w-3 h-3" /> {isEditing ? "Done Editing" : "Edit Parts"}
                        </button>
                      </>
                    )}

                    {pa.status === "SENT_TO_CLIENT" && (
                      <span className="text-xs text-slate-400 italic">Awaiting client approval...</span>
                    )}

                    {pa.status === "APPROVED" && (
                      <>
                        {!isTracking ? (
                          <button
                            onClick={() => { setTrackingId(pa.id); setTrackingVal(""); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700"
                          >
                            <Truck className="w-3 h-3" /> Mark Ordered
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400"
                              placeholder="Tracking number (optional)"
                              value={trackingVal}
                              onChange={(e) => setTrackingVal(e.target.value)}
                            />
                            <button
                              onClick={() => {
                                setTrackingId(null);
                                doAction(pa.id, () => api.markPartsOrdered(pa.id, trackingVal));
                              }}
                              disabled={busy}
                              className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button onClick={() => setTrackingId(null)} className="text-slate-400 hover:text-slate-600 text-xs">Cancel</button>
                          </div>
                        )}
                      </>
                    )}

                    {pa.status === "DENIED" && (
                      <>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex-1">
                          <X className="w-3 h-3 shrink-0" />
                          <span><strong>Denied:</strong> {pa.denied_reason || "No reason provided"}</span>
                        </div>
                        <button
                          onClick={() => doAction(pa.id, () => api.resubmitParts(pa.id))}
                          disabled={busy}
                          className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
                        >
                          Resubmit
                        </button>
                      </>
                    )}

                    {pa.status === "ORDERED" && (
                      <div className="flex items-center gap-3 w-full">
                        {pa.tracking_number && (
                          <span className="text-xs text-slate-500">
                            Tracking: <span className="font-medium text-slate-700">{pa.tracking_number}</span>
                          </span>
                        )}
                        <button
                          onClick={() => doAction(pa.id, () => api.markPartsDelivered(pa.id))}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Mark Delivered
                        </button>
                      </div>
                    )}

                    {pa.status === "DELIVERED" && (
                      <button
                        onClick={() => handleGenerateFollowup(pa.id)}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                        Generate Follow-up Ticket
                      </button>
                    )}
                  </div>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 space-y-1">
                      {pa.notes_for_client && (
                        <p><span className="font-medium text-slate-700">Notes for client:</span> {pa.notes_for_client}</p>
                      )}
                      {td.formatted_report && (
                        <div>
                          <p className="font-medium text-slate-700 mb-0.5">Service report:</p>
                          <p className="text-slate-600 whitespace-pre-wrap">{td.formatted_report}</p>
                        </div>
                      )}
                      <p>Created: {new Date(pa.created_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
