"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import { api, ServiceReport } from "@/lib/api";
import { Loader2, Download, CreditCard, CheckCircle2, ArrowLeft } from "lucide-react";

export default function PortalInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [report, setReport]     = useState<ServiceReport | null>(null);
  const [pdfUrl, setPdfUrl]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [error, setError]       = useState("");
  const [paying, setPaying]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    api.getServiceReport(id)
      .then((r) => {
        setReport(r);
        // Load PDF as blob so it works with auth headers
        return api.getInvoicePDFBlobUrl(id);
      })
      .then((url) => {
        blobUrlRef.current = url;
        setPdfUrl(url);
      })
      .catch((e) => setError(e.message))
      .finally(() => { setLoading(false); setPdfLoading(false); });

    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
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

  const isPaid = report?.ticket_status === "PAID";

  return (
    <PortalShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/portal/invoices" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Invoice {report?.ticket_number || id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {report ? new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}
              </p>
            </div>
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
                  {paying ? "Redirecting…" : `Pay $${parseFloat(report.grand_total || "0").toFixed(2)}`}
                </button>
              )}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading invoice…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {pdfLoading ? (
              <div className="flex items-center justify-center py-32 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading PDF…
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full"
                style={{ height: "80vh", border: "none" }}
                title="Invoice PDF"
              />
            ) : (
              <div className="py-12 text-center text-slate-400">Could not load PDF preview.</div>
            )}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
