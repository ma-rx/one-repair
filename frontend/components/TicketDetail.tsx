"use client";

import Link from "next/link";
import { Ticket, WorkImage } from "@/lib/api";
import { MapPin, Calendar, User, Clock, FileText, ArrowLeft } from "lucide-react";

export const statusStyle: Record<string, string> = {
  OPEN:          "bg-red-100 text-red-700",
  DISPATCHED:    "bg-purple-100 text-purple-700",
  IN_PROGRESS:   "bg-blue-100 text-blue-700",
  PENDING_PARTS: "bg-amber-100 text-amber-700",
  RESOLVED:      "bg-green-100 text-green-700",
  CLOSED:        "bg-slate-100 text-slate-500",
  CANCELLED:     "bg-slate-100 text-slate-400",
};

export const priorityBadge: Record<string, string> = {
  LOW:      "bg-slate-100 text-slate-500",
  MEDIUM:   "bg-blue-100 text-blue-600",
  HIGH:     "bg-orange-100 text-orange-600",
  CRITICAL: "bg-red-100 text-red-700",
};

function getDisplayStatus(t: Ticket, todayStr: string) {
  if (t.status === "DISPATCHED") {
    if (t.scheduled_date && t.scheduled_date > todayStr) return "Scheduled";
    return "Dispatched";
  }
  return t.status.replace(/_/g, " ");
}

interface Props {
  ticket: Ticket;
  images: WorkImage[];
  backHref: string;
  backLabel?: string;
  actions?: React.ReactNode;
  todayStr: string;
}

export default function TicketDetail({ ticket, images, backHref, backLabel = "Back", actions, todayStr }: Props) {
  const mapsUrl = ticket.store_address
    ? `https://maps.google.com/?q=${encodeURIComponent(ticket.store_address)}`
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <Link href={backHref} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {ticket.assets && ticket.assets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {ticket.assets.map((ta) => (
                <span key={ta.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  {ta.asset_name}
                </span>
              ))}
            </div>
          ) : (
            <h1 className="text-xl font-bold text-slate-900">{ticket.asset_name}</h1>
          )}
          <p className="text-slate-500 text-sm mt-0.5">{ticket.store_name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityBadge[ticket.priority] ?? ""}`}>
            {ticket.priority}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[ticket.status] ?? ""}`}>
            {getDisplayStatus(ticket, todayStr)}
          </span>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {ticket.description && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Issue</p>
            <p className="text-slate-800 text-sm">{ticket.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          {ticket.store_address && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Address</p>
              {mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium">
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {ticket.store_address}
                </a>
              ) : (
                <p className="text-slate-600">{ticket.store_address}</p>
              )}
            </div>
          )}

          {ticket.scheduled_date && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Scheduled</p>
              <p className="flex items-center gap-1.5 text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {new Date(ticket.scheduled_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
          )}

          {ticket.assigned_tech_name && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Technician</p>
              <p className="flex items-center gap-1.5 text-slate-700">
                <User className="w-3.5 h-3.5 text-slate-400" /> {ticket.assigned_tech_name}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Opened</p>
            <p className="flex items-center gap-1.5 text-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {new Date(ticket.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Work photos */}
      {images.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Photos</p>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="aspect-square block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Work photo" className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Service reports */}
      {ticket.service_reports?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Service Report</p>
          {ticket.service_reports.map((r) => (
            <div key={r.id} className="space-y-2 text-sm">
              {r.formatted_report && (
                <p className="text-slate-700 whitespace-pre-line">{r.formatted_report}</p>
              )}
              <div className="flex gap-4 text-slate-500 text-xs pt-1 border-t border-slate-100">
                <span>Labor: ${r.labor_cost}</span>
                <span>Parts: ${r.parts_total}</span>
                <span className="font-semibold text-slate-800">Total: ${r.grand_total}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actions && <div>{actions}</div>}
    </div>
  );
}
