"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Ticket, WorkImage } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import TicketDetail from "@/components/TicketDetail";
import { Loader2, UserCheck, FileText } from "lucide-react";

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DispatchTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const todayStr = toLocalDateStr(new Date());

  const [ticket, setTicket]   = useState<Ticket | null>(null);
  const [images, setImages]   = useState<WorkImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    Promise.all([api.getTicket(id), api.getWorkImages(id)])
      .then(([t, imgs]) => { setTicket(t); setImages(imgs); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const canAssign  = ticket && (ticket.status === "OPEN" || ticket.status === "DISPATCHED");
  const canClose   = ticket && (ticket.status === "IN_PROGRESS" || ticket.status === "PENDING_PARTS" || ticket.status === "DISPATCHED");

  return (
    <DashboardShell>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : ticket ? (
        <TicketDetail
          ticket={ticket}
          images={images}
          backHref="/dispatch"
          backLabel="Dispatch"
          todayStr={todayStr}
          actions={
            <div className="flex gap-3">
              {canAssign && (
                <Link
                  href={`/dispatch/${id}/assign`}
                  className="flex-1 flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  <UserCheck className="w-4 h-4" /> Assign / Reschedule
                </Link>
              )}
              {canClose && (
                <Link
                  href={`/dispatch/${id}/close`}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  <FileText className="w-4 h-4" /> Service Report
                </Link>
              )}
            </div>
          }
        />
      ) : (
        <div className="py-12 text-center text-slate-400">Ticket not found.</div>
      )}
    </DashboardShell>
  );
}
