"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import { api, ServiceReport } from "@/lib/api";
import { FileText, Download, Loader2, CreditCard, CheckCircle2 } from "lucide-react";

export default function PortalInvoicesPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [reports, setReports]     = useState<ServiceReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [paying, setPaying]       = useState(false);
  const [flashPaid, setFlashPaid] = useState(searchParams.get("paid") === "1");

  useEffect(() => {
    api.listInvoices()
      .then(setReports)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (flashPaid) {
      const t = setTimeout(() => setFlashPaid(false), 4000);
      return () => clearTimeout(t);
    }
  }, [flashPaid]);

  async function handleDownload(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDownloading(id);
    try {
      await api.downloadInvoicePDF(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "PDF download failed.");
    } finally {
      setDownloading(null);
    }
  }

  function toggleSelect(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const payable = unpaidSent.map((r) => r.id);
    if (payable.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(payable));
    }
  }

  async function handleMultiPay(ids: string[]) {
    if (ids.length === 0) return;
    setPaying(true);
    try {
      const { payment_url } = await api.createMultiPaySession(ids);
      window.location.href = payment_url;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Payment failed.");
      setPaying(false);
    }
  }

  const unpaidSent = reports.filter((r) => r.invoice_sent && r.ticket_status !== "PAID");
  const selectedIds = Array.from(selected).filter((id) => unpaidSent.some((r) => r.id === id));
  const outstandingTotal = unpaidSent.reduce((s, r) => s + parseFloat(r.grand_total || "0"), 0);

  function paymentBadge(r: ServiceReport) {
    if (r.ticket_status === "PAID") {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Paid</span>;
    }
    if (r.invoice_sent) {
      return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Payment Pending</span>;
    }
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Not Sent</span>;
  }

  return (
    <PortalShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 text-sm mt-0.5">Service invoices and billing history</p>
        </div>

        {unpaidSent.length > 0 && (
          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <button
                onClick={() => handleMultiPay(selectedIds)}
                disabled={paying}
                className="flex items-center gap-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-4 py-2 rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Pay Selected ({selectedIds.length})
              </button>
            )}
            <button
              onClick={() => handleMultiPay(unpaidSent.map((r) => r.id))}
              disabled={paying}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm disabled:opacity-50"
            >
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Pay All Outstanding — ${outstandingTotal.toFixed(2)}
            </button>
          </div>
        )}
      </div>

      {flashPaid && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" /> Payment received — thank you!
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No invoices yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 w-10">
                  {unpaidSent.length > 0 && (
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={unpaidSent.length > 0 && unpaidSent.every((r) => selected.has(r.id))}
                      onChange={toggleAll}
                    />
                  )}
                </th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Invoice</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Parts</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Labor</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Total</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3 text-right text-slate-500 font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const isPayable = r.invoice_sent && r.ticket_status !== "PAID";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/portal/invoices/${r.id}`)}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {isPayable && (
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={selected.has(r.id)}
                          onChange={() => {}}
                          onClick={(e) => toggleSelect(e, r.id)}
                        />
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {r.ticket_number || r.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">${parseFloat(r.parts_total || "0").toFixed(2)}</td>
                    <td className="px-4 py-4 text-slate-600">${parseFloat(r.labor_cost || "0").toFixed(2)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-800">${parseFloat(r.grand_total || "0").toFixed(2)}</td>
                    <td className="px-4 py-4">{paymentBadge(r)}</td>
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDownload(e, r.id)}
                        disabled={downloading === r.id}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {downloading === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
