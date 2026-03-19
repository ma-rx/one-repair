"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, Ticket, TicketAsset, WorkImage } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import TicketDetail from "@/components/TicketDetail";
import { SymptomCodeLabels, ResolutionCodeLabels } from "@/types/enums";
import { Loader2, UserCheck, FileText, Brain, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SYMPTOM_OPTIONS = Object.entries(SymptomCodeLabels);
const RESOLUTION_OPTIONS = Object.entries(ResolutionCodeLabels);

interface AssetCodeState {
  symptom_code: string;
  resolution_code: string;
  saving: boolean;
  saved: boolean;
  error: string;
}

export default function DispatchTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const todayStr = toLocalDateStr(new Date());
  const isAdmin = user?.role === "ORS_ADMIN";

  const [ticket, setTicket]   = useState<Ticket | null>(null);
  const [images, setImages]   = useState<WorkImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [deleting, setDeleting] = useState(false);

  // Per-asset code state keyed by TicketAsset id
  const [codeState, setCodeState] = useState<Record<string, AssetCodeState>>({});

  useEffect(() => {
    Promise.all([api.getTicket(id), api.getWorkImages(id)])
      .then(([t, imgs]) => {
        setTicket(t);
        setImages(imgs);
        // Initialise code state from existing values
        const init: Record<string, AssetCodeState> = {};
        for (const ta of t.assets) {
          init[ta.id] = {
            symptom_code:    ta.symptom_code    || "",
            resolution_code: ta.resolution_code || "",
            saving: false, saved: false, error: "",
          };
        }
        setCodeState(init);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function patchCode(taId: string, patch: Partial<AssetCodeState>) {
    setCodeState((prev) => ({ ...prev, [taId]: { ...prev[taId], ...patch } }));
  }

  async function saveCodes(ta: TicketAsset) {
    const state = codeState[ta.id];
    if (!state) return;
    patchCode(ta.id, { saving: true, saved: false, error: "" });
    try {
      await api.updateAssetCodes(id, ta.id, {
        symptom_code:    state.symptom_code,
        resolution_code: state.resolution_code,
      });
      patchCode(ta.id, { saving: false, saved: true });
      setTimeout(() => patchCode(ta.id, { saved: false }), 2500);
    } catch (e: unknown) {
      patchCode(ta.id, { saving: false, error: e instanceof Error ? e.message : "Save failed." });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this ticket permanently? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.deleteTicket(id);
      router.replace("/dispatch");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed.");
      setDeleting(false);
    }
  }

  const canAssign = ticket && (ticket.status === "OPEN" || ticket.status === "DISPATCHED");
  const canClose  = ticket && (ticket.status === "IN_PROGRESS" || ticket.status === "PENDING_PARTS" || ticket.status === "DISPATCHED");
  const canReviewInvoice = ticket && ticket.status === "COMPLETED";
  const isClosed  = ticket?.status === "CLOSED";

  return (
    <DashboardShell>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : ticket ? (
        <div className="space-y-5 max-w-2xl mx-auto">
          <TicketDetail
            ticket={ticket}
            images={images}
            backHref="/dispatch"
            backLabel="Dispatch"
            todayStr={todayStr}
            actions={
              <div className="flex gap-3">
                {canAssign && (
                  <Link
                    href={`/dispatch/${id}/assign`}
                    className="flex-1 flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    <UserCheck className="w-4 h-4" /> Assign / Reschedule
                  </Link>
                )}
                {canClose && (
                  <Link
                    href={`/dispatch/${id}/close`}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    <FileText className="w-4 h-4" /> Service Report
                  </Link>
                )}
                {canReviewInvoice && (
                  <Link
                    href={`/dispatch/${id}/close`}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    <FileText className="w-4 h-4" /> Review &amp; Invoice
                  </Link>
                )}
              </div>
            }
          />

          {/* AI Training Codes — ORS Admin only, shown on closed tickets + any ticket with assets */}
          {isAdmin && ticket.assets.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-4 h-4 text-purple-600" />
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">AI Training Data</p>
                {isClosed && ticket.needs_coding && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Needs coding
                  </span>
                )}
                {isClosed && !ticket.needs_coding && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Coded
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-4">Set symptom and resolution codes per asset. Used to train the diagnostic AI.</p>

              <div className="space-y-5">
                {ticket.assets.map((ta) => {
                  const s = codeState[ta.id];
                  if (!s) return null;
                  const isDirty =
                    s.symptom_code    !== (ta.symptom_code    || "") ||
                    s.resolution_code !== (ta.resolution_code || "");

                  return (
                    <div key={ta.id} className="border border-slate-100 rounded-lg p-4 space-y-3">
                      <p className="font-medium text-slate-800 text-sm">{ta.asset_name}</p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 font-medium mb-1">Symptom Code</label>
                          <select
                            value={s.symptom_code}
                            onChange={(e) => patchCode(ta.id, { symptom_code: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            <option value="">— not set —</option>
                            {SYMPTOM_OPTIONS.map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 font-medium mb-1">Resolution Code</label>
                          <select
                            value={s.resolution_code}
                            onChange={(e) => patchCode(ta.id, { resolution_code: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            <option value="">— not set —</option>
                            {RESOLUTION_OPTIONS.map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        {s.error && <p className="text-red-500 text-xs">{s.error}</p>}
                        {s.saved && (
                          <p className="text-emerald-600 text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Saved
                          </p>
                        )}
                        {!s.error && !s.saved && <span />}
                        <button
                          onClick={() => saveCodes(ta)}
                          disabled={s.saving || !isDirty}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                        >
                          {s.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                          Save Codes
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {isAdmin && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Ticket
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400">Ticket not found.</div>
      )}
    </DashboardShell>
  );
}
