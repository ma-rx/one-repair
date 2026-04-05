"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { api, ServiceReport } from "@/lib/api";
import { FileText, Download, Loader2 } from "lucide-react";

export default function PortalInvoicesPage() {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api.listInvoices()
      .then(setReports)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(id: string) {
    setDownloading(id);
    try {
      await api.downloadInvoicePDF(id);
    } catch {
      // silently ignore
    } finally {
      setDownloading(null);
    }
  }

  return (
    <PortalShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="text-slate-500 text-sm mt-0.5">Service reports and billing history</p>
      </div>

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
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Invoice</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Parts</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Labor</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Total</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-6 py-3 text-right text-slate-500 font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-500 text-xs">{r.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-6 py-4 text-slate-600">${parseFloat(r.parts_total).toFixed(2)}</td>
                  <td className="px-6 py-4 text-slate-600">${parseFloat(r.labor_cost).toFixed(2)}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">${parseFloat(r.grand_total).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    {r.ticket_status === "PAID" ? (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Paid</span>
                    ) : r.invoice_sent ? (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Payment Pending</span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Not Sent</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDownload(r.id)}
                      disabled={downloading === r.id}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {downloading === r.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
