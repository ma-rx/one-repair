"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import { api, Asset, Store } from "@/lib/api";
import { AssetCategoryLabels, AssetStatusLabels } from "@/types/enums";
import { ArrowLeft, Cpu, Loader2 } from "lucide-react";

const statusColors: Record<string, string> = {
  OPERATIONAL:       "bg-green-100 text-green-700",
  UNDER_MAINTENANCE: "bg-yellow-100 text-yellow-700",
  OUT_OF_SERVICE:    "bg-red-100 text-red-700",
  DECOMMISSIONED:    "bg-slate-100 text-slate-500",
};

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [store, setStore]   = useState<Store | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    Promise.all([
      api.listStores().then((stores) => stores.find((s) => s.id === id) ?? null),
      api.listAssets({ store: id }),
    ])
      .then(([s, a]) => { setStore(s); setAssets(a.results); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PortalShell>
      <div className="mb-8">
        <Link href="/portal/stores" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Stores
        </Link>
        {store && (
          <>
            <h1 className="text-2xl font-bold text-slate-900">{store.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {[store.address_line1, store.city, store.state].filter(Boolean).join(", ") || "No address on file"}
            </p>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">
              Assets <span className="text-slate-400 font-normal">({assets.length})</span>
            </h2>
          </div>

          {assets.length === 0 ? (
            <div className="py-16 text-center text-slate-400">No assets at this store.</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {assets.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{a.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {AssetCategoryLabels[a.category] ?? a.category}
                      {a.make ? ` · ${a.make}` : ""}
                      {a.model_number ? ` · ${a.model_number}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] ?? "bg-slate-100 text-slate-500"}`}>
                    {AssetStatusLabels[a.status] ?? a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PortalShell>
  );
}
