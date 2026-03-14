"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Ticket } from "@/lib/api";
import { SymptomCodeLabels } from "@/types/enums";
import { Wrench, LogOut, Loader2, FileText, Plus } from "lucide-react";

const statusStyle: Record<string, string> = {
  OPEN:          "bg-red-100 text-red-700",
  IN_PROGRESS:   "bg-blue-100 text-blue-700",
  PENDING_PARTS: "bg-amber-100 text-amber-700",
  RESOLVED:      "bg-green-100 text-green-700",
};

const priorityBadge: Record<string, string> = {
  LOW:      "bg-slate-100 text-slate-500",
  MEDIUM:   "bg-blue-100 text-blue-600",
  HIGH:     "bg-orange-100 text-orange-600",
  CRITICAL: "bg-red-100 text-red-700",
};

export default function TechPage() {
  const { user, logout } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTickets()
      .then((all) => setTickets(all.filter((t) => t.status !== "CLOSED" && t.status !== "CANCELLED")))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">My Tickets</p>
            <p className="text-slate-400 text-xs">
              {user ? `${user.first_name} ${user.last_name}`.trim() : "Technician"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/scan"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
            No open tickets assigned to you.
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">{t.asset_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityBadge[t.priority] ?? ""}`}>
                        {t.priority}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">{t.store_name}</p>
                    <p className="text-slate-600 text-sm mt-2">
                      {t.description || (t.symptom_code ? (SymptomCodeLabels[t.symptom_code] ?? t.symptom_code) : "No description")}
                    </p>
                    <p className="text-slate-400 text-xs mt-2">
                      Opened {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[t.status] ?? ""}`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                    {(t.status === "IN_PROGRESS" || t.status === "PENDING_PARTS") && (
                      <Link
                        href={`/tech/${t.id}/close`}
                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Close Ticket
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
