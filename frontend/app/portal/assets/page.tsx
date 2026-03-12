"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { api, Asset } from "@/lib/api";
import { AssetCategoryLabels, AssetStatusLabels } from "@/types/enums";
import { Loader2 } from "lucide-react";

const statusColor: Record<string, string> = {
  OPERATIONAL:       "bg-green-100 text-green-700",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-700",
  OUT_OF_SERVICE:    "bg-red-100 text-red-700",
  DECOMMISSIONED:    "bg-slate-100 text-slate-500",
};

export default function PortalAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listAssets()
      .then(setAssets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PortalShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Assets</h1>
        <p className="text-slate-500 text-sm mt-0.5">All equipment across your locations</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : assets.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No assets found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Asset</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Category</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Store</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{a.name}</p>
                    {a.make && <p className="text-slate-400 text-xs">{a.make} {a.model_number}</p>}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {AssetCategoryLabels[a.category] ?? a.category}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{a.store_name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[a.status] ?? ""}`}>
                      {AssetStatusLabels[a.status] ?? a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
