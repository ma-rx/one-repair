"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { api, Ticket } from "@/lib/api";
import {
  ArrowLeft, Receipt, Send, Loader2, CheckCircle2,
  Mail, AlertCircle, Plus, X,
} from "lucide-react";

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  DUE_ON_RECEIPT: "Due on Receipt",
  NET_15: "Net 15",
  NET_30: "Net 30",
  NET_45: "Net 45",
};

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [ticket,   setTicket]   = useState<Ticket | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [extraEmail, setExtraEmail] = useState("");
  const [extraEmails, setExtraEmails] = useState<string[]>([]);

  useEffect(() => {
    api.getTicket(id)
      .then(setTicket)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const report = ticket?.service_reports?.[0];

  function addExtraEmail() {
    const e = extraEmail.trim();
    if (e && !extraEmails.includes(e)) {
      setExtraEmails((prev) => [...prev, e]);
    }
    setExtraEmail("");
  }

  async function handleSend() {
    setSending(true);
    setError("");
    try {
      const res = await api.sendInvoice(id, extraEmails);
      setPaymentUrl(res.payment_url || "");
      setTicket(res.ticket);
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send invoice.");
    } finally {
      setSending(false);
    }
  }

  return (
    <DashboardShell>
      <div className="max-w-xl mx-auto space-y-5">
        <Link href={`/dispatch/${id}`} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Ticket
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error && !ticket ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : ticket && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Send Invoice</h1>
                <p className="text-slate-500 text-sm">Ticket {ticket.ticket_number} — {ticket.store_name}</p>
              </div>
            </div>

            {sent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="font-semibold text-emerald-800">Invoice sent!</p>
                <p className="text-emerald-600 text-sm">The PDF invoice has been emailed to the client.</p>
                {paymentUrl && (
                  <a href={paymentUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                    View payment link
                  </a>
                )}
                <button
                  onClick={() => router.push(`/dispatch/${id}`)}
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Back to Ticket
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                  </div>
                )}

                {/* Service summary */}
                {report && (
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Service Summary</p>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Asset</span>
                        <span className="font-medium text-slate-800">{ticket.asset_name}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Tech</span>
                        <span className="font-medium text-slate-800">{ticket.assigned_tech_name ?? "—"}</span>
                      </div>
                      {ticket.completed_at && (
                        <div className="flex justify-between text-slate-600">
                          <span>Service Date</span>
                          <span className="font-medium text-slate-800">{new Date(ticket.completed_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Line items */}
                    <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
                      {parseFloat(report.labor_cost) > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Labor</span>
                          <span>${parseFloat(report.labor_cost).toFixed(2)}</span>
                        </div>
                      )}
                      {report.parts_used?.map((p) => (
                        <div key={p.id} className="flex justify-between text-slate-600">
                          <span>{p.part_name} × {p.quantity}</span>
                          <span>${parseFloat(p.line_total).toFixed(2)}</span>
                        </div>
                      ))}
                      {parseFloat(report.sales_tax) > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>Tax ({report.tax_rate}%)</span>
                          <span>${parseFloat(report.sales_tax).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
                        <span>Total Due</span>
                        <span>${parseFloat(report.grand_total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recipient emails */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">Send To</p>
                  </div>

                  {/* Org invoice emails */}
                  {(ticket as Ticket & { org_invoice_emails?: string[] }).org_invoice_emails?.length === 0 && extraEmails.length === 0 && (
                    <p className="text-amber-600 text-xs bg-amber-50 rounded-lg px-3 py-2">
                      No invoice emails configured for this organization. Add them below or in the Organization settings.
                    </p>
                  )}

                  {/* Extra emails */}
                  <div className="space-y-1.5">
                    {extraEmails.map((e) => (
                      <div key={e} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 text-sm">
                        <span className="flex-1 text-slate-700">{e}</span>
                        <button type="button" onClick={() => setExtraEmails((prev) => prev.filter((x) => x !== e))}>
                          <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Add recipient email…"
                      value={extraEmail}
                      onChange={(e) => setExtraEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExtraEmail())}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="button" onClick={addExtraEmail}
                      className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Invoice will also be sent to emails configured on the organization. Stripe payment link included if configured.
                  </p>
                </div>

                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Sending…" : "Send Invoice"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
