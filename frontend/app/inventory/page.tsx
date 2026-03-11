import DashboardShell from "@/components/DashboardShell";
import { Package, CheckCircle2, AlertCircle, XCircle, Search } from "lucide-react";

const assets = [
  { id: "AST-001", name: "HVAC Unit A3", serial: "HV-29301", model: "Carrier 38CKC", store: "Downtown Store", status: "UNDER_MAINTENANCE" },
  { id: "AST-002", name: "Refrigerator B1", serial: "RF-10042", model: "True T-49", store: "Westside Store", status: "OPERATIONAL" },
  { id: "AST-003", name: "Ice Machine 1", serial: "IM-88812", model: "Hoshizaki KM-515", store: "Downtown Store", status: "OPERATIONAL" },
  { id: "AST-004", name: "POS Terminal 2", serial: "POS-5521", model: "Clover Station", store: "Eastside Store", status: "OUT_OF_SERVICE" },
  { id: "AST-005", name: "Freezer C2", serial: "FZ-33901", model: "True T-23F", store: "Northside Store", status: "UNDER_MAINTENANCE" },
  { id: "AST-006", name: "Oven Unit 1", serial: "OV-77210", model: "Rational SCC61", store: "Westside Store", status: "OPERATIONAL" },
];

const statusConfig: Record<string, { label: string; style: string; icon: React.ElementType }> = {
  OPERATIONAL: { label: "Operational", style: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  UNDER_MAINTENANCE: { label: "Under Maintenance", style: "bg-amber-100 text-amber-700", icon: AlertCircle },
  OUT_OF_SERVICE: { label: "Out of Service", style: "bg-red-100 text-red-700", icon: XCircle },
};

export default function InventoryPage() {
  const counts = {
    OPERATIONAL: assets.filter((a) => a.status === "OPERATIONAL").length,
    UNDER_MAINTENANCE: assets.filter((a) => a.status === "UNDER_MAINTENANCE").length,
    OUT_OF_SERVICE: assets.filter((a) => a.status === "OUT_OF_SERVICE").length,
  };

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-sm mt-0.5">All assets across your organization</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
          <Package className="w-4 h-4" />
          Add Asset
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Operational", value: counts.OPERATIONAL, icon: CheckCircle2, color: "text-emerald-500 bg-emerald-50" },
          { label: "Under Maintenance", value: counts.UNDER_MAINTENANCE, icon: AlertCircle, color: "text-amber-500 bg-amber-50" },
          { label: "Out of Service", value: counts.OUT_OF_SERVICE, icon: XCircle, color: "text-red-500 bg-red-50" },
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

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">All Assets</h2>
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
            <Search className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Search assets...</span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Asset ID</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Model</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Serial No.</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Store</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const cfg = statusConfig[a.status];
              const Icon = cfg.icon;
              return (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-500">{a.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{a.name}</td>
                  <td className="px-6 py-4 text-slate-500">{a.model}</td>
                  <td className="px-6 py-4 font-mono text-slate-400 text-xs">{a.serial}</td>
                  <td className="px-6 py-4 text-slate-500">{a.store}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.style}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
