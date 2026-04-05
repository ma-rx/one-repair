"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { api, Part, Ticket, WorkImage } from "@/lib/api";
import {
  ArrowLeft, Receipt, Send, Loader2, CheckCircle2,
  Mail, AlertCircle, Plus, X, Eye, Trash2, ChevronDown, ImageOff,
} from "lucide-react";

type Step = "edit" | "preview";

type PartLine = {
  id?: string;       // existing PartUsed id
  part_id?: string;  // inventory Part id (new, to deduct stock)
  part_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
};

// ── Parts search combobox ─────────────────────────────────────────────────────
function PartsCombobox({
  parts,
  onSelect,
}: {
  parts: Part[];
  onSelect: (part: Part) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = search.length > 0
    ? parts.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.make.toLowerCase().includes(search.toLowerCase())
      )
    : parts.slice(0, 8);

  return (
    <div ref={ref} className="relative flex-1">
      <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus-within:ring-2 focus-within:ring-blue-500">
        <input
          className="flex-1 outline-none bg-transparent text-slate-800 placeholder-slate-400"
          placeholder="Search inventory parts…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No results</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                onClick={() => { onSelect(p); setSearch(""); setOpen(false); }}
              >
                <p className="font-medium text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {p.sku && `SKU: ${p.sku} · `}
                  stock: {p.quantity_on_hand} · ${p.selling_price}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [ticket,     setTicket]     = useState<Ticket | null>(null);
  const [allParts,   setAllParts]   = useState<Part[]>([]);
  const [images,     setImages]     = useState<WorkImage[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [step,       setStep]       = useState<Step>("edit");

  // Editable invoice fields
  const [tripCharge,      setTripCharge]      = useState("0");
  const [laborCost,       setLaborCost]       = useState("0");
  const [taxRate,         setTaxRate]         = useState("0");
  const [formattedReport, setFormattedReport] = useState("");
  const [parts,           setParts]           = useState<PartLine[]>([]);

  // Add-part row state
  const [newPart, setNewPart] = useState<PartLine>({ part_name: "", sku: "", quantity: 1, unit_price: 0 });

  // Email recipients
  const [extraEmail,  setExtraEmail]  = useState("");
  const [extraEmails, setExtraEmails] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([api.getTicket(id), api.listParts(), api.getWorkImages(id), api.getPricing()])
      .then(([t, ps, imgs, pricing]) => {
        setTicket(t);
        setAllParts(ps);
        setImages(imgs);
        const report = t.service_reports?.[0];
        if (report) {
          const tc = parseFloat(report.trip_charge ?? "0");
          const lc = parseFloat(report.labor_cost ?? "0");
          // If both are 0 (e.g. pre-migration combined report or blank test), fall back to pricing defaults
          if (tc === 0 && lc === 0 && pricing) {
            setTripCharge(pricing.trip_charge ?? "0");
            const minHours = parseFloat(pricing.min_hours ?? "1");
            setLaborCost((minHours * parseFloat(pricing.hourly_rate ?? "0")).toFixed(2));
          } else {
            setTripCharge(report.trip_charge ?? "0");
            setLaborCost(report.labor_cost ?? "0");
          }
          // Use saved tax rate if already set, otherwise fall back to store/global default
          const savedTax = parseFloat(report.tax_rate ?? "0");
          setTaxRate(savedTax > 0 ? report.tax_rate : (t.default_tax_rate ?? "0"));
          setFormattedReport(report.formatted_report ?? "");

          // Prefer proper PartUsed records; fall back to draft_parts when the tech
          // used save-progress (which never creates PartUsed records).
          let lineParts: PartLine[];
          if ((report.parts_used ?? []).length > 0) {
            lineParts = report.parts_used.map((p) => ({
              id: p.id,
              part_id: p.part,
              part_name: p.part_name,
              sku: p.part_sku ?? "",
              quantity: p.quantity,
              unit_price: parseFloat(p.unit_price_at_time),
            }));
          } else if ((report.draft_parts ?? []).length > 0) {
            // draft_parts now include name/sku/price from the backend
            lineParts = report.draft_parts.map((dp) => {
              const inv = ps.find((p) => p.id === dp.part_id);
              return {
                part_id: dp.part_id,
                part_name: dp.part_name ?? inv?.name ?? dp.part_id,
                sku: dp.part_sku ?? inv?.sku ?? "",
                quantity: dp.quantity,
                unit_price: parseFloat(dp.unit_price ?? inv?.selling_price ?? inv?.unit_price ?? "0"),
              };
            });
          } else {
            lineParts = [];
          }

          const extraParts: PartLine[] = (report.extra_line_items ?? []).map((p) => ({
            part_name: p.name,
            sku: p.sku ?? "",
            quantity: p.quantity,
            unit_price: p.unit_price,
          }));
          setParts([...lineParts, ...extraParts]);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-calculated totals
  const tripNum    = parseFloat(tripCharge) || 0;
  const laborNum   = parseFloat(laborCost) || 0;
  const taxNum     = parseFloat(taxRate) || 0;
  const partsTotal = parts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
  const salesTax   = partsTotal * taxNum / 100;   // tax on parts only
  const grandTotal = tripNum + laborNum + partsTotal + salesTax;

  function selectInventoryPart(part: Part) {
    setNewPart({
      part_id: part.id,
      part_name: part.name,
      sku: part.sku ?? "",
      quantity: 1,
      unit_price: parseFloat(part.selling_price || part.unit_price),
    });
  }

  function addPart() {
    if (!newPart.part_name.trim()) return;
    setParts((prev) => [...prev, { ...newPart }]);
    setNewPart({ part_name: "", sku: "", quantity: 1, unit_price: 0 });
  }

  function updatePart(idx: number, field: keyof PartLine, value: string | number) {
    setParts((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function removePart(idx: number) {
    setParts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function deleteImage(imgId: string) {
    try {
      await api.deleteWorkImage(imgId);
      setImages((prev) => prev.filter((img) => img.id !== imgId));
    } catch {
      // silently ignore
    }
  }

  function addExtraEmail() {
    const e = extraEmail.trim();
    if (e && !extraEmails.includes(e)) setExtraEmails((prev) => [...prev, e]);
    setExtraEmail("");
  }

  function buildOverrides() {
    // Parts with an existing PartUsed id → update qty/price
    const existingParts = parts
      .filter((p) => p.id)
      .map((p) => ({ id: p.id!, quantity: p.quantity, unit_price: p.unit_price }));

    // Parts with a part_id but no PartUsed id → newly added from inventory (deduct stock)
    const newInventoryParts = parts
      .filter((p) => !p.id && p.part_id)
      .map((p) => ({ part_id: p.part_id!, quantity: p.quantity, unit_price: p.unit_price }));

    // Parts with neither id → custom free-text line items
    const customParts = parts
      .filter((p) => !p.id && !p.part_id)
      .map((p) => ({ name: p.part_name, sku: p.sku, quantity: p.quantity, unit_price: p.unit_price }));

    return {
      trip_charge: tripCharge,
      labor_cost: laborCost,
      tax_rate: taxRate,
      formatted_report: formattedReport,
      parts_used: existingParts,
      new_inventory_parts: newInventoryParts,
      extra_line_items: customParts,
    };
  }

  async function handleSend() {
    setSending(true);
    setError("");
    try {
      const res = await api.sendInvoice(id, extraEmails, buildOverrides());
      setPaymentUrl(res.payment_url || "");
      setTicket(res.ticket);
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send invoice.");
      setStep("edit");
    } finally {
      setSending(false);
    }
  }

  const report = ticket?.service_reports?.[0];
  const orgInvoiceEmails = ticket?.org_invoice_emails ?? [];

  if (loading) return (
    <DashboardShell>
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
      </div>
    </DashboardShell>
  );

  if (error && !ticket) return (
    <DashboardShell>
      <div className="py-12 text-center text-red-500">{error}</div>
    </DashboardShell>
  );

  if (!ticket) return null;

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (sent) return (
    <DashboardShell>
      <div className="max-w-xl mx-auto space-y-5 pt-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="font-bold text-emerald-800 text-lg">Invoice sent!</p>
          <p className="text-emerald-600 text-sm">PDF invoice emailed to the client.</p>
          {paymentUrl && (
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
              View payment link
            </a>
          )}
          <button onClick={() => router.push(`/dispatch/${id}`)}
            className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            Back to Ticket
          </button>
        </div>
      </div>
    </DashboardShell>
  );

  // ── PREVIEW ───────────────────────────────────────────────────────────────────
  if (step === "preview") return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <button onClick={() => setStep("edit")}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Edit
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Invoice Preview</h1>
            <p className="text-slate-500 text-sm">Review before sending</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {/* Invoice Preview Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6 text-sm">
          <div className="flex items-start justify-between border-b border-slate-100 pb-5">
            <div>
              <p className="font-bold text-slate-900 text-lg">SERVICE INVOICE</p>
              <p className="text-slate-500 text-xs mt-1">Invoice # {ticket.ticket_number}</p>
              {ticket.completed_at && (
                <p className="text-slate-500 text-xs">Date: {new Date(ticket.completed_at).toLocaleDateString()}</p>
              )}
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-semibold text-slate-800">One Repair Solutions</p>
              {ticket.assigned_tech_name && <p>Tech: {ticket.assigned_tech_name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wide mb-1">Billed To</p>
              <p className="font-medium text-slate-800">{ticket.store_name}</p>
              {ticket.store_address && <p className="text-slate-500">{ticket.store_address}</p>}
            </div>
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wide mb-1">Service Location</p>
              <p className="font-medium text-slate-800">{ticket.store_name}</p>
              {ticket.store_address && <p className="text-slate-500">{ticket.store_address}</p>}
            </div>
          </div>

          {ticket.asset_name && (
            <div className="text-xs">
              <p className="font-semibold text-slate-500 uppercase tracking-wide mb-1">Asset</p>
              <p className="font-medium text-slate-800">{ticket.asset_name}</p>
              {ticket.asset_make && <p className="text-slate-500">{ticket.asset_make} {ticket.asset_model_number}</p>}
            </div>
          )}

          {formattedReport && (
            <div className="text-xs">
              <p className="font-semibold text-slate-500 uppercase tracking-wide mb-1">Service Summary</p>
              <p className="text-slate-700 whitespace-pre-wrap">{formattedReport}</p>
            </div>
          )}

          {report?.manager_on_site && (
            <div className="text-xs border-t border-slate-100 pt-4">
              <p className="font-semibold text-slate-500 uppercase tracking-wide mb-1">Manager Authorization</p>
              <p className="text-slate-700">{report.manager_on_site}</p>
              {report.manager_signature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={report.manager_signature} alt="Signature" className="mt-1 max-h-10 border border-slate-200 rounded bg-white p-0.5" />
              )}
            </div>
          )}

          {parts.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="text-left px-3 py-2">Part</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Unit Price</th>
                  <th className="text-right px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                    <td className="px-3 py-2 text-slate-700">{p.part_name}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{p.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-600">${p.unit_price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">${(p.quantity * p.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="space-y-1 text-xs border-t border-slate-100 pt-4">
            {partsTotal > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Parts Subtotal</span><span>${partsTotal.toFixed(2)}</span>
              </div>
            )}
            {tripNum > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Trip Charge</span><span>${tripNum.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Labor</span><span>${laborNum.toFixed(2)}</span>
            </div>
            {salesTax > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Tax ({taxRate}% on parts)</span><span>${salesTax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 text-sm">
              <span>TOTAL DUE</span><span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <p className="font-medium text-slate-700">Sending to</p>
          </div>
          {[...orgInvoiceEmails, ...extraEmails].length === 0 ? (
            <p className="text-amber-600 text-xs">No recipients configured.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...orgInvoiceEmails, ...extraEmails].map((e) => (
                <span key={e} className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-lg">{e}</span>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleSend} disabled={sending}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Confirm & Send Invoice"}
        </button>
      </div>
    </DashboardShell>
  );

  // ── EDIT ──────────────────────────────────────────────────────────────────────
  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href={`/dispatch/${id}`}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Ticket
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create Invoice</h1>
            <p className="text-slate-500 text-sm">Ticket {ticket.ticket_number} — {ticket.store_name}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {/* ── Ticket Info ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Ticket Info</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Ticket #</span>
              <span className="font-medium text-slate-800">{ticket.ticket_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="font-medium text-slate-800">{ticket.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Store</span>
              <span className="font-medium text-slate-800">{ticket.store_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Asset</span>
              <span className="font-medium text-slate-800">{ticket.asset_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tech</span>
              <span className="font-medium text-slate-800">{ticket.assigned_tech_name ?? "—"}</span>
            </div>
            {ticket.completed_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">Service Date</span>
                <span className="font-medium text-slate-800">{new Date(ticket.completed_at).toLocaleDateString()}</span>
              </div>
            )}
            {ticket.store_address && (
              <div className="col-span-2 flex justify-between">
                <span className="text-slate-500">Address</span>
                <span className="font-medium text-slate-800 text-right">{ticket.store_address}</span>
              </div>
            )}
            {ticket.description && (
              <div className="col-span-2 flex justify-between">
                <span className="text-slate-500">Issue</span>
                <span className="font-medium text-slate-800 text-right">{ticket.description}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Tech Report ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Tech Report</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Service Summary <span className="text-slate-400 font-normal">(appears on invoice)</span>
            </label>
            <textarea
              rows={5}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={formattedReport}
              onChange={(e) => setFormattedReport(e.target.value)}
              placeholder="Describe the work performed…"
            />
          </div>
        </div>

        {/* ── Manager Authorization ── */}
        {report?.manager_on_site && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Manager Authorization</p>
            <p className="text-sm text-slate-700">
              <span className="font-medium">On site:</span> {report.manager_on_site}
            </p>
            {report.manager_signature && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Signature</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.manager_signature}
                  alt="Manager signature"
                  className="max-h-16 border border-slate-200 rounded bg-white p-1"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Work Photos ── */}
        {images.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
              Work Photos <span className="text-slate-300">({images.length} — will be attached to invoice email)</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt="Work photo"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => deleteImage(img.id)}
                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Invoice Fields ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Invoice</p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Trip Charge ($)</label>
              <input type="number" min="0" step="0.01"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={tripCharge}
                onChange={(e) => setTripCharge(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Labor ($)</label>
              <input type="number" min="0" step="0.01"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tax Rate (% parts)</label>
              <input type="number" min="0" step="0.01" max="100"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
          </div>

          {/* Parts */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Parts & Line Items</p>

            {/* Existing parts table */}
            {parts.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Name</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-medium w-16">Qty</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-medium w-24">Unit $</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-medium w-24">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((p, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <input
                              className="w-full bg-transparent text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                              value={p.part_name}
                              onChange={(e) => updatePart(i, "part_name", e.target.value)}
                            />
                            {p.id && (
                              <span className="text-slate-300 text-xs shrink-0" title="From service report">●</span>
                            )}
                            {!p.id && p.part_id && (
                              <span className="text-blue-300 text-xs shrink-0" title="From inventory">●</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="1"
                            className="w-full bg-transparent text-slate-700 text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                            value={p.quantity}
                            onChange={(e) => updatePart(i, "quantity", parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01"
                            className="w-full bg-transparent text-slate-700 text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                            value={p.unit_price}
                            onChange={(e) => updatePart(i, "unit_price", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          ${(p.quantity * p.unit_price).toFixed(2)}
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => removePart(i)} className="text-slate-300 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add part row */}
            <div className="border border-dashed border-slate-300 rounded-lg p-3 space-y-2 bg-slate-50">
              <p className="text-xs text-slate-400 font-medium">Add a part</p>
              <div className="flex gap-2 items-start">
                <PartsCombobox parts={allParts} onSelect={selectInventoryPart} />
              </div>
              {/* Show filled name when inventory part selected, or let user type custom */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <input placeholder="Part / item name (or select above)"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newPart.part_name}
                    onChange={(e) => setNewPart((p) => ({ ...p, part_name: e.target.value, part_id: undefined }))}
                    onKeyDown={(e) => e.key === "Enter" && addPart()}
                  />
                </div>
                <div className="col-span-2">
                  <input type="number" min="1" placeholder="Qty"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newPart.quantity}
                    onChange={(e) => setNewPart((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="col-span-3">
                  <input type="number" min="0" step="0.01" placeholder="Unit $"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newPart.unit_price || ""}
                    onChange={(e) => setNewPart((p) => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="col-span-2">
                  <button onClick={addPart}
                    className="w-full flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
              {newPart.part_id && (
                <p className="text-xs text-blue-600">
                  From inventory · stock will be deducted on send
                </p>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
            {partsTotal > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Parts Subtotal</span><span>${partsTotal.toFixed(2)}</span>
              </div>
            )}
            {tripNum > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Trip Charge</span><span>${tripNum.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Labor</span><span>${laborNum.toFixed(2)}</span>
            </div>
            {salesTax > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Tax ({taxRate}% on parts)</span><span>${salesTax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
              <span>Total Due</span><span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ── Recipients ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Send To</p>
          </div>

          {orgInvoiceEmails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {orgInvoiceEmails.map((e) => (
                <span key={e} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-lg">{e}</span>
              ))}
            </div>
          )}

          {orgInvoiceEmails.length === 0 && extraEmails.length === 0 && (
            <p className="text-amber-600 text-xs bg-amber-50 rounded-lg px-3 py-2">
              No invoice emails configured. Add them below or in Organization settings.
            </p>
          )}

          <div className="space-y-1.5">
            {extraEmails.map((e) => (
              <div key={e} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 text-sm">
                <span className="flex-1 text-slate-700">{e}</span>
                <button onClick={() => setExtraEmails((prev) => prev.filter((x) => x !== e))}>
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input type="email" placeholder="Add recipient email…"
              value={extraEmail}
              onChange={(e) => setExtraEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExtraEmail())}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={addExtraEmail}
              className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        <button onClick={() => setStep("preview")}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
          <Eye className="w-4 h-4" /> Preview Invoice
        </button>
      </div>
    </DashboardShell>
  );
}
