"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import { api, ServiceReport, WorkImage } from "@/lib/api";
import { Loader2, Download, CreditCard, CheckCircle2, ArrowLeft, User } from "lucide-react";

export default function PortalInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [report, setReport]           = useState<ServiceReport | null>(null);
  const [images, setImages]           = useState<WorkImage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [paying, setPaying]           = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.getServiceReport(id)
      .then((r) => {
        setReport(r);
        return api.getWorkImages(r.ticket);
      })
      .then(setImages)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePay() {
    if (!report) return;
    setPaying(true);
    try {
      const { payment_url } = await api.createPaymentSession(id);
      window.location.href = payment_url;
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("already_paid")) {
        setReport({ ...report, ticket_status: "PAID" });
      } else {
        alert(e instanceof Error ? e.message : "Payment failed.");
      }
      setPaying(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try { await api.downloadInvoicePDF(id); } catch { /* ignore */ } finally { setDownloading(false); }
  }

  const isPaid     = report?.ticket_status === "PAID";
  const tripCharge = parseFloat(report?.trip_charge  || "0");
  const laborCost  = parseFloat(report?.labor_cost   || "0");
  const partsTotal = parseFloat(report?.parts_total  || "0");
  const salesTax   = parseFloat(report?.sales_tax    || "0");
  const grandTotal = parseFloat(report?.grand_total  || "0");

  return (
    <PortalShell>
      <div className="max-w-3xl mx-auto">

        {/* Nav + actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/portal/invoices" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-slate-900">
              Invoice {report?.ticket_number || id.slice(0, 8).toUpperCase()}
            </h1>
          </div>

          {!loading && report && (
            <div className="flex items-center gap-3">
              {isPaid ? (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Paid
                </span>
              ) : (
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm disabled:opacity-60"
                >
                  {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {paying ? "Redirecting…" : `Pay $${grandTotal.toFixed(2)}`}
                </button>
              )}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : report ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

            {/* Header */}
            <div className="bg-slate-800 px-8 py-6 flex items-start justify-between">
              <div>
                <p className="text-white font-bold text-lg">One Repair Solutions</p>
                <p className="text-slate-400 text-sm mt-0.5">Field Service Management</p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-xl">INVOICE</p>
                <p className="text-blue-300 font-mono text-sm mt-1">#{report.ticket_number || id.slice(0, 8).toUpperCase()}</p>
                {isPaid
                  ? <span className="inline-block mt-2 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">Paid</span>
                  : <span className="inline-block mt-2 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">Payment Due</span>
                }
              </div>
            </div>

            {/* Meta */}
            <div className="px-8 py-5 border-b border-slate-100 grid grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Invoice Date</p>
                <p className="text-slate-800 font-medium">
                  {new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              {report.asset_name && (
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Equipment</p>
                  <p className="text-slate-800 font-medium">{report.asset_name}</p>
                </div>
              )}
              {report.store_name && (
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Location</p>
                  <p className="text-slate-800 font-medium">{report.store_name}</p>
                </div>
              )}
            </div>

            {/* Line items */}
            <div className="px-8 py-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-400 font-medium text-xs uppercase tracking-wide">Description</th>
                    <th className="text-right py-2 text-slate-400 font-medium text-xs uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tripCharge > 0 && (
                    <tr>
                      <td className="py-3 text-slate-700">Field Service Call</td>
                      <td className="py-3 text-right text-slate-800">${tripCharge.toFixed(2)}</td>
                    </tr>
                  )}
                  {laborCost > 0 && (
                    <tr>
                      <td className="py-3 text-slate-700">Labor</td>
                      <td className="py-3 text-right text-slate-800">${laborCost.toFixed(2)}</td>
                    </tr>
                  )}
                  {report.parts_used?.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 text-slate-700">
                        {p.part_name || "Part"}
                        {p.part_sku && <span className="text-slate-400 text-xs ml-2">#{p.part_sku}</span>}
                        <span className="text-slate-400 text-xs ml-2">× {p.quantity}</span>
                      </td>
                      <td className="py-3 text-right text-slate-800">
                        ${(parseFloat(String(p.unit_price_at_time || 0)) * p.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {report.extra_line_items?.map((li, i) => (
                    <tr key={i}>
                      <td className="py-3 text-slate-700">
                        {li.name}
                        <span className="text-slate-400 text-xs ml-2">× {li.quantity}</span>
                      </td>
                      <td className="py-3 text-right text-slate-800">${(li.unit_price * li.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-8 pb-6">
              <div className="ml-auto w-64 space-y-2 text-sm border-t border-slate-100 pt-4">
                {partsTotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Parts Subtotal</span>
                    <span>${partsTotal.toFixed(2)}</span>
                  </div>
                )}
                {salesTax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Sales Tax ({report.tax_rate}%)</span>
                    <span>${salesTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2 mt-2">
                  <span>Balance Due</span>
                  <span className={isPaid ? "text-emerald-600" : "text-blue-600"}>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Service summary */}
            {report.formatted_report && (
              <div className="px-8 pb-6 border-t border-slate-100 pt-5">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Service Summary</p>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{report.formatted_report}</p>
              </div>
            )}

            {/* Manager authorization */}
            {(report.manager_on_site || report.manager_signature) && (
              <div className="px-8 pb-6 border-t border-slate-100 pt-5">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Authorization</p>
                <div className="flex items-start gap-6">
                  {report.manager_on_site && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{report.manager_on_site}</span>
                    </div>
                  )}
                  {report.manager_signature && (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={report.manager_signature}
                        alt="Manager signature"
                        className="h-12 border-b border-slate-300 pb-1"
                      />
                      <p className="text-xs text-slate-400 mt-1">Signature</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Work photos */}
            {images.length > 0 && (
              <div className="px-8 pb-6 border-t border-slate-100 pt-5">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Work Photos</p>
                <div className="grid grid-cols-3 gap-3">
                  {images.map((img) => (
                    <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt="Work photo"
                        className="w-full h-32 object-cover rounded-lg border border-slate-200 hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Pay CTA */}
            {!isPaid && (
              <div className="px-8 pb-8 pt-2 border-t border-slate-100">
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm disabled:opacity-60"
                >
                  {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {paying ? "Redirecting to payment…" : `Pay Now — $${grandTotal.toFixed(2)}`}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}
