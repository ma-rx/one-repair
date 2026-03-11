"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { api, Part, Ticket } from "@/lib/api";
import { ResolutionCodeLabels, SymptomCodeLabels } from "@/types/enums";
import { Loader2, AlertCircle, CheckCircle2, Plus, Trash2, FileText } from "lucide-react";

interface PartLine {
  part_id: string;
  quantity: number;
}

export default function CloseTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [resolutionCode, setResolutionCode] = useState("");
  const [laborCost, setLaborCost] = useState("0");
  const [partLines, setPartLines] = useState<PartLine[]>([]);
  const [invoiceEmail, setInvoiceEmail] = useState("");

  useEffect(() => {
    Promise.all([api.getTicket(id), api.listParts()])
      .then(([t, ps]) => { setTicket(t); setParts(ps); })
      .catch(() => setError("Failed to load ticket or parts."))
      .finally(() => setLoading(false));
  }, [id]);

  function addPartLine() {
    setPartLines((prev) => [...prev, { part_id: "", quantity: 1 }]);
  }

  function removePartLine(i: number) {
    setPartLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updatePartLine(i: number, field: keyof PartLine, value: string | number) {
    setPartLines((prev) =>
      prev.map((line, idx) => (idx === i ? { ...line, [field]: value } : line))
    );
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
    const validLines = partLines.filter((l) => l.part_id && l.quantity > 0);
    setSubmitting(true);
    setError(null);
    try {
      await api.closeTicket(id, {
        resolution_code: resolutionCode,
        labor_cost: parseFloat(laborCost) || 0,
        parts_used: validLines,
        invoice_email: invoiceEmail || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.push("/dispatch"), 1800);
    } catch (err: any) {
      setError(err.message || "Failed to close ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  const grandTotal = calcPartsTotal() + (parseFloat(laborCost) || 0);

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Close Ticket</h1>
          <p className="text-slate-500 text-sm mt-0.5">Submit a service report to close this ticket</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && ticket && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Ticket closed! Invoice generated. Redirecting…
              </div>
            )}

            {/* Ticket summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Ticket Summary</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Asset</p>
                  <p className="font-medium text-slate-800">{ticket.asset_name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Store</p>
                  <p className="font-medium text-slate-800">{ticket.store_name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Symptom</p>
                  <p className="font-medium text-slate-800">
                    {SymptomCodeLabels[ticket.symptom_code] ?? ticket.symptom_code}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Assigned Tech</p>
                  <p className="font-medium text-slate-800">{ticket.assigned_tech_name ?? "Unassigned"}</p>
                </div>
              </div>
            </div>

            {/* Resolution */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Service Report</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Resolution Code <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={resolutionCode}
                  onChange={(e) => setResolutionCode(e.target.value)}
                  required
                >
                  <option value="">Select resolution...</option>
                  {Object.entries(ResolutionCodeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Labor Cost ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                />
              </div>
            </div>

            {/* Parts used */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Parts Used</p>
                <button
                  type="button"
                  onClick={addPartLine}
                  className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" /> Add Part
                </button>
              </div>

              {partLines.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-3">No parts added</p>
              )}

              {partLines.map((line, i) => {
                const selectedPart = parts.find((p) => p.id === line.part_id);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <select
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={line.part_id}
                      onChange={(e) => updatePartLine(i, "part_id", e.target.value)}
                      required
                    >
                      <option value="">Select part...</option>
                      {parts.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.quantity_on_hand === 0}>
                          {p.name} (qty: {p.quantity_on_hand}) — ${p.unit_price}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      max={selectedPart?.quantity_on_hand ?? 999}
                      className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={line.quantity}
                      onChange={(e) => updatePartLine(i, "quantity", parseInt(e.target.value) || 1)}
                    />
                    {selectedPart && (
                      <span className="text-slate-500 text-sm w-20 text-right shrink-0">
                        ${(parseFloat(selectedPart.unit_price) * line.quantity).toFixed(2)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePartLine(i)}
                      className="text-slate-400 hover:text-red-500"
                    >
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
                  Send Invoice to Email <span className="text-slate-400 text-xs font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="client@example.com"
                  value={invoiceEmail}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                />
              </div>

              {/* Totals */}
              <div className="border-t border-slate-100 pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Parts subtotal</span>
                  <span>${calcPartsTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Labor</span>
                  <span>${(parseFloat(laborCost) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-slate-200">
                  <span>Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50"
                onClick={() => router.back()}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!resolutionCode || submitting}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileText className="w-4 h-4" />}
                Close & Generate Invoice
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
