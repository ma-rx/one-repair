"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, KPIData } from "@/lib/api";
import { SymptomCodeLabels, ResolutionCodeLabels } from "@/types/enums";
import {
  TrendingUp, Clock, DollarSign, AlertTriangle,
  Wrench, ClipboardList, Loader2, Package,
} from "lucide-react";

const barColors = [
  "bg-blue-500", "bg-indigo-400", "bg-violet-400",
  "bg-cyan-400",  "bg-teal-400",  "bg-slate-300",
];

function BarChart({ items, labelKey, countKey }: {
  items: Record<string, string | number>[];
  labelKey: string;
  countKey: string;
}) {
  const max = Math.max(...items.map((i) => Number(i[countKey])), 1);
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const count = Number(item[countKey]);
        const pct   = Math.round((count / max) * 100);
        return (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-700 truncate pr-2">{String(item[labelKey])}</span>
              <span className="text-slate-400 font-mono shrink-0">{count}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColors[i % barColors.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyTrend({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-slate-500">{d.count}</span>
          <div
            className="w-full bg-blue-500 rounded-t"
            style={{ height: `${Math.max((d.count / max) * 72, 4)}px` }}
          />
          <span className="text-xs text-slate-400 whitespace-nowrap">{d.month.split(" ")[0]}</span>
        </div>
      ))}
    </div>
  );
}

export default function KPIsPage() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getKPIs()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-32 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      </DashboardShell>
    );
  }

  if (error || !data) {
    return (
      <DashboardShell>
        <div className="py-16 text-center text-red-500">{error || "Failed to load KPIs."}</div>
      </DashboardShell>
    );
  }

  const openRate = data.tickets.total > 0
    ? Math.round((data.tickets.OPEN / data.tickets.total) * 100)
    : 0;

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">KPIs</h1>
        <p className="text-slate-500 text-sm mt-0.5">Live performance metrics</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Tickets",
            value: data.tickets.total,
            sub: `${openRate}% currently open`,
            icon: ClipboardList,
            color: "text-blue-500 bg-blue-50",
          },
          {
            label: "Avg Resolution Time",
            value: data.avg_resolution_hours != null ? `${data.avg_resolution_hours}h` : "—",
            sub: "based on closed tickets",
            icon: Clock,
            color: "text-violet-500 bg-violet-50",
          },
          {
            label: "Total Revenue",
            value: `$${data.total_revenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}`,
            sub: "labor + parts",
            icon: DollarSign,
            color: "text-emerald-500 bg-emerald-50",
          },
          {
            label: "Low Stock Parts",
            value: data.low_stock_count,
            sub: data.low_stock_count > 0 ? "needs restocking" : "all good",
            icon: Package,
            color: data.low_stock_count > 0 ? "text-amber-500 bg-amber-50" : "text-slate-400 bg-slate-50",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-500 text-sm">{label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
            <p className="text-slate-400 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Ticket status breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-800 mb-1">Ticket Status Breakdown</h2>
        <p className="text-slate-400 text-xs mb-5">All-time counts by current status</p>
        <div className="grid grid-cols-6 gap-3">
          {[
            { key: "OPEN",          label: "Open",          color: "bg-red-100 text-red-700"     },
            { key: "IN_PROGRESS",   label: "In Progress",   color: "bg-blue-100 text-blue-700"   },
            { key: "PENDING_PARTS", label: "Pending Parts", color: "bg-amber-100 text-amber-700" },
            { key: "RESOLVED",      label: "Resolved",      color: "bg-teal-100 text-teal-700"   },
            { key: "CLOSED",        label: "Closed",        color: "bg-green-100 text-green-700" },
            { key: "CANCELLED",     label: "Cancelled",     color: "bg-slate-100 text-slate-500" },
          ].map(({ key, label, color }) => (
            <div key={key} className={`rounded-xl p-4 text-center ${color}`}>
              <p className="text-2xl font-bold">{data.tickets[key as keyof typeof data.tickets]}</p>
              <p className="text-xs font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Symptom breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-1">Top Symptom Codes</h2>
          <p className="text-slate-400 text-xs mb-5">Most frequently reported issues</p>
          {data.top_symptoms.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No data yet.</p>
          ) : (
            <BarChart
              items={data.top_symptoms.map((s) => ({
                label: SymptomCodeLabels[s.symptom_code] ?? s.symptom_code,
                count: s.count,
              }))}
              labelKey="label"
              countKey="count"
            />
          )}
        </div>

        {/* Resolution breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-1">Top Resolution Codes</h2>
          <p className="text-slate-400 text-xs mb-5">How issues were resolved</p>
          {data.top_resolutions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No data yet.</p>
          ) : (
            <BarChart
              items={data.top_resolutions.map((r) => ({
                label: ResolutionCodeLabels[r.resolution_code] ?? r.resolution_code,
                count: r.count,
              }))}
              labelKey="label"
              countKey="count"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top assets */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-1">Most Serviced Assets</h2>
          <p className="text-slate-400 text-xs mb-5">Assets with the highest ticket volume</p>
          {data.top_assets.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {data.top_assets.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{a.asset_name}</p>
                    <p className="text-slate-400 text-xs">{a.store_name}</p>
                  </div>
                  <span className="text-slate-500 font-mono text-sm shrink-0">{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-1">Monthly Ticket Volume</h2>
          <p className="text-slate-400 text-xs mb-5">Tickets opened per month (last 6 months)</p>
          {data.monthly_trend.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No data yet.</p>
          ) : (
            <MonthlyTrend data={data.monthly_trend} />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
