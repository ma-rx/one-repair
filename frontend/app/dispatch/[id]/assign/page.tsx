"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { api, AppUser, Ticket } from "@/lib/api";
import { UserCheck, Loader2, AlertCircle, CheckCircle2, Calendar } from "lucide-react";

export default function AssignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket]             = useState<Ticket | null>(null);
  const [techs, setTechs]               = useState<AppUser[]>([]);
  const [selectedTech, setSelectedTech] = useState<number | "">("");
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  useEffect(() => {
    Promise.all([api.getTicket(id), api.listTechs()])
      .then(([t, ts]) => {
        setTicket(t);
        setTechs(ts);
        if (t.scheduled_date) setScheduledDate(t.scheduled_date);
        if (t.assigned_tech) setSelectedTech(t.assigned_tech);
      })
      .catch(() => setError("Failed to load ticket or technicians."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTech) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.assignTech(id, Number(selectedTech), scheduledDate || undefined);
      setSuccess(true);
      setTimeout(() => router.push("/dispatch"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign technician.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Assign Technician</h1>
          <p className="text-slate-500 text-sm mt-0.5">Select a tech and schedule a date for this ticket</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && ticket && (
          <div className="space-y-5">
            {/* Ticket summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Ticket</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Asset</p>
                  <p className="font-medium text-slate-800">{ticket.asset_name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Store</p>
                  <p className="font-medium text-slate-800">{ticket.store_name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400 text-xs">Issue</p>
                  <p className="font-medium text-slate-800">{ticket.description || "No description"}</p>
                </div>
                {ticket.store_address && (
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs">Address</p>
                    <p className="font-medium text-slate-800">{ticket.store_address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Assign form */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 mb-4 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Tech assigned. Redirecting…
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Technician <span className="text-red-500">*</span>
                  </label>
                  {techs.length === 0 ? (
                    <p className="text-sm text-slate-400">No technicians found.</p>
                  ) : (
                    <select
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={selectedTech}
                      onChange={(e) => setSelectedTech(Number(e.target.value))}
                      required
                    >
                      <option value="">Select technician…</option>
                      {techs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.first_name && t.last_name ? `${t.first_name} ${t.last_name}` : t.username}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> Scheduled Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedTech || !scheduledDate || submitting || techs.length === 0}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    Assign & Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
