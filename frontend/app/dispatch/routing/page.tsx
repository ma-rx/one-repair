"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, AppUser, Ticket } from "@/lib/api";
import {
  ArrowDown, ArrowUp, Loader2, MapPin, Navigation, Save,
} from "lucide-react";

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildRouteUrl(addresses: string[]) {
  if (addresses.length === 0) return "";
  if (addresses.length === 1) return `https://maps.google.com/?q=${encodeURIComponent(addresses[0])}`;
  const destination = encodeURIComponent(addresses[addresses.length - 1]);
  const waypoints = addresses.slice(0, -1).map(encodeURIComponent).join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}`;
}

const statusStyle: Record<string, string> = {
  OPEN:          "bg-red-100 text-red-700",
  DISPATCHED:    "bg-purple-100 text-purple-700",
  IN_PROGRESS:   "bg-blue-100 text-blue-700",
  PENDING_PARTS: "bg-amber-100 text-amber-700",
  COMPLETED:     "bg-emerald-100 text-emerald-700",
  CLOSED:        "bg-slate-100 text-slate-500",
};

export default function RoutingPage() {
  const today = toDateStr(new Date());
  const [techs, setTechs]     = useState<AppUser[]>([]);
  const [techId, setTechId]   = useState<string>("");
  const [date, setDate]       = useState(today);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [order, setOrder]     = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.listTechs().then(setTechs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!techId || !date) return;
    setLoading(true);
    setError("");
    api.listTicketsByTechAndDate(techId, date)
      .then((ts) => {
        setTickets(ts);
        setOrder(ts.map((t) => t.id));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [techId, date]);

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
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.setRouteOrder(order);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const activeAddresses = ordered
    .filter((t) => t.status !== "COMPLETED" && t.status !== "CLOSED")
    .map((t) => t.store_address)
    .filter(Boolean);

  const selectedTech = techs.find((t) => String(t.id) === techId);

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Tech Routing</h1>
        <p className="text-slate-500 text-sm mt-0.5">Set the stop order for a technician's day</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={techId}
          onChange={(e) => setTechId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Select technician…</option>
          {techs.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.first_name} {t.last_name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Route button + save */}
      {ordered.length > 0 && (
        <div className="flex gap-3 mb-5">
          {activeAddresses.length > 0 && (
            <a
              href={buildRouteUrl(activeAddresses)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Navigation className="w-4 h-4" />
              Open in Maps ({activeAddresses.length} stop{activeAddresses.length !== 1 ? "s" : ""})
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved!" : "Save Route Order"}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 text-red-600 text-sm bg-red-50 rounded-lg px-4 py-3">{error}</div>
      )}

      {!techId ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
          <p className="font-medium text-slate-500">Select a technician to view their schedule</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : ordered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
          <p className="font-medium text-slate-500">
            {selectedTech ? `${selectedTech.first_name} ${selectedTech.last_name}` : "This tech"} has no jobs on this date
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordered.map((t, idx) => {
            const isCompleted = t.status === "COMPLETED" || t.status === "CLOSED";
            return (
              <div
                key={t.id}
                className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${isCompleted ? "border-slate-100 opacity-60" : "border-slate-200"}`}
              >
                {/* Stop # + reorder */}
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
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

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{t.asset_name}</p>
                      <p className="text-slate-500 text-sm">{t.store_name}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[t.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {t.store_address && (
                    <p className="flex items-center gap-1.5 mt-1.5 text-slate-400 text-xs">
                      <MapPin className="w-3.5 h-3.5 shrink-0" /> {t.store_address}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
