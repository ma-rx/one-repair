"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  api, Part, PartRequestInput, PricingConfig, Ticket, TimeEntryStatus, WorkImage,
} from "@/lib/api";
import { SymptomCodeLabels, AssetCategoryLabels } from "@/types/enums";
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Clock, FileText,
  Loader2, Plus, RefreshCw, Trash2, Wrench, X, Sparkles,
} from "lucide-react";

interface PartLine { part_id: string; quantity: number }

interface PartNeededLine {
  mode: "existing" | "new";
  part_id: string;
  part_name_display: string;
  part_name: string;
  sku: string;
  asset_category: string;
  make: string;
  model_number: string;
  vendor: string;
  cost_price: string;
  selling_price: string;
  quantity_needed: number;
  urgency: "ASAP" | "NEXT_VISIT";
  notes: string;
}

function emptyNeededLine(): PartNeededLine {
  return {
    mode: "new", part_id: "", part_name_display: "",
    part_name: "", sku: "", asset_category: "", make: "",
    model_number: "", vendor: "", cost_price: "", selling_price: "",
    quantity_needed: 1, urgency: "NEXT_VISIT", notes: "",
  };
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function calcLabor(totalMin: number, pricing: PricingConfig) {
  const hours = Math.max(parseFloat(pricing.min_hours), totalMin / 60);
  return parseFloat(pricing.trip_charge) + hours * parseFloat(pricing.hourly_rate);
}

function PartsCombobox({
  parts,
  value,
  onChange,
  placeholder,
}: {
  parts: Part[];
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = parts.find((p) => p.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = parts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.make.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative flex-1">
      <div
        className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
        onClick={() => setOpen(true)}
      >
        {selected ? (
          <span className="flex-1 text-slate-800">{selected.name}</span>
        ) : (
          <input
            className="flex-1 outline-none bg-transparent text-slate-800 placeholder-slate-400"
            placeholder={placeholder ?? "Search parts…"}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        )}
        {selected ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange("", ""); setSearch(""); }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </div>
      {open && !selected && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No results found</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                onClick={() => { onChange(p.id, p.name); setOpen(false); setSearch(""); }}
              >
                <p className="font-medium text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {p.sku && `SKU: ${p.sku} · `}qty: {p.quantity_on_hand} · ${p.selling_price}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function TechWorkPage() {
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

  const [images, setImages]           = useState<WorkImage[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [techNotes, setTechNotes]             = useState("");
  const [formattedReport, setFormattedReport] = useState("");
  const [aiLoading, setAiLoading]             = useState(false);
  const [reportAccepted, setReportAccepted]   = useState(false);
  const [aiError, setAiError]                 = useState("");

  const [partLines, setPartLines]           = useState<PartLine[]>([]);
  const [neededLines, setNeededLines]       = useState<PartNeededLine[]>([]);
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
      return sum + (part ? parseFloat(part.selling_price || part.unit_price) * line.quantity : 0);
    }, 0);
  }

  function updateNeeded(i: number, patch: Partial<PartNeededLine>) {
    setNeededLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);

    const parts_needed: PartRequestInput[] = neededLines
      .filter((l) => l.mode === "existing" ? !!l.part_id : !!l.part_name.trim())
      .map((l) => {
        if (l.mode === "existing") {
          return { part_id: l.part_id, quantity_needed: l.quantity_needed, urgency: l.urgency, notes: l.notes };
        }
        return {
          part_name: l.part_name,
          sku: l.sku,
          asset_category: l.asset_category,
          make: l.make,
          model_number: l.model_number,
          vendor: l.vendor,
          cost_price: l.cost_price || undefined,
          selling_price: l.selling_price || undefined,
          quantity_needed: l.quantity_needed,
          urgency: l.urgency,
          notes: l.notes,
        };
      });

    try {
      await api.closeTicket(id, {
        resolution_code: "OTHER",
        labor_cost: null,
        parts_used: partLines.filter((l) => l.part_id && l.quantity > 0),
        parts_needed,
        invoice_email: invoiceEmail || undefined,
        tech_notes: techNotes,
        formatted_report: reportAccepted ? formattedReport : techNotes,
      });
      setSuccess(true);
      setTimeout(() => router.push("/tech"), 1800);
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">Work Order</p>
          <p className="text-slate-400 text-xs">Submit service report</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to My Tickets
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
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
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Ticket</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Equipment</p>
                  {ticket.assets && ticket.assets.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {ticket.assets.map((ta) => (
                        <span key={ta.id} className="inline-block px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-700">{ta.asset_name}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="font-medium text-slate-800">{ticket.asset_name}</p>
                  )}
                </div>
                <div><p className="text-slate-400 text-xs">Store</p><p className="font-medium text-slate-800">{ticket.store_name}</p></div>
                <div className="col-span-2"><p className="text-slate-400 text-xs">Symptom</p><p className="font-medium text-slate-800">{SymptomCodeLabels[ticket.symptom_code] ?? ticket.symptom_code}</p></div>
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
                <button
                  type="button" onClick={handleClock} disabled={clockLoading}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 ${timeStatus?.is_clocked_in ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                >
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
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
              </div>
              {images.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-lg py-8 text-center text-slate-400 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <p className="text-sm">Tap to add photos of your work</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
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
                  What did you do? <span className="text-slate-400 font-normal text-xs">(write naturally)</span>
                </label>
                <textarea rows={4} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="e.g. replaced compressor relay, cleaned condenser coils, checked refrigerant level…"
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
                const price = sel ? parseFloat(sel.selling_price || sel.unit_price) : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <PartsCombobox
                      parts={parts}
                      value={line.part_id}
                      onChange={(pid) => setPartLines((prev) => prev.map((l, idx) => idx === i ? { ...l, part_id: pid } : l))}
                      placeholder="Search parts by name, SKU, or make…"
                    />
                    <input type="number" min="1" max={sel?.quantity_on_hand ?? 999}
                      className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.quantity} onChange={(e) => setPartLines((prev) => prev.map((l, idx) => idx === i ? { ...l, quantity: parseInt(e.target.value) || 1 } : l))} />
                    {sel && <span className="text-slate-500 text-sm w-20 text-right shrink-0">${(price * line.quantity).toFixed(2)}</span>}
                    <button type="button" onClick={() => setPartLines((p) => p.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Parts needed */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Parts Needed</p>
                  <p className="text-xs text-slate-400 mt-0.5">Parts to order for a follow-up visit</p>
                </div>
                <button type="button" onClick={() => setNeededLines((p) => [...p, emptyNeededLine()])}
                  className="flex items-center gap-1.5 text-amber-600 text-sm font-medium hover:text-amber-700">
                  <Plus className="w-4 h-4" /> Add Part Needed
                </button>
              </div>
              {neededLines.length === 0 && <p className="text-slate-400 text-sm text-center py-3">No parts needed</p>}
              {neededLines.map((line, i) => (
                <div key={i} className="border border-amber-100 rounded-lg bg-amber-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateNeeded(i, { mode: "existing", part_id: "", part_name_display: "" })}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${line.mode === "existing" ? "bg-amber-500 text-white" : "bg-white border border-amber-300 text-amber-700 hover:bg-amber-100"}`}
                      >
                        From Inventory
                      </button>
                      <button
                        type="button"
                        onClick={() => updateNeeded(i, { mode: "new", part_id: "", part_name_display: "" })}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${line.mode === "new" ? "bg-amber-500 text-white" : "bg-white border border-amber-300 text-amber-700 hover:bg-amber-100"}`}
                      >
                        New Part
                      </button>
                    </div>
                    <button type="button" onClick={() => setNeededLines((p) => p.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {line.mode === "existing" ? (
                    <PartsCombobox
                      parts={parts}
                      value={line.part_id}
                      onChange={(pid, name) => updateNeeded(i, { part_id: pid, part_name_display: name })}
                      placeholder="Search inventory parts…"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="Part name *" value={line.part_name} onChange={(e) => updateNeeded(i, { part_name: e.target.value })} />
                      <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="Make" value={line.make} onChange={(e) => updateNeeded(i, { make: e.target.value })} />
                      <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="Model number" value={line.model_number} onChange={(e) => updateNeeded(i, { model_number: e.target.value })} />
                      <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="SKU" value={line.sku} onChange={(e) => updateNeeded(i, { sku: e.target.value })} />
                      <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="Vendor" value={line.vendor} onChange={(e) => updateNeeded(i, { vendor: e.target.value })} />
                      <select className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        value={line.asset_category} onChange={(e) => updateNeeded(i, { asset_category: e.target.value })}>
                        <option value="">Equipment category (optional)</option>
                        {Object.entries(AssetCategoryLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Qty</label>
                      <input type="number" min="1"
                        className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        value={line.quantity_needed} onChange={(e) => updateNeeded(i, { quantity_needed: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Urgency</label>
                      <select className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        value={line.urgency} onChange={(e) => updateNeeded(i, { urgency: e.target.value as "ASAP" | "NEXT_VISIT" })}>
                        <option value="NEXT_VISIT">Next Visit</option>
                        <option value="ASAP">ASAP</option>
                      </select>
                    </div>
                  </div>
                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Notes (optional)" value={line.notes} onChange={(e) => updateNeeded(i, { notes: e.target.value })} />
                </div>
              ))}
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
                {totalMinutes === 0 && <p className="text-amber-600 text-xs">No time tracked — minimum 1 hour will be billed</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50" onClick={() => router.back()}>Cancel</button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Close & Generate Invoice
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
