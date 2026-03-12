"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { api, ClientKPIData, Store } from "@/lib/api";
import { AssetCategoryLabels } from "@/types/enums";
import { DollarSign, Wrench, Clock, Loader2 } from "lucide-react";

const TIMEFRAMES = [
  { label: "This Week",    value: "week"    },
  { label: "This Month",   value: "month"   },
  { label: "This Quarter", value: "quarter" },
  { label: "This Year",    value: "year"    },
];

function BarRow({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-slate-600 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-sm font-medium text-slate-700 shrink-0">
        {sub ?? value}
      </span>
    </div>
  );
}

export default function ClientKPIsPage() {
  const [timeframe, setTimeframe] = useState("month");
  const [storeFilter, setStoreFilter] = useState("");
  const [stores, setStores]   = useState<Store[]>([]);
  const [data, setData]       = useState<ClientKPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.listStores().then(setStores).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    api.getClientKPIs({ timeframe, store: storeFilter || undefined })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [timeframe, storeFilter]);

  const maxStoreCount    = Math.max(...(data?.by_store.map((r) => r.count) ?? [1]), 1);
  const maxCategoryCount = Math.max(...(data?.by_category.map((r) => r.count) ?? [1]), 1);
  const maxMonthCount    = Math.max(...(data?.monthly_trend.map((r) => r.count) ?? [1]), 1);

  return (
    <PortalShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Spending and repair activity across your locations</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTimeframe(t.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === t.value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
        >
          <option value="">All Stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <DollarSign className="w-4.5 h-4.5 text-green-600" />
                </div>
                <span className="text-sm text-slate-500">Total Spend</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                ${data.total_spend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Wrench className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <span className="text-sm text-slate-500">Total Repairs</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{data.total_repairs}</p>
              <p className="text-xs text-slate-400 mt-1">
                {data.tickets.OPEN} open · {data.tickets.IN_PROGRESS} in progress
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Clock className="w-4.5 h-4.5 text-purple-600" />
                </div>
                <span className="text-sm text-slate-500">Avg Resolution</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {data.avg_resolution_hours != null ? `${data.avg_resolution_hours}h` : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Repairs by store */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Repairs by Store</h2>
              {data.by_store.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">No data</p>
              ) : (
                <div className="space-y-3">
                  {data.by_store.map((r) => (
                    <BarRow
                      key={r.store_id}
                      label={r.store_name}
                      value={r.count}
                      max={maxStoreCount}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Spend by store */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Spend by Store</h2>
              {data.by_store.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">No data</p>
              ) : (
                <div className="space-y-3">
                  {[...data.by_store].sort((a, b) => b.spend - a.spend).map((r) => (
                    <BarRow
                      key={r.store_id}
                      label={r.store_name}
                      value={r.spend}
                      max={Math.max(...data.by_store.map((s) => s.spend), 1)}
                      sub={`$${r.spend.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Repairs by asset category */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Repairs by Asset Type</h2>
              {data.by_category.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">No data</p>
              ) : (
                <div className="space-y-3">
                  {data.by_category.map((r) => (
                    <BarRow
                      key={r.category}
                      label={AssetCategoryLabels[r.category] ?? r.category}
                      value={r.count}
                      max={maxCategoryCount}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Monthly trend */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Monthly Repair Trend</h2>
              {data.monthly_trend.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">No data</p>
              ) : (
                <div className="space-y-3">
                  {data.monthly_trend.map((r) => (
                    <BarRow
                      key={r.month}
                      label={r.month}
                      value={r.count}
                      max={maxMonthCount}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}
