"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, Ticket, Asset } from "@/lib/api";
import { SymptomCode, SymptomCodeLabels } from "@/types/enums";
import { LogOut, Plus, Loader2, X, Wrench } from "lucide-react";

const statusStyle: Record<string, string> = {
  OPEN:          "bg-red-100 text-red-700",
  IN_PROGRESS:   "bg-blue-100 text-blue-700",
  PENDING_PARTS: "bg-amber-100 text-amber-700",
  RESOLVED:      "bg-green-100 text-green-700",
};

export default function ManagerPage() {
  const { user, logout } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [assetId, setAssetId] = useState("");
  const [symptom, setSymptom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const storeId = user?.store?.id;

  useEffect(() => {
    if (!storeId) return;
    Promise.all([
      api.listTickets(),
      api.listAssets({ store: storeId, active: true }),
    ])
      .then(([t, a]) => {
        // Filter tickets to active statuses only
        setTickets(t.filter((tk) => ["OPEN", "IN_PROGRESS", "PENDING_PARTS"].includes(tk.status)));
        setAssets(a);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetId || !symptom) { setFormError("Select an asset and symptom."); return; }
    setFormError("");
    setSubmitting(true);
    try {
      const ticket = await api.createTicket({
        asset: assetId,
        symptom_code: symptom,
        opened_by: user?.id,
      });
      setTickets((prev) => [ticket, ...prev]);
      setShowForm(false);
      setAssetId("");
      setSymptom("");
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {user?.store?.name ?? "My Store"}
            </p>
            <p className="text-slate-400 text-xs">Store Manager View</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Open Ticket Button */}
        <button
          onClick={() => setShowForm(true)}
          className="w-full mb-8 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold py-4 rounded-xl transition-colors"
        >
          <Plus className="w-5 h-5" />
          Report Equipment Issue
        </button>

        {/* New Ticket Form */}
        {showForm && (
          <div className="mb-8 bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">New Ticket</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Equipment</label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select equipment…</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">What's wrong?</label>
                <select
                  value={symptom}
                  onChange={(e) => setSymptom(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select symptom…</option>
                  {Object.entries(SymptomCodeLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Ticket
              </button>
            </form>
          </div>
        )}

        {/* Open Tickets */}
        <h2 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">
          Open Issues
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">
            No open issues — all good!
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{t.asset_name}</p>
                    <p className="text-slate-500 text-sm mt-0.5">
                      {SymptomCodeLabels[t.symptom_code] ?? t.symptom_code}
                    </p>
                    {t.assigned_tech_name && (
                      <p className="text-slate-400 text-xs mt-1">Tech: {t.assigned_tech_name}</p>
                    )}
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[t.status] ?? ""}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-3">
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
