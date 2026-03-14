"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import {
  api, Part, PricingConfig, Ticket, TimeEntryStatus, WorkImage,
} from "@/lib/api";
import { ResolutionCodeLabels, SymptomCodeLabels } from "@/types/enums";
import {
  AlertCircle, CheckCircle2, Clock, FileText,
  Loader2, Plus, RefreshCw, Trash2, X, Sparkles,
} from "lucide-react";

interface PartLine { part_id: string; quantity: number }

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function calcLabor(totalMin: number, pricing: PricingConfig) {
  const hours = Math.max(parseFloat(pricing.min_hours), totalMin / 60);
  return parseFloat(pricing.trip_charge) + hours * parseFloat(pricing.hourly_rate);
}

export default function CloseTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [ticket, setTicket]   = useState<Ticket | null>(null);
  const [parts, setParts]     = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [timeStatus, setTimeStatus]     = useState<TimeEntryStatus | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [elapsed, setElapsed]           = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [images, setImages]             = useState<WorkImage[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [techNotes, setTechNotes]             = useState("");
  const [formattedReport, setFormattedReport] = useState("");
  const [aiLoading, setAiLoading]             = useState(false);
  const [reportAccepted, setReportAccepted]   = useState(false);
  const [aiError, setAiError]                 = useState("");

  const [resolutionCode, setResolutionCode] = useState("");
  const [partLines, setPartLines]           = useState<PartLine[]>([]);
  const [invoiceEmail, setInvoiceEmail]     = useState("");
  const [submitting, setSubmitting]         = useState(false);

  useEffect(() => {
    Promise.all([
      api.getTicket(id),
      api.listParts(),
      api.getTimeEntry(id),
      api.getWorkImages(id),
    ])
      .then(([t, ps, ts, imgs]) => {
        setTicket(t); setParts(ps); setTimeStatus(ts); setImages(imgs);
      })
      .catch(() => setError("Failed to load ticket data."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (timeStatus?.active_entry) {
      const start = new Date(timeStatus.active_entry.clocked_in_at).getTime();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeStatus?.active_entry?.id]);

  async function handleClock() {
    setClockLoading(true);
    try {
      if (timeStatus?.is_clocked_in) await api.clockOut(id);
      else await api.clockIn(id);
      setTimeStatus(await api.getTimeEntry(id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clock error.");
    } finally {
      setClockLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const img = await api.uploadWorkImage(id, file);
      setImages((prev) => [...prev, img]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteImage(imgId: string) {
    try {
      await api.deleteWorkImage(imgId);
      setImages((prev) => prev.filter((i) => i.id !== imgId));
    } catch { /* ignore */ }
  }

  async function handlePolish() {
    if (!techNotes.trim()) return;
    setAiLoading(true); setAiError(""); setReportAccepted(false);
    try {
      const { formatted_report } = await api.formatReport(techNotes);
      setFormattedReport(formatted_report);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "AI formatting failed.");
    } finally {
      setAiLoading(false);
    }
  }

  function calcPartsTotal() {
    return partLines.reduce((sum, line) => {
      const part = parts.find((p) => p.id === line.part_id);
      return sum + (part ? parseFloat(part.unit_price) * line.quantity : 0);
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolutionCode) return;
    setSubmitting(true); setError(null);
    try {
      await api.closeTicket(id, {
        resolution_code: resolutionCode,
        labor_cost: null,
        parts_used: partLines.filter((l) => l.part_id && l.quantity > 0),
        invoice_email: invoiceEmail || undefined,
        tech_notes: techNotes,
        formatted_report: reportAccepted ? formattedReport : techNotes,
      });
      setSuccess(true);
      setTimeout(() => router.push("/dispatch"), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to close ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalMinutes   = (timeStatus?.total_minutes ?? 0) + (timeStatus?.is_clocked_in ? Math.floor(elapsed / 60) : 0);
  const estimatedLabor = timeStatus ? calcLabor(totalMinutes, timeStatus.pricing) : 0;
  const grandTotal     = calcPartsTotal() + estimatedLabor;

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Close Ticket</h1>
          <p className="text-slate-500 text-sm mt-0.5">Submit a service report to close this ticket</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : !ticket ? (
          <div className="py-12 text-center text-red-500">Ticket not found.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Ticket closed! Redirecting…
              </div>
            )}

            {/* Ticket summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Ticket Summary</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-400 text-xs">Asset</p><p className="font-medium text-slate-800">{ticket.asset_name}</p></div>
                <div><p className="text-slate-400 text-xs">Store</p><p className="font-medium text-slate-800">{ticket.store_name}</p></div>
                <div><p className="text-slate-400 text-xs">Symptom</p><p className="font-medium text-slate-800">{SymptomCodeLabels[ticket.symptom_code] ?? ticket.symptom_code}</p></div>
                <div><p className="text-slate-400 text-xs">Assigned Tech</p><p className="font-medium text-slate-800">{ticket.assigned_tech_name ?? "Unassigned"}</p></div>
              </div>
            </div>

            {/* Clock in/out */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-4">Time Tracking</p>
              <div className="flex items-center justify-between">
                <div>
                  {timeStatus?.is_clocked_in ? (
                    <div>
                      <div className="flex items-center gap-2 text-blue-600">
                        <Clock className="w-4 h-4" />
                        <span className="font-mono text-lg font-semibold">
                          {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
                          {String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:
                          {String(elapsed % 60).padStart(2, "0")}
                        </span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Live</span>
                      </div>
                      <p className="text-slate-400 text-xs mt-1">Started {new Date(timeStatus.active_entry!.clocked_in_at).toLocaleTimeString()}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-slate-700 font-medium text-sm">{totalMinutes > 0 ? `Total: ${formatMinutes(totalMinutes)}` : "Not clocked in"}</p>
                      {totalMinutes > 0 && timeStatus && (
                        <p className="text-slate-400 text-xs mt-0.5">Est. labor: ${estimatedLabor.toFixed(2)}</p>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" onClick={handleClock} disabled={clockLoading}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 ${timeStatus?.is_clocked_in ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                  {clockLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  {timeStatus?.is_clocked_in ? "Clock Out" : "Clock In"}
                </button>
              </div>
            </div>

            {/* Work photos */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Work Photos</p>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}
                  className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-700 disabled:opacity-50">
                  {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Photo
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              {images.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg py-8 text-center text-slate-400 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <p className="text-sm">Click to add photos</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img) => (
                    <div key={img.id} className="relative group aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Work photo" className="w-full h-full object-cover rounded-lg" />
                      <button type="button" onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                  <div className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Service notes + AI */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Service Notes</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  What was done? <span className="text-slate-400 font-normal text-xs">(write naturally)</span>
                </label>
                <textarea rows={4} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="e.g. replaced compressor relay, cleaned condenser coils…"
                  value={techNotes} onChange={(e) => setTechNotes(e.target.value)} />
              </div>
              <button type="button" onClick={handlePolish} disabled={!techNotes.trim() || aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Polish with AI
              </button>
              {aiError && <p className="text-red-500 text-sm">{aiError}</p>}
              {formattedReport && (
                <div className="border border-purple-200 rounded-lg bg-purple-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-purple-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> AI-formatted report
                    </p>
                    <button type="button" onClick={handlePolish} disabled={aiLoading} className="text-purple-500 hover:text-purple-700" title="Regenerate">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea rows={5} className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white resize-none"
                    value={formattedReport} onChange={(e) => setFormattedReport(e.target.value)} />
                  {!reportAccepted ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setReportAccepted(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                        <CheckCircle2 className="w-4 h-4" /> Accept Report
                      </button>
                      <button type="button" onClick={() => setFormattedReport("")}
                        className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                        Discard
                      </button>
                    </div>
                  ) : (
                    <p className="text-emerald-600 text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Report accepted
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Resolution code */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Resolution</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Resolution Code <span className="text-red-500">*</span></label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={resolutionCode} onChange={(e) => setResolutionCode(e.target.value)} required>
                  <option value="">Select resolution…</option>
                  {Object.entries(ResolutionCodeLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
            </div>

            {/* Parts used */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Parts Used</p>
                <button type="button" onClick={() => setPartLines((p) => [...p, { part_id: "", quantity: 1 }])}
                  className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-700">
                  <Plus className="w-4 h-4" /> Add Part
                </button>
              </div>
              {partLines.length === 0 && <p className="text-slate-400 text-sm text-center py-3">No parts added</p>}
              {partLines.map((line, i) => {
                const sel = parts.find((p) => p.id === line.part_id);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <select className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.part_id} onChange={(e) => setPartLines((prev) => prev.map((l, idx) => idx === i ? { ...l, part_id: e.target.value } : l))}>
                      <option value="">Select part…</option>
                      {parts.map((p) => <option key={p.id} value={p.id} disabled={p.quantity_on_hand === 0}>{p.name} (qty: {p.quantity_on_hand}) — ${p.unit_price}</option>)}
                    </select>
                    <input type="number" min="1" max={sel?.quantity_on_hand ?? 999}
                      className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.quantity} onChange={(e) => setPartLines((prev) => prev.map((l, idx) => idx === i ? { ...l, quantity: parseInt(e.target.value) || 1 } : l))} />
                    {sel && <span className="text-slate-500 text-sm w-20 text-right shrink-0">${(parseFloat(sel.unit_price) * line.quantity).toFixed(2)}</span>}
                    <button type="button" onClick={() => setPartLines((p) => p.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Invoice + totals */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Invoice</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Send to Email <span className="text-slate-400 text-xs font-normal">(optional)</span>
                </label>
                <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="client@example.com" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} />
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-1.5 text-sm">
                {timeStatus && <>
                  <div className="flex justify-between text-slate-500"><span>Trip charge</span><span>${timeStatus.pricing.trip_charge}</span></div>
                  <div className="flex justify-between text-slate-500">
                    <span>Labor ({formatMinutes(Math.max(parseFloat(timeStatus.pricing.min_hours) * 60, totalMinutes))} @ ${timeStatus.pricing.hourly_rate}/hr)</span>
                    <span>${(estimatedLabor - parseFloat(timeStatus.pricing.trip_charge)).toFixed(2)}</span>
                  </div>
                </>}
                <div className="flex justify-between text-slate-500"><span>Parts subtotal</span><span>${calcPartsTotal().toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-slate-200"><span>Estimated Total</span><span>${grandTotal.toFixed(2)}</span></div>
                {totalMinutes === 0 && <p className="text-amber-600 text-xs">⚠ No time tracked — minimum 1 hour will be billed</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50" onClick={() => router.back()}>Cancel</button>
              <button type="submit" disabled={!resolutionCode || submitting}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Close & Generate Invoice
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
