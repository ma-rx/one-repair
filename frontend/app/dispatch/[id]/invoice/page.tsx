"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { ArrowLeft, Receipt } from "lucide-react";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <DashboardShell>
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href={`/dispatch/${id}`} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Ticket
        </Link>
        <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <Receipt className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Invoice Generation</h1>
          <p className="text-slate-500 text-sm max-w-sm">
            Invoice generation is coming soon. You&apos;ll be able to preview, send, and collect payment directly from here.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
