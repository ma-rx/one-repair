import DashboardShell from "@/components/DashboardShell";
import { TrendingUp, TrendingDown, Clock, Star, Wrench, AlertTriangle } from "lucide-react";

const symptomBreakdown = [
  { code: "NOT_COOLING", label: "Not Cooling", count: 18, pct: 30 },
  { code: "UNUSUAL_NOISE", label: "Unusual Noise", count: 12, pct: 20 },
  { code: "OVERHEATING", label: "Overheating", count: 10, pct: 17 },
  { code: "LEAKING", label: "Leaking", count: 9, pct: 15 },
  { code: "DISPLAY_ISSUE", label: "Display Issue", count: 6, pct: 10 },
  { code: "OTHER", label: "Other", count: 5, pct: 8 },
];

const resolutionBreakdown = [
  { code: "REPLACED_PART", label: "Replaced Part", count: 22, pct: 37 },
  { code: "CLEANED_SERVICED", label: "Cleaned / Serviced", count: 14, pct: 23 },
  { code: "ADJUSTED_SETTINGS", label: "Adjusted Settings", count: 10, pct: 17 },
  { code: "FIRMWARE_UPDATE", label: "Firmware Update", count: 8, pct: 13 },
  { code: "NO_FAULT_FOUND", label: "No Fault Found", count: 6, pct: 10 },
];

const barColors = [
  "bg-blue-500", "bg-indigo-400", "bg-violet-400", "bg-cyan-400", "bg-teal-400", "bg-slate-300",
];

export default function KPIsPage() {
  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">KPIs</h1>
        <p className="text-slate-500 text-sm mt-0.5">Performance metrics — last 30 days</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Avg. Resolution Time", value: "3.2h", sub: "↓ 0.4h vs last month", trend: "good", icon: Clock },
          { label: "First-Time Fix Rate", value: "74%", sub: "↑ 6% vs last month", trend: "good", icon: Star },
          { label: "Open Tickets", value: "12", sub: "↑ 3 vs last month", trend: "bad", icon: AlertTriangle },
          { label: "Assets Serviced", value: "60", sub: "↑ 8 vs last month", trend: "good", icon: Wrench },
        ].map(({ label, value, sub, trend, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-500 text-sm">{label}</p>
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Icon className="w-4 h-4 text-slate-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${trend === "good" ? "text-emerald-600" : "text-red-500"}`}>
              {trend === "good"
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {sub}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Symptom breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-1">Top Symptom Codes</h2>
          <p className="text-slate-400 text-xs mb-5">Frequency of reported symptoms</p>
          <div className="space-y-3">
            {symptomBreakdown.map(({ label, count, pct }, i) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">{label}</span>
                  <span className="text-slate-400 font-mono">{count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColors[i % barColors.length]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-1">Top Resolution Codes</h2>
          <p className="text-slate-400 text-xs mb-5">How issues were resolved</p>
          <div className="space-y-3">
            {resolutionBreakdown.map(({ label, count, pct }, i) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">{label}</span>
                  <span className="text-slate-400 font-mono">{count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColors[i % barColors.length]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
