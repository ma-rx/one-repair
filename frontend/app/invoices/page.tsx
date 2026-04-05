"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { api, ServiceReport } from "@/lib/api";
import { FileText, Download, Loader2, DollarSign, Clock, CheckCircle2, Send } from "lucide-react";

type FilterStatus = "all" | "sent" | "paid" | "pending" | "unsent";

export default function InvoicesPage() {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.listAllInvoices()
      .then(setReports)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(id: string) {
    setDownloading(id);
    try { await api.downloadInvoicePDF(id); } catch { /* ignore */ } finally { setDownloading(null); }
  }

  const allSent    = reports.filter((r) => r.invoice_sent);
  const paid       = reports.filter((r) => r.ticket_status === "PAID");
  const pending    = reports.filter((r) => r.invoice_sent && r.ticket_status !== "PAID");
  const unsent     = reports.filter((r) => !r.invoice_sent);

  const totalInvoiced  = allSent.reduce((s, r) => s + parseFloat(r.grand_total || "0"), 0);
  const totalPaid      = paid.reduce((s, r)    => s + parseFloat(r.grand_total || "0"), 0);
  const totalOutstanding = pending.reduce((s, r) => s + parseFloat(r.grand_total || "0"), 0);

  const filtered = (() => {
    if (filter === "sent")    return allSent;
    if (filter === "paid")    return paid;
    if (filter === "pending") return pending;
    if (filter === "unsent")  return unsent;
    return reports;
  })();

  function paymentBadge(r: ServiceReport) {
    if (r.ticket_status === "PAID") {
      return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Paid</span>;
    }
    if (r.invoice_sent) {
      return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Payment Pending</span>;
    }
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Not Sent</span>;
  }

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="text-slate-500 text-sm mt-0.5">All invoices across every client</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Send className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Invoiced</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">${totalInvoiced.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{allSent.length} sent</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Collected</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">${totalPaid.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{paid.length} paid</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">${totalOutstanding.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{pending.length} awaiting payment</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Not Sent</span>
          </div>
          <p className="text-2xl font-bold text-slate-500">{unsent.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">ready to invoice</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {([
          ["all",     "All"],
          ["sent",    "Sent"],
          ["paid",    "Paid"],
          ["pending", "Pending Payment"],
          ["unsent",  "Not Sent"],
        ] as [FilterStatus, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === val
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No invoices found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Invoice #</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Client</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Store</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Equipment</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Date</th>
                <th className="text-right px-5 py-3 text-slate-500 font-medium">Amount</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-5 py-3 text-right text-slate-500 font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dispatch/${r.ticket}/invoice`}
                      className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                    >
                      {r.ticket_number || r.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-700 font-medium">{r.org_name || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{r.store_name || "—"}</td>
                  <td className="px-5 py-3 text-slate-500 max-w-[160px] truncate">{r.asset_name || "—"}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    ${parseFloat(r.grand_total || "0").toFixed(2)}
                  </td>
                  <td className="px-5 py-3">{paymentBadge(r)}</td>
                  <td className="px-5 py-3 text-right">
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
    </DashboardShell>
  );
}
