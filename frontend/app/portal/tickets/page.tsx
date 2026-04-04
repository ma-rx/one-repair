"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import { api, Ticket } from "@/lib/api";
import { SymptomCodeLabels } from "@/types/enums";
import { Plus, Loader2 } from "lucide-react";

function getStatusDisplay(status: string, partsApprovalStatus: string | null): { label: string; style: string } {
  if (status === "PENDING_PARTS") {
    if (partsApprovalStatus === "ORDERED")        return { label: "Parts Ordered",   style: "bg-cyan-100 text-cyan-700" };
    if (partsApprovalStatus === "DELIVERED")      return { label: "Parts Delivered", style: "bg-green-100 text-green-700" };
    if (partsApprovalStatus === "APPROVED")       return { label: "Parts Approved",  style: "bg-emerald-100 text-emerald-700" };
    if (partsApprovalStatus === "SENT_TO_CLIENT") return { label: "Pending Approval", style: "bg-purple-100 text-purple-700" };
    if (partsApprovalStatus === "DENIED")         return { label: "Parts Denied",    style: "bg-red-100 text-red-700" };
  }
  const style: Record<string, string> = {
    OPEN:          "bg-red-100 text-red-700",
    DISPATCHED:    "bg-purple-100 text-purple-700",
    IN_PROGRESS:   "bg-blue-100 text-blue-700",
    PENDING_PARTS: "bg-amber-100 text-amber-700",
    RESOLVED:      "bg-green-100 text-green-700",
    CLOSED:        "bg-slate-100 text-slate-500",
    CANCELLED:     "bg-slate-100 text-slate-400",
  };
  return { label: status.replace(/_/g, " "), style: style[status] ?? "" };
}

export default function PortalTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTickets(filter || undefined)
      .then(setTickets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <PortalShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
          <p className="text-slate-500 text-sm mt-0.5">All work orders across your locations</p>
        </div>
        <Link
          href="/scan"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </Link>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {["", "OPEN", "DISPATCHED", "IN_PROGRESS", "PENDING_PARTS", "RESOLVED", "CLOSED"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s === "" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No tickets found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Ticket #</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Asset</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Store</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Issue</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Opened</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/portal/tickets/${t.id}`}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/portal/tickets/${t.id}`}
                      className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                    >
                      {t.ticket_number || "—"}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">{t.asset_name}</td>
                  <td className="px-6 py-4 text-slate-500">{t.store_name}</td>
                  <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                    {t.description || (t.symptom_code ? (SymptomCodeLabels[t.symptom_code] ?? t.symptom_code) : "—")}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const { label, style } = getStatusDisplay(t.status, t.parts_approval_status ?? null);
                      return (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${style}`}>
                          {label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
