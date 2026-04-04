"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { api, PartsApproval } from "@/lib/api";
import { AlertCircle, CheckCircle2, Loader2, Package, X } from "lucide-react";

const statusBadge: Record<string, string> = {
  SENT_TO_CLIENT: "bg-purple-100 text-purple-700",
  APPROVED:       "bg-emerald-100 text-emerald-700",
  DENIED:         "bg-red-100 text-red-700",
  ORDERED:        "bg-cyan-100 text-cyan-700",
  DELIVERED:      "bg-green-100 text-green-700",
};

const statusLabel: Record<string, string> = {
  SENT_TO_CLIENT: "Pending Approval",
  APPROVED:       "Approved",
  DENIED:         "Denied",
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

export default function PortalPartsPage() {
  const [approvals, setApprovals] = useState<PartsApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");

  useEffect(() => {
    api.listPartsApprovals()
      .then(setApprovals)
      .catch(() => setError("Failed to load parts approvals."))
      .finally(() => setLoading(false));
  }, []);

  function setLoaderFor(id: string, val: boolean) {
    setActionLoading((prev) => ({ ...prev, [id]: val }));
  }

  async function handleApprove(id: string) {
    setLoaderFor(id, true);
    try {
      const updated = await api.approvePartsClient(id);
      setApprovals((prev) => prev.map((a) => a.id === id ? updated : a));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to approve.");
    } finally {
      setLoaderFor(id, false);
    }
  }

  async function handleDenyConfirm(id: string) {
    setLoaderFor(id, true);
    try {
      const updated = await api.denyParts(id, denyReason);
      setApprovals((prev) => prev.map((a) => a.id === id ? updated : a));
      setDenyingId(null);
      setDenyReason("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to deny.");
    } finally {
      setLoaderFor(id, false);
    }
  }

  const pending = approvals.filter((a) => a.status === "SENT_TO_CLIENT");
  const history = approvals.filter((a) => a.status !== "SENT_TO_CLIENT");

  return (
    <PortalShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Requests</h1>
          <p className="text-slate-500 text-sm mt-0.5">Review and approve parts needed for your equipment</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Pending approval */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Awaiting Your Approval ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 py-10 text-center">
                  <Package className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pending.map((pa) => {
                    const busy = actionLoading[pa.id];
                    const td = pa.ticket_detail;
                    const total = parseFloat(pa.total_selling_price) || 0;
                    const isDenying = denyingId === pa.id;

                    return (
                      <div key={pa.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                        {/* Header */}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {td.ticket_number || td.id.slice(0, 8)}
                            </span>
                            <span className="text-slate-400 text-xs">·</span>
                            <span className="text-slate-700 text-sm">{td.store_name}</span>
                            {td.asset_name && (
                              <>
                                <span className="text-slate-400 text-xs">·</span>
                                <span className="text-slate-600 text-sm">{td.asset_name}</span>
                              </>
                            )}
                          </div>
                          {(td.tech_notes || td.formatted_report) && (
                            <p className="text-sm text-slate-500 mt-1 line-clamp-3">
                              {td.formatted_report || td.tech_notes}
                            </p>
                          )}
                          {pa.notes_for_client && (
                            <p className="text-sm text-slate-700 mt-2 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                              <span className="font-medium">Note from ORS:</span> {pa.notes_for_client}
                            </p>
                          )}
                        </div>

                        {/* Parts table */}
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-slate-400 border-b border-slate-100">
                              <th className="text-left pb-2 font-medium">Part Name</th>
                              <th className="text-center pb-2 font-medium">Qty</th>
                              <th className="text-right pb-2 font-medium">Unit Price</th>
                              <th className="text-right pb-2 font-medium">Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {pa.part_requests.map((pr) => (
                              <tr key={pr.id}>
                                <td className="py-1.5 text-slate-800 font-medium">{pr.part_name_display}</td>
                                <td className="py-1.5 text-center text-slate-700">{pr.quantity_needed}</td>
                                <td className="py-1.5 text-right text-slate-700">{fmt(pr.selling_price)}</td>
                                <td className="py-1.5 text-right text-slate-700">{lineTotal(pr.selling_price, pr.quantity_needed)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200">
                              <td colSpan={3} className="pt-2 text-right font-semibold text-slate-700">Grand Total</td>
                              <td className="pt-2 text-right font-bold text-slate-900">${total.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>

                        {/* Actions */}
                        {!isDenying ? (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApprove(pa.id)}
                              disabled={busy}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              Approve All
                            </button>
                            <button
                              onClick={() => { setDenyingId(pa.id); setDenyReason(""); }}
                              disabled={busy}
                              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" /> Deny
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-slate-600">Reason for denial</label>
                            <input
                              autoFocus
                              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                              placeholder="Please explain why you are denying this request..."
                              value={denyReason}
                              onChange={(e) => setDenyReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDenyConfirm(pa.id)}
                                disabled={busy || !denyReason.trim()}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                              >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Denial"}
                              </button>
                              <button
                                onClick={() => setDenyingId(null)}
                                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">History</h2>
                <div className="space-y-3">
                  {history.map((pa) => {
                    const td = pa.ticket_detail;
                    const total = parseFloat(pa.total_selling_price) || 0;
                    return (
                      <div key={pa.id} className="bg-white rounded-xl border border-slate-200 p-4 opacity-80">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-800 text-sm">
                                {td.ticket_number || td.id.slice(0, 8)}
                              </span>
                              <span className="text-slate-400 text-xs">·</span>
                              <span className="text-slate-600 text-sm">{td.store_name}</span>
                              {td.asset_name && (
                                <>
                                  <span className="text-slate-400 text-xs">·</span>
                                  <span className="text-slate-500 text-sm">{td.asset_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge[pa.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {statusLabel[pa.status] ?? pa.status}
                          </span>
                        </div>
                        {pa.status === "DENIED" && pa.denied_reason && (
                          <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded mb-3">
                            Denied: {pa.denied_reason}
                          </p>
                        )}
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-slate-50">
                            {pa.part_requests.map((pr) => (
                              <tr key={pr.id}>
                                <td className="py-1 text-slate-700">{pr.part_name_display}</td>
                                <td className="py-1 text-center text-slate-500">x{pr.quantity_needed}</td>
                                <td className="py-1 text-right text-slate-700">{lineTotal(pr.selling_price, pr.quantity_needed)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-100">
                              <td colSpan={2} className="pt-1 text-right font-medium text-slate-600">Total</td>
                              <td className="pt-1 text-right font-bold text-slate-800">${total.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        <p className="text-xs text-slate-400 mt-2">{new Date(pa.updated_at).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalShell>
  );
}
