"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { api, Part, Ticket, TimeEntryStatus } from "@/lib/api";
import { ResolutionCodeLabels } from "@/types/enums";
import {
  AlertCircle, CheckCircle2, ChevronDown, FileText, Loader2, Plus, Send, Trash2, X,
} from "lucide-react";

interface PartLine { part_id: string; quantity: number }

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function calcLabor(totalMin: number, pricing: { trip_charge: string; hourly_rate: string; min_hours: string }) {
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
  onChange: (id: string) => void;
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
            onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}
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
                onClick={() => { onChange(p.id); setOpen(false); setSearch(""); }}
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

export default function AdminInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [timeStatus, setTimeStatus] = useState<TimeEntryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Invoice fields (pre-populated from draft service report if exists)
  const [resolutionCode, setResolutionCode] = useState("OTHER");
  const [laborCost, setLaborCost] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [techNotes, setTechNotes] = useState("");
  const [formattedReport, setFormattedReport] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [partLines, setPartLines] = useState<PartLine[]>([]);

  useEffect(() => {
    Promise.all([
      api.getTicket(id),
      api.listParts(),
      api.getTimeEntry(id),
    ]).then(([t, ps, ts]) => {
      setTicket(t);
      setParts(ps);
      setTimeStatus(ts);

      // Pre-populate from existing service report if present
      const report = t.service_reports?.[0];
      if (report) {
        setResolutionCode(report.resolution_code || "OTHER");
        setLaborCost(report.labor_cost || "");
        setTaxRate(report.tax_rate || "0");
        setTechNotes(report.tech_notes || "");
        setFormattedReport(report.formatted_report || "");
        setInvoiceEmail(report.invoice_email || "");
        // Pre-populate parts from draft_parts
        if (report.draft_parts?.length) {
          setPartLines(report.draft_parts.map((dp: { part_id: string; quantity: number }) => ({
            part_id: dp.part_id,
            quantity: dp.quantity,
          })));
        } else if (report.parts_used?.length) {
          setPartLines(report.parts_used.map((pu) => ({
            part_id: pu.part,
            quantity: pu.quantity,
          })));
        }
      } else {
        // Default tax rate from pricing config
        const pricing = ts?.pricing as { tax_rate?: string } | undefined;
        setTaxRate(pricing?.tax_rate || "0");
        // Auto-set labor from time entries
        if (ts) {
          const lc = calcLabor(ts.total_minutes, ts.pricing);
          setLaborCost(lc.toFixed(2));
        }
      }
    })
    .catch(() => setError("Failed to load ticket data."))
    .finally(() => setLoading(false));
  }, [id]);

  function calcPartsTotal() {
    return partLines.reduce((sum, line) => {
      const part = parts.find((p) => p.id === line.part_id);
      return sum + (part ? parseFloat(part.selling_price || part.unit_price) * line.quantity : 0);
    }, 0);
  }

  const partsTotal = calcPartsTotal();
  const labor = parseFloat(laborCost) || 0;
  const tax = (partsTotal + labor) * (parseFloat(taxRate) || 0) / 100;
  const grandTotal = partsTotal + labor + tax;

  async function handleGenerate() {
    if (!confirm("Generate and send invoice? This will close the ticket.")) return;
    setSubmitting(true); setError(null);
    try {
      await api.generateInvoice(id, {
        resolution_code: resolutionCode,
        labor_cost: parseFloat(laborCost) || null,
        tax_rate: parseFloat(taxRate) || 0,
        parts_used: partLines.filter((l) => l.part_id && l.quantity > 0),
        invoice_email: invoiceEmail || undefined,
        tech_notes: techNotes,
        formatted_report: formattedReport || techNotes,
      });
      setSuccess(true);
      setTimeout(() => router.push(`/dispatch/${id}`), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  const RESOLUTION_OPTIONS = Object.entries(ResolutionCodeLabels);
  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Review &amp; Generate Invoice</h1>
          <p className="text-slate-500 text-sm mt-0.5">Review the tech&apos;s service report, adjust as needed, then send the invoice</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : !ticket ? (
          <div className="py-12 text-center text-red-500">Ticket not found.</div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Invoice generated! Redirecting…
              </div>
            )}

            {/* Ticket summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Ticket Summary</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Equipment</p>
                  <p className="font-medium text-slate-800">{ticket.asset_name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Store</p>
                  <p className="font-medium text-slate-800">{ticket.store_name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Tech</p>
                  <p className="font-medium text-slate-800">{ticket.assigned_tech_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Status</p>
                  <p className="font-medium text-slate-800">{ticket.status}</p>
                </div>
                {timeStatus && timeStatus.total_minutes > 0 && (
                  <div>
                    <p className="text-slate-400 text-xs">Time on Site</p>
                    <p className="font-medium text-slate-800">{formatMinutes(timeStatus.total_minutes)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Service details */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Service Details</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Resolution Code</label>
                <select className={inputClass} value={resolutionCode} onChange={(e) => setResolutionCode(e.target.value)}>
                  {RESOLUTION_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tech Notes</label>
                <textarea rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={techNotes} onChange={(e) => setTechNotes(e.target.value)} placeholder="Tech's notes from the job…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Formatted Report <span className="text-slate-400 text-xs font-normal">(appears on invoice)</span></label>
                <textarea rows={4} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={formattedReport} onChange={(e) => setFormattedReport(e.target.value)} placeholder="Report text that appears on the customer invoice…" />
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
                const price = sel ? parseFloat(sel.selling_price || sel.unit_price) : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <PartsCombobox
                      parts={parts}
                      value={line.part_id}
                      onChange={(pid) => setPartLines((prev) => prev.map((l, idx) => idx === i ? { ...l, part_id: pid } : l))}
                      placeholder="Search parts…"
                    />
                    <input type="number" min="1"
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

            {/* Pricing */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Pricing</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Labor Cost ($)</label>
                  <input type="number" min="0" step="0.01" className={inputClass}
                    value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Tax (%)</label>
                  <input type="number" min="0" step="0.01" max="100" className={inputClass}
                    value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500"><span>Parts subtotal</span><span>${partsTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Labor</span><span>${labor.toFixed(2)}</span></div>
                {parseFloat(taxRate) > 0 && (
                  <div className="flex justify-between text-slate-500"><span>Sales Tax ({taxRate}%)</span><span>${tax.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-slate-200">
                  <span>Total Due</span><span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Invoice delivery */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Invoice Delivery</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Send to Email <span className="text-slate-400 text-xs font-normal">(leave blank to generate PDF only)</span>
                </label>
                <input type="email" className={inputClass}
                  placeholder="client@example.com" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 pb-8">
              <button type="button" className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50" onClick={() => router.back()}>Cancel</button>
              <button type="button" onClick={handleGenerate} disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (invoiceEmail ? <Send className="w-4 h-4" /> : <FileText className="w-4 h-4" />)}
                {invoiceEmail ? "Generate & Send Invoice" : "Generate Invoice"}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
