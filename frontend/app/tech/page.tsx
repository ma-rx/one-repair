"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Ticket } from "@/lib/api";
import {
  Wrench, LogOut, Loader2, FileText, Plus,
  ChevronLeft, ChevronRight, MapPin, Navigation,
  ArrowUp, ArrowDown, Calendar,
} from "lucide-react";

const statusStyle: Record<string, string> = {
  OPEN:          "bg-red-100 text-red-700",
  IN_PROGRESS:   "bg-blue-100 text-blue-700",
  PENDING_PARTS: "bg-amber-100 text-amber-700",
  RESOLVED:      "bg-green-100 text-green-700",
  CLOSED:        "bg-slate-100 text-slate-500",
};

const priorityBadge: Record<string, string> = {
  LOW:      "bg-slate-100 text-slate-500",
  MEDIUM:   "bg-blue-100 text-blue-600",
  HIGH:     "bg-orange-100 text-orange-600",
  CRITICAL: "bg-red-100 text-red-700",
};

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = toDateStr(new Date());
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function buildMapsUrl(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

function buildRouteUrl(addresses: string[]) {
  if (addresses.length === 0) return "";
  if (addresses.length === 1) return buildMapsUrl(addresses[0]);
  const origin = encodeURIComponent(addresses[0]);
  const destination = encodeURIComponent(addresses[addresses.length - 1]);
  const waypoints = addresses.slice(1, -1).map(encodeURIComponent).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

export default function TechPage() {
  const { user, logout } = useAuth();
  const today = toDateStr(new Date());
  const [date, setDate]       = useState(today);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [order, setOrder]     = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.listTicketsByDate(date)
      .then((all) => {
        const active = all.filter((t) => t.status !== "CLOSED" && t.status !== "CANCELLED");
        setTickets(active);
        setOrder(active.map((t) => t.id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const ordered = order
    .map((id) => tickets.find((t) => t.id === id))
    .filter(Boolean) as Ticket[];

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  const routeAddresses = ordered.map((t) => t.store_address).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">My Schedule</p>
            <p className="text-slate-400 text-xs">
              {user ? `${user.first_name} ${user.last_name}`.trim() : "Technician"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/scan"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Date bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setDate((d) => addDays(d, -1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="font-semibold text-slate-800 text-sm">{formatDate(date)}</p>
          <p className="text-slate-400 text-xs">{new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>

        <button
          onClick={() => setDate((d) => addDays(d, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Jump to today */}
      {date !== today && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-center">
          <button
            onClick={() => setDate(today)}
            className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-800"
          >
            <Calendar className="w-3.5 h-3.5" /> Back to Today
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Route button */}
        {routeAddresses.length > 0 && (
          <a
            href={buildRouteUrl(routeAddresses)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            <Navigation className="w-4 h-4" />
            Open Route in Google Maps ({routeAddresses.length} stop{routeAddresses.length !== 1 ? "s" : ""})
          </a>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : ordered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
            <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-slate-500">No jobs scheduled for this day</p>
            <p className="text-sm mt-1">Use the arrows to check other dates</p>
          </div>
        ) : (
          <>
            {ordered.length > 1 && (
              <p className="text-xs text-slate-400 text-center">Drag to reorder stops, then open route</p>
            )}
            <div className="space-y-3">
              {ordered.map((t, idx) => (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    {/* Stop number + reorder */}
                    {ordered.length > 1 && (
                      <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <button
                          onClick={() => move(t.id, -1)}
                          disabled={idx === 0}
                          className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => move(t.id, 1)}
                          disabled={idx === ordered.length - 1}
                          className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-800">{t.asset_name}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityBadge[t.priority] ?? ""}`}>
                              {t.priority}
                            </span>
                          </div>
                          <p className="text-slate-500 text-sm mt-0.5">{t.store_name}</p>
                          {t.description && (
                            <p className="text-slate-600 text-sm mt-1">{t.description}</p>
                          )}
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[t.status] ?? ""}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Address + maps link */}
                      {t.store_address ? (
                        <a
                          href={buildMapsUrl(t.store_address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 mt-2 text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {t.store_address}
                        </a>
                      ) : (
                        <p className="flex items-center gap-1.5 mt-2 text-slate-400 text-xs">
                          <MapPin className="w-3.5 h-3.5 shrink-0" /> No address on file
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        {(t.status === "IN_PROGRESS" || t.status === "PENDING_PARTS") && (
                          <Link
                            href={`/tech/${t.id}/close`}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" /> Close Ticket
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
