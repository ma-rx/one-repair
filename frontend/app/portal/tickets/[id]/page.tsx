"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Ticket, WorkImage } from "@/lib/api";
import PortalShell from "@/components/PortalShell";
import TicketDetail from "@/components/TicketDetail";
import { Loader2 } from "lucide-react";

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PortalTicketDetailPage() {
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

  return (
    <PortalShell>
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
          backHref="/portal/tickets"
          backLabel="Tickets"
          todayStr={todayStr}
        />
      ) : (
        <div className="py-12 text-center text-slate-400">Ticket not found.</div>
      )}
    </PortalShell>
  );
}
