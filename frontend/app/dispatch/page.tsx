"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { api, Ticket } from "@/lib/api";
import { SymptomCodeLabels } from "@/types/enums";
import {
  ClipboardList, Clock, AlertTriangle, Plus,
  UserCheck, Loader2, RefreshCw, Brain, Receipt,
} from "lucide-react";

const statusStyle: Record<string, string> = {
  OPEN:          "bg-red-100 text-red-700",
  DISPATCHED:    "bg-purple-100 text-purple-700",
  IN_PROGRESS:   "bg-blue-100 text-blue-700",
  PENDING_PARTS: "bg-amber-100 text-amber-700",
  COMPLETED:     "bg-green-100 text-green-700",
  RESOLVED:      "bg-green-100 text-green-700",
  CLOSED:        "bg-slate-100 text-slate-500",
  PAID:          "bg-emerald-100 text-emerald-700",
  CANCELLED:     "bg-slate-100 text-slate-400",
};

// When PENDING_PARTS, override display based on parts approval progress
function getStatusDisplay(status: string, partsApprovalStatus: string | null): { label: string; style: string } {
  if (status === "PENDING_PARTS") {
    if (partsApprovalStatus === "ORDERED")   return { label: "Parts Ordered",   style: "bg-cyan-100 text-cyan-700" };
    if (partsApprovalStatus === "DELIVERED") return { label: "Parts Delivered", style: "bg-green-100 text-green-700" };
    if (partsApprovalStatus === "APPROVED")  return { label: "Parts Approved",  style: "bg-emerald-100 text-emerald-700" };
    if (partsApprovalStatus === "SENT_TO_CLIENT") return { label: "Pending Client", style: "bg-purple-100 text-purple-700" };
  }
  return { label: status.replace(/_/g, " "), style: statusStyle[status] ?? "" };
}

const priorityDot: Record<string, string> = {
  LOW:      "bg-slate-400",
  MEDIUM:   "bg-blue-400",
  HIGH:     "bg-orange-400",
  CRITICAL: "bg-red-500",
};

const STATUS_TABS = ["ALL", "OPEN", "DISPATCHED", "IN_PROGRESS", "PENDING_PARTS", "COMPLETED", "CLOSED", "PAID"];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const priorityLabel: Record<string, string> = {
  LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical",
};

export default function DispatchPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tab, setTab] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [priorityLoading, setPriorityLoading] = useState<Record<string, boolean>>({});

  function load(status: string) {
    setLoading(true);
    setError("");
    api.listTickets(status === "ALL" ? undefined : status)
      .then(setTickets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(tab); }, [tab]);

  async function handlePriorityChange(id: string, priority: string) {
    setPriorityLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const updated = await api.patchTicketPriority(id, priority);
      setTickets((prev) => prev.map((t) => t.id === id ? { ...t, priority: updated.priority } : t));
    } catch {
      // silently ignore — user can retry
    } finally {
      setPriorityLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  // Stats always from full list when on ALL tab
  const open        = tickets.filter((t) => t.status === "OPEN").length;
  const inProgress  = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const pending     = tickets.filter((t) => t.status === "PENDING_PARTS").length;

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dispatch</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage and assign open work orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(tab)}
            className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium px-3 py-2.5 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/scan"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </Link>
        </div>
      </div>

      {/* Stats */}
      {tab === "ALL" && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Open",         value: open,       icon: AlertTriangle, color: "text-red-500 bg-red-50"   },
            { label: "In Progress",  value: inProgress, icon: Clock,         color: "text-blue-500 bg-blue-50" },
            { label: "Pending Parts",value: pending,    icon: ClipboardList, color: "text-amber-500 bg-amber-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl p-5 border border-slate-200 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{loading ? "—" : value}</p>
                <p className="text-slate-500 text-sm">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === s
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 text-sm">{error}</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No tickets found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Ticket #</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Asset</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Store</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Issue</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Priority</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Tech</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Scheduled</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Opened</th>
                <th className="px-6 py-3 text-slate-500 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/dispatch/${t.id}`}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {t.ticket_number || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">{t.asset_name}</td>
                  <td className="px-6 py-4 text-slate-500">{t.store_name}</td>
                  <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                    {t.description || (t.symptom_code ? (SymptomCodeLabels[t.symptom_code] ?? t.symptom_code) : "—")}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[t.priority] ?? "bg-slate-300"}`} />
                      {priorityLoading[t.id] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                      ) : (
                        <select
                          value={t.priority}
                          onChange={(e) => handlePriorityChange(t.id, e.target.value)}
                          className="text-xs text-slate-600 bg-transparent border-none outline-none cursor-pointer hover:text-slate-900 pr-1"
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>{priorityLabel[p]}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const { label, style } = getStatusDisplay(t.status, t.parts_approval_status ?? null);
                      return (
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${style}`}>
                            {label}
                          </span>
                          {t.needs_coding && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <Brain className="w-3 h-3" /> Needs coding
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {t.assigned_tech_name ?? <span className="text-slate-300">Unassigned</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {t.scheduled_date
                      ? new Date(t.scheduled_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {t.status === "OPEN" && (
                        <Link
                          href={`/dispatch/${t.id}/assign`}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Assign
                        </Link>
                      )}
                      {(t.status === "DISPATCHED" || t.status === "IN_PROGRESS" || t.status === "PENDING_PARTS") && (
                        <Link
                          href={`/dispatch/${t.id}/assign`}
                          className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Reassign
                        </Link>
                      )}
                      {t.status === "COMPLETED" && t.has_service_report && (
                        <Link
                          href={`/dispatch/${t.id}/invoice`}
                          className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5" /> Invoice
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardShell>
  );
}
