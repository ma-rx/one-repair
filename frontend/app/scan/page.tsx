"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, Asset } from "@/lib/api";
import { SymptomCodeLabels } from "@/types/enums";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

// Placeholder stores — will come from API once auth/org context is wired up
const MOCK_STORES = [
  { id: "store-001", name: "Downtown Store" },
  { id: "store-002", name: "Westside Store" },
  { id: "store-003", name: "Eastside Store" },
  { id: "store-004", name: "Northside Store" },
];

type Step = "select" | "symptom" | "success";

export default function NewTicketPage() {
  const [step, setStep] = useState<Step>("select");

  const [storeId, setStoreId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [symptomCode, setSymptomCode] = useState("");

  const [loadingAssets, setLoadingAssets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);

  // Load assets when store changes
  useEffect(() => {
    if (!storeId) { setAssets([]); setAssetId(""); return; }
    setLoadingAssets(true);
    api.listAssets()
      .then((all) => setAssets(all.filter((a) => a.store === storeId)))
      .catch(() => setError("Failed to load assets."))
      .finally(() => setLoadingAssets(false));
  }, [storeId]);

  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.serial_number.toLowerCase().includes(assetSearch.toLowerCase())
  );

  const selectedAsset = assets.find((a) => a.id === assetId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetId || !symptomCode) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await api.createTicket({ asset: assetId, symptom_code: symptomCode });
      setTicketId(ticket.id);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to create ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("select");
    setStoreId("");
    setAssets([]);
    setAssetId("");
    setAssetSearch("");
    setSymptomCode("");
    setTicketId(null);
    setError(null);
  }

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Open New Ticket</h1>
          <p className="text-slate-500 text-sm mt-0.5">Select the store and equipment to report an issue</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Step: Select store + asset */}
          {step === "select" && (
            <div className="space-y-5">
              {/* Store */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Store <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={storeId}
                  onChange={(e) => { setStoreId(e.target.value); setAssetId(""); setAssetSearch(""); }}
                >
                  <option value="">Select your store...</option>
                  {MOCK_STORES.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Asset search + select */}
              {storeId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Equipment <span className="text-red-500">*</span>
                  </label>
                  {loadingAssets ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading equipment...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Search by name or serial number..."
                        value={assetSearch}
                        onChange={(e) => setAssetSearch(e.target.value)}
                      />
                      {filteredAssets.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-4">
                          {assets.length === 0 ? "No equipment found for this store." : "No results."}
                        </p>
                      ) : (
                        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                          {filteredAssets.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 last:border-none transition-colors ${
                                assetId === a.id
                                  ? "bg-blue-50 text-blue-700"
                                  : "hover:bg-slate-50 text-slate-800"
                              }`}
                              onClick={() => setAssetId(a.id)}
                            >
                              <p className="font-medium">{a.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {a.model_number && `Model: ${a.model_number}`}
                                {a.serial_number && ` · S/N: ${a.serial_number}`}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                disabled={!storeId || !assetId}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                onClick={() => setStep("symptom")}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step: Symptom */}
          {step === "symptom" && selectedAsset && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Selected asset recap */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-400 mb-0.5">Selected Equipment</p>
                <p className="font-semibold text-slate-800">{selectedAsset.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {MOCK_STORES.find((s) => s.id === storeId)?.name}
                  {selectedAsset.serial_number && ` · S/N: ${selectedAsset.serial_number}`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  What is the issue? <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={symptomCode}
                  onChange={(e) => setSymptomCode(e.target.value)}
                  required
                >
                  <option value="">Select symptom...</option>
                  {Object.entries(SymptomCodeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                  onClick={() => setStep("select")}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!symptomCode || submitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Open Ticket
                </button>
              </div>
            </form>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-lg">Ticket Opened</p>
                <p className="text-slate-500 text-sm mt-1">
                  ID: <span className="font-mono">{ticketId?.slice(0, 8).toUpperCase()}</span>
                </p>
                <p className="text-slate-400 text-xs mt-1">An admin will assign a technician shortly.</p>
              </div>
              <button
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                onClick={reset}
              >
                Open Another Ticket
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
