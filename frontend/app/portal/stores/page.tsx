"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import { api, Store } from "@/lib/api";
import { MapPin, Loader2, ChevronRight } from "lucide-react";

export default function PortalStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listStores()
      .then(setStores)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PortalShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Stores</h1>
        <p className="text-slate-500 text-sm mt-0.5">All locations in your organization</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stores.map((s) => (
            <Link key={s.id} href={`/portal/stores/${s.id}`} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all block">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 truncate">{s.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                  </p>
                  <p className="text-slate-400 text-xs mt-2">{s.asset_count} assets</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
