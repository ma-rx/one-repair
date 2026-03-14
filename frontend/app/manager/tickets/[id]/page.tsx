"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Ticket, WorkImage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import TicketDetail from "@/components/TicketDetail";
import { Wrench, Loader2 } from "lucide-react";

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ManagerTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">{user?.store?.name ?? "My Store"}</p>
          <p className="text-slate-400 text-xs">Store Manager View</p>
        </div>
      </header>

      <div className="px-4 py-6">
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
            backHref="/manager"
            backLabel="Open Issues"
            todayStr={todayStr}
          />
        ) : (
          <div className="py-12 text-center text-slate-400">Ticket not found.</div>
        )}
      </div>
    </div>
  );
}
