"use client";

import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { api, Store } from "@/lib/api";
import { MapPin, Loader2 } from "lucide-react";

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
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{s.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                  </p>
                  <p className="text-slate-400 text-xs mt-2">{s.asset_count} assets</p>
                </div>
                <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                  s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {s.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
