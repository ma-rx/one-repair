"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { api, Ticket } from "@/lib/api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── colour by priority ────────────────────────────────────────────────────────
const priorityChip: Record<string, string> = {
  LOW:      "bg-slate-100 text-slate-600",
  MEDIUM:   "bg-blue-100 text-blue-700",
  HIGH:     "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

// ── component ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId]   = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  // ── load month ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    api.listTicketsByMonth(toMonthStr(new Date(year, month, 1)))
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // ── drag-and-drop ───────────────────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, ticketId: string) {
    setDragId(ticketId);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(dateStr);
  }

  function onDragLeave() {
    setDropTarget(null);
  }

  function onDrop(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    setDropTarget(null);
    if (!dragId) return;

    // Optimistic update
    setTickets(prev => prev.map(t =>
      t.id === dragId ? { ...t, scheduled_date: dateStr } : t
    ));

    // Debounce the API call
    clearTimeout(saveTimeouts.current[dragId]);
    saveTimeouts.current[dragId] = setTimeout(() => {
      api.rescheduleTicket(dragId, dateStr).catch(() => {
        // revert on failure — re-fetch
        api.listTicketsByMonth(toMonthStr(new Date(year, month, 1))).then(setTickets);
      });
    }, 300);

    setDragId(null);
  }

  function onDragEnd() {
    setDragId(null);
    setDropTarget(null);
  }

  // ── build grid ──────────────────────────────────────────────────────────────
  const firstDow  = getFirstDayOfWeek(year, month);
  const daysCount = getDaysInMonth(year, month);

  // cells: nulls for leading padding, then day numbers
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const ticketsByDate: Record<string, Ticket[]> = {};
  for (const t of tickets) {
    if (t.scheduled_date) {
      (ticketsByDate[t.scheduled_date] ??= []).push(t);
    }
  }

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule Calendar</h1>
          <p className="text-slate-500 text-sm mt-0.5">Drag tickets between days to reschedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-slate-800 w-36 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
            className="ml-2 px-3 py-1.5 text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dateStr = day ? toDateStr(year, month, day) : null;
              const dayTickets = dateStr ? (ticketsByDate[dateStr] ?? []) : [];
              const isToday   = dateStr === todayStr;
              const isTarget  = dateStr === dropTarget;

              return (
                <div
                  key={idx}
                  className={`min-h-28 border-b border-r border-slate-100 p-1.5 transition-colors ${
                    !day ? "bg-slate-50/50" : ""
                  } ${isToday ? "bg-blue-50/40" : ""} ${isTarget ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400" : ""}`}
                  onDragOver={dateStr ? (e) => onDragOver(e, dateStr) : undefined}
                  onDragLeave={onDragLeave}
                  onDrop={dateStr ? (e) => onDrop(e, dateStr) : undefined}
                >
                  {day && (
                    <>
                      <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? "bg-blue-600 text-white" : "text-slate-500"
                      }`}>
                        {day}
                      </p>
                      <div className="space-y-0.5">
                        {dayTickets.map(t => (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, t.id)}
                            onDragEnd={onDragEnd}
                            className={`group rounded px-1.5 py-1 cursor-grab active:cursor-grabbing text-xs leading-tight select-none transition-opacity ${
                              priorityChip[t.priority] ?? "bg-slate-100 text-slate-600"
                            } ${dragId === t.id ? "opacity-40" : "hover:brightness-95"}`}
                          >
                            <p className="font-medium truncate">{t.asset_name}</p>
                            <p className="truncate opacity-75">{t.store_name}</p>
                            {t.assigned_tech_name && (
                              <p className="truncate opacity-60">{t.assigned_tech_name}</p>
                            )}
                            {/* actions on hover */}
                            <div className="hidden group-hover:flex gap-1 mt-1">
                              <Link
                                href={`/dispatch/${t.id}/assign`}
                                className="text-[10px] underline opacity-80 hover:opacity-100"
                                onClick={e => e.stopPropagation()}
                              >
                                reassign
                              </Link>
                              {(t.status === "IN_PROGRESS" || t.status === "PENDING_PARTS") && (
                                <Link
                                  href={`/dispatch/${t.id}/close`}
                                  className="text-[10px] underline opacity-80 hover:opacity-100"
                                  onClick={e => e.stopPropagation()}
                                >
                                  close
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
