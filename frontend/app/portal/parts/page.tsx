"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { api, PartRequest } from "@/lib/api";
import { PartRequestUrgencyLabels } from "@/types/enums";
import { AlertCircle, CheckCircle2, Loader2, Package, X } from "lucide-react";

const statusBadge: Record<string, string> = {
  SENT_TO_CLIENT:  "bg-purple-100 text-purple-700",
  APPROVED_CLIENT: "bg-emerald-100 text-emerald-700",
  DENIED:          "bg-red-100 text-red-700",
  ORDERED:         "bg-cyan-100 text-cyan-700",
  DELIVERED:       "bg-green-100 text-green-700",
};

const statusLabel: Record<string, string> = {
  SENT_TO_CLIENT:  "Pending Approval",
  APPROVED_CLIENT: "Approved",
  DENIED:          "Denied",
  ORDERED:         "Ordered",
  DELIVERED:       "Delivered",
};

export default function PortalPartsPage() {
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.listPartRequests()
      .then(setPartRequests)
      .catch(() => setError("Failed to load part requests."))
      .finally(() => setLoading(false));
  }, []);

  function setLoaderFor(id: string, val: boolean) {
    setActionLoading((prev) => ({ ...prev, [id]: val }));
  }

  async function handleApprove(id: string) {
    setLoaderFor(id, true);
    try {
      const updated = await api.approvePartRequestClient(id);
      setPartRequests((prev) => prev.map((p) => p.id === id ? updated : p));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to approve.");
    } finally {
      setLoaderFor(id, false);
    }
  }

  async function handleDeny(id: string) {
    setLoaderFor(id, true);
    try {
      const updated = await api.denyPartRequest(id);
      setPartRequests((prev) => prev.map((p) => p.id === id ? updated : p));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to deny.");
    } finally {
      setLoaderFor(id, false);
    }
  }

  const pending = partRequests.filter((p) => p.status === "SENT_TO_CLIENT");
  const history = partRequests.filter((p) => p.status !== "SENT_TO_CLIENT");

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
                <div className="space-y-3">
                  {pending.map((pr) => {
                    const loading_ = actionLoading[pr.id];
                    return (
                      <div key={pr.id} className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-slate-800">{pr.part_name_display}</p>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${pr.urgency === "ASAP" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                                {PartRequestUrgencyLabels[pr.urgency] ?? pr.urgency}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500">
                              {pr.ticket_summary.store_name}
                              {pr.ticket_summary.asset_name && ` · ${pr.ticket_summary.asset_name}`}
                            </p>
                            <div className="flex gap-4 mt-2 text-xs text-slate-400">
                              <span>Qty: {pr.quantity_needed}</span>
                              {pr.selling_price && <span>Est. cost: ${pr.selling_price}</span>}
                            </div>
                            {pr.notes && <p className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{pr.notes}</p>}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleApprove(pr.id)}
                              disabled={loading_}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {loading_ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              Approve
                            </button>
                            <button
                              onClick={() => handleDeny(pr.id)}
                              disabled={loading_}
                              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              {loading_ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                              Deny
                            </button>
                          </div>
                        </div>
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
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Part</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Location</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((pr) => (
                        <tr key={pr.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{pr.part_name_display}</td>
                          <td className="px-4 py-3 text-slate-600">{pr.ticket_summary.store_name}</td>
                          <td className="px-4 py-3 text-slate-600">{pr.quantity_needed}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge[pr.status] ?? "bg-slate-100 text-slate-600"}`}>
                              {statusLabel[pr.status] ?? pr.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{new Date(pr.updated_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalShell>
  );
}
