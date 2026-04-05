"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Ticket, WorkImage } from "@/lib/api";
import TicketDetail from "@/components/TicketDetail";
import { Loader2, FileText, Bot } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TechTicketDetailPage() {
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

  const canService = ticket && (ticket.status === "IN_PROGRESS" || ticket.status === "PENDING_PARTS" || ticket.status === "DISPATCHED");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Logo" className="w-9 h-9 rounded-lg" />
        <div>
          <p className="font-semibold text-slate-800 text-sm">Ticket Detail</p>
          <p className="text-slate-400 text-xs">{user ? `${user.first_name} ${user.last_name}`.trim() : "Technician"}</p>
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
            backHref="/tech"
            backLabel="My Schedule"
            todayStr={todayStr}
            actions={
              <div className="flex flex-col gap-3">
                <Link
                  href={`/tech/${id}/diagnose`}
                  className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  <Bot className="w-4 h-4" /> AI Assistant
                </Link>
                {canService && (
                  <Link
                    href={`/tech/${id}/close`}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
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
      </div>
    </div>
  );
}
