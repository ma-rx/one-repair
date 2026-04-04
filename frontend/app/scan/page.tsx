"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DashboardShell from "@/components/DashboardShell";
import PortalShell from "@/components/PortalShell";
import { api, Asset, Store, WorkImage } from "@/lib/api";
import { CheckCircle2, Loader2, AlertCircle, Plus, X, Camera, Trash2 } from "lucide-react";

type Step = "select" | "describe" | "photos" | "success";

interface AssetRow {
  assetId: string;
  customAsset: string;
}

const OTHER_ASSET = "__other__";

function NewTicketForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");

  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  // Multi-asset rows
  const [assetRows, setAssetRows] = useState<AssetRow[]>([{ assetId: "", customAsset: "" }]);

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
    if (!storeId) { setAssets([]); setAssetRows([{ assetId: "", customAsset: "" }]); return; }
    setLoadingAssets(true);
    api.listAssets({ store: storeId, active: true })
      .then((data) => setAssets(data.results))
      .catch(() => setError("Failed to load assets."))
      .finally(() => setLoadingAssets(false));
  }, [storeId]);

  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.serial_number.toLowerCase().includes(assetSearch.toLowerCase())
  );

  const selectedStore = stores.find((s) => s.id === storeId);
  const firstRow = assetRows[0];
  const firstAsset = assets.find((a) => a.id === firstRow?.assetId);

  function updateRow(i: number, patch: Partial<AssetRow>) {
    setAssetRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addRow() {
    setAssetRows((prev) => [...prev, { assetId: "", customAsset: "" }]);
  }

  function removeRow(i: number) {
    setAssetRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const canContinue = storeId &&
    assetRows.length > 0 &&
    assetRows.every((r) => r.assetId && (r.assetId !== OTHER_ASSET || r.customAsset.trim()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId || assetRows.length === 0 || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const firstRow = assetRows[0];
      const isTech = user?.role === "TECH";
      const todayStr = new Date().toISOString().slice(0, 10);
      const ticket = await api.createTicket({
        ...(firstRow.assetId !== OTHER_ASSET ? { asset: firstRow.assetId } : {}),
        ...(firstRow.assetId === OTHER_ASSET ? { asset_description: firstRow.customAsset.trim(), store: storeId } : {}),
        description: description.trim(),
        priority,
        opened_by: user?.id,
        ...(isTech ? { assigned_tech: user?.id, scheduled_date: todayStr, status: "DISPATCHED" } : {}),
      });

      // Add additional assets
      for (let i = 1; i < assetRows.length; i++) {
        const row = assetRows[i];
        if (!row.assetId) continue;
        await api.addTicketAsset(ticket.id, {
          ...(row.assetId !== OTHER_ASSET ? { asset_id: row.assetId } : {}),
          ...(row.assetId === OTHER_ASSET ? { asset_description: row.customAsset.trim() } : {}),
        });
      }

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
    setAssetRows([{ assetId: "", customAsset: "" }]);
    setAssetSearch("");
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

        {/* Step 1: Select store + assets */}
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
                  onChange={(e) => { setStoreId(e.target.value); setAssetSearch(""); }}
                >
                  <option value="">Select your store…</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {storeId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">
                    Equipment <span className="text-red-500">*</span>
                  </label>
                  <button type="button" onClick={addRow}
                    className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:text-blue-700">
                    <Plus className="w-3.5 h-3.5" /> Add another asset
                  </button>
                </div>

                {loadingAssets ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading equipment…
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search by name or serial number…"
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                    />

                    {assetRows.map((row, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-5 shrink-0">{i + 1}.</span>
                          <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                            {(assetSearch ? filteredAssets : assets).map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className={`w-full text-left px-4 py-2.5 text-sm border-b border-slate-100 transition-colors ${
                                  row.assetId === a.id
                                    ? "bg-blue-50 text-blue-700"
                                    : "hover:bg-slate-50 text-slate-800"
                                }`}
                                onClick={() => updateRow(i, { assetId: a.id, customAsset: "" })}
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
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-t border-slate-100 ${
                                row.assetId === OTHER_ASSET
                                  ? "bg-amber-50 text-amber-700"
                                  : "hover:bg-slate-50 text-slate-500 italic"
                              }`}
                              onClick={() => updateRow(i, { assetId: OTHER_ASSET })}
                            >
                              Other / Not listed
                            </button>
                          </div>
                          {i > 0 && (
                            <button type="button" onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-500 shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {row.assetId === OTHER_ASSET && (
                          <input
                            type="text"
                            autoFocus={i === assetRows.length - 1}
                            className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ml-7"
                            placeholder="Describe the equipment (e.g. Walk-in cooler, POS terminal…)"
                            value={row.customAsset}
                            onChange={(e) => updateRow(i, { customAsset: e.target.value })}
                            required
                          />
                        )}
                        {row.assetId && row.assetId !== OTHER_ASSET && (
                          <p className="text-xs text-blue-600 ml-7">
                            Selected: {assets.find((a) => a.id === row.assetId)?.name}
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <button
              disabled={!canContinue}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
              onClick={() => setStep("describe")}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Describe the issue */}
        {step === "describe" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-400 mb-0.5">Selected Equipment</p>
              <div className="flex flex-wrap gap-1">
                {assetRows.map((row, i) => {
                  const name = row.assetId === OTHER_ASSET
                    ? row.customAsset
                    : assets.find((a) => a.id === row.assetId)?.name ?? "";
                  return (
                    <span key={i} className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                      {name}
                    </span>
                  );
                })}
              </div>
              <p className="text-slate-500 text-xs mt-1">{selectedStore?.name}</p>
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
              {user?.role !== "TECH" && (
                <p className="text-slate-400 text-xs mt-1">An admin will assign a technician shortly.</p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                onClick={reset}
              >
                Open Another Ticket
              </button>
              {user?.role === "TECH" && (
                <button
                  className="border border-slate-300 text-slate-600 px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                  onClick={() => router.push("/tech")}
                >
                  Back to My Tickets
                </button>
              )}
            </div>
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
  if (user?.role === "TECH") {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <NewTicketForm />
      </div>
    );
  }
  return <DashboardShell><NewTicketForm /></DashboardShell>;
}
