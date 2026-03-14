"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardShell from "@/components/DashboardShell";
import PortalShell from "@/components/PortalShell";
import { api, Asset, Store, WorkImage } from "@/lib/api";
import { CheckCircle2, Loader2, AlertCircle, Plus, X, Camera } from "lucide-react";

type Step = "select" | "describe" | "photos" | "success";

function NewTicketForm() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("select");

  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [customAsset, setCustomAsset] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const OTHER_ASSET = "__other__";

  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ticketId, setTicketId] = useState<string | null>(null);
  const [images, setImages] = useState<WorkImage[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listStores()
      .then((s) => setStores(s.filter((st) => st.is_active)))
      .catch(() => setError("Failed to load stores."))
      .finally(() => setLoadingStores(false));
  }, []);

  useEffect(() => {
    if (!storeId) { setAssets([]); setAssetId(""); return; }
    setLoadingAssets(true);
    api.listAssets({ store: storeId, active: true })
      .then(setAssets)
      .catch(() => setError("Failed to load assets."))
      .finally(() => setLoadingAssets(false));
  }, [storeId]);

  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.serial_number.toLowerCase().includes(assetSearch.toLowerCase())
  );

  const selectedAsset = assets.find((a) => a.id === assetId);
  const selectedStore = stores.find((s) => s.id === storeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId || !assetId || !description.trim()) return;
    if (assetId === OTHER_ASSET && !customAsset.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await api.createTicket({
        ...(assetId !== OTHER_ASSET ? { asset: assetId } : {}),
        ...(assetId === OTHER_ASSET ? { asset_description: customAsset.trim(), store: storeId } : {}),
        description: description.trim(),
        priority,
        opened_by: user?.id,
      });
      setTicketId(ticket.id);
      setStep("photos");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !ticketId) return;
    setUploadingImg(true);
    try {
      const img = await api.uploadWorkImage(ticketId, file);
      setImages((prev) => [...prev, img]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteImage(imgId: string) {
    try {
      await api.deleteWorkImage(imgId);
      setImages((prev) => prev.filter((i) => i.id !== imgId));
    } catch { /* ignore */ }
  }

  function reset() {
    setStep("select");
    setStoreId("");
    setAssets([]);
    setAssetId("");
    setAssetSearch("");
    setCustomAsset("");
    setDescription("");
    setPriority("MEDIUM");
    setTicketId(null);
    setImages([]);
    setError(null);
  }

  return (
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

        {/* Step 1: Select store + asset */}
        {step === "select" && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Store <span className="text-red-500">*</span>
              </label>
              {loadingStores ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading stores…
                </div>
              ) : (
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={storeId}
                  onChange={(e) => { setStoreId(e.target.value); setAssetId(""); setAssetSearch(""); }}
                >
                  <option value="">Select your store…</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {storeId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Equipment <span className="text-red-500">*</span>
                </label>
                {loadingAssets ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading equipment…
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search by name or serial number…"
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                    />
                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                      {filteredAssets.length === 0 && assetSearch && (
                        <p className="text-slate-400 text-sm text-center py-4">No results.</p>
                      )}
                      {filteredAssets.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 transition-colors ${
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
                      {assets.length === 0 && !assetSearch && (
                        <p className="text-slate-400 text-sm text-center py-4">No equipment found for this store.</p>
                      )}
                      <button
                        type="button"
                        className={`w-full text-left px-4 py-3 text-sm transition-colors border-t border-slate-100 ${
                          assetId === OTHER_ASSET
                            ? "bg-amber-50 text-amber-700"
                            : "hover:bg-slate-50 text-slate-500 italic"
                        }`}
                        onClick={() => setAssetId(OTHER_ASSET)}
                      >
                        Other / Not listed
                      </button>
                    </div>
                    {assetId === OTHER_ASSET && (
                      <input
                        type="text"
                        autoFocus
                        className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mt-1"
                        placeholder="Describe the equipment (e.g. Walk-in cooler, POS terminal…)"
                        value={customAsset}
                        onChange={(e) => setCustomAsset(e.target.value)}
                        required
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              disabled={!storeId || !assetId || (assetId === OTHER_ASSET && !customAsset.trim())}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
              onClick={() => setStep("describe")}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Describe the issue */}
        {step === "describe" && (assetId === OTHER_ASSET || selectedAsset) && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-400 mb-0.5">Selected Equipment</p>
              <p className="font-semibold text-slate-800">
                {assetId === OTHER_ASSET ? customAsset : selectedAsset?.name}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {selectedStore?.name}
                {assetId !== OTHER_ASSET && selectedAsset?.serial_number && ` · S/N: ${selectedAsset.serial_number}`}
                {assetId === OTHER_ASSET && <span className="text-amber-600"> · Not in asset registry</span>}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Describe the issue <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="e.g. machine not turning on, error code displayed, leaking from bottom…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
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
                disabled={!description.trim() || submitting}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Open Ticket
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Add photos */}
        {step === "photos" && ticketId && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <Camera className="w-6 h-6 text-blue-600" />
              </div>
              <p className="font-semibold text-slate-800">Add Photos (Optional)</p>
              <p className="text-slate-400 text-sm mt-1">
                Ticket ID: <span className="font-mono">{ticketId.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-700">Photos</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImg}
                  className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-700 disabled:opacity-50"
                >
                  {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Photo
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>

              {images.length === 0 ? (
                <div
                  className="border-2 border-dashed border-slate-200 rounded-lg py-8 text-center text-slate-400 cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <p className="text-sm">Click to add photos</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img) => (
                    <div key={img.id} className="relative group aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Issue photo" className="w-full h-full object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                  <div
                    className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              )}
            </div>

            <button
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              onClick={() => setStep("success")}
            >
              Done
            </button>
          </div>
        )}

        {/* Step 4: Success */}
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
  );
}

export default function NewTicketPage() {
  const { user } = useAuth();

  if (user?.role === "CLIENT_ADMIN") {
    return <PortalShell><NewTicketForm /></PortalShell>;
  }
  return <DashboardShell><NewTicketForm /></DashboardShell>;
}
