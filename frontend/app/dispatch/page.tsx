import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { ClipboardList, Clock, AlertTriangle, QrCode, UserCheck, FileText } from "lucide-react";

const tickets = [
  { id: "uuid-001", asset: "HVAC Unit A3", store: "Downtown Store", symptom: "Not Cooling", status: "OPEN", time: "2h ago" },
  { id: "uuid-002", asset: "Refrigerator B1", store: "Westside Store", symptom: "Unusual Noise", status: "IN_PROGRESS", time: "4h ago" },
  { id: "uuid-003", asset: "POS Terminal 2", store: "Eastside Store", symptom: "Display Issue", status: "PENDING_PARTS", time: "1d ago" },
  { id: "uuid-004", asset: "Freezer C2", store: "Northside Store", symptom: "Overheating", status: "OPEN", time: "30m ago" },
  { id: "uuid-005", asset: "Ice Machine 1", store: "Downtown Store", symptom: "Leaking", status: "IN_PROGRESS", time: "6h ago" },
];

const statusStyle: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  PENDING_PARTS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

export default function DispatchPage() {
  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dispatch</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage and assign open work orders</p>
        </div>
        <Link
          href="/scan"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <QrCode className="w-4 h-4" />
          Scan Asset
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Open", value: 2, icon: AlertTriangle, color: "text-red-500 bg-red-50" },
          { label: "In Progress", value: 2, icon: Clock, color: "text-blue-500 bg-blue-50" },
          { label: "Pending Parts", value: 1, icon: ClipboardList, color: "text-amber-500 bg-amber-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-slate-200 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-slate-500 text-sm">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Active Tickets</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Asset</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Store</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Symptom</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Created</th>
              <th className="px-6 py-3 text-slate-500 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{t.asset}</td>
                <td className="px-6 py-4 text-slate-500">{t.store}</td>
                <td className="px-6 py-4 text-slate-700">{t.symptom}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[t.status]}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400">{t.time}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {t.status === "OPEN" && (
                      <Link
                        href={`/dispatch/${t.id}/assign`}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Assign
                      </Link>
                    )}
                    {t.status === "IN_PROGRESS" && (
                      <Link
                        href={`/dispatch/${t.id}/close`}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" /> Close
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
