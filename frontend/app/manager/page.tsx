"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, Ticket, Asset, WorkImage } from "@/lib/api";
import { LogOut, Plus, Loader2, X, Camera, CheckCircle2, Trash2 } from "lucide-react";

const statusStyle: Record<string, string> = {
  OPEN:          "bg-red-100 text-red-700",
  DISPATCHED:    "bg-purple-100 text-purple-700",
  IN_PROGRESS:   "bg-blue-100 text-blue-700",
  PENDING_PARTS: "bg-amber-100 text-amber-700",
  RESOLVED:      "bg-green-100 text-green-700",
};

type FormStep = "form" | "photos" | "success";

const OTHER_ASSET = "__other__";

interface AssetRow {
  assetId: string;
  customAsset: string;
}

export default function ManagerPage() {
  const { user, logout } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<FormStep>("form");

  // Multi-asset rows
  const [assetRows, setAssetRows] = useState<AssetRow[]>([{ assetId: "", customAsset: "" }]);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Photo upload
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [images, setImages] = useState<WorkImage[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storeId = user?.store?.id;

  useEffect(() => {
    if (!storeId) return;
    Promise.all([
      api.listTickets(),
      api.listAssets({ store: storeId, active: true }),
    ])
      .then(([t, a]) => {
        setTickets(t.filter((tk) => ["OPEN", "IN_PROGRESS", "PENDING_PARTS"].includes(tk.status)));
        setAssets(a.results);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  function updateRow(i: number, patch: Partial<AssetRow>) {
    setAssetRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addRow() {
    setAssetRows((prev) => [...prev, { assetId: "", customAsset: "" }]);
  }

  function removeRow(i: number) {
    setAssetRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validRows = assetRows.filter((r) => r.assetId);
    if (validRows.length === 0 || !description.trim()) {
      setFormError("Select at least one piece of equipment and describe the issue.");
      return;
    }
    const badOther = validRows.filter((r) => r.assetId === OTHER_ASSET && !r.customAsset.trim());
    if (badOther.length > 0) { setFormError("Describe the unlisted equipment."); return; }
    setFormError("");
    setSubmitting(true);
    try {
      const firstRow = validRows[0];
      const ticket = await api.createTicket({
        ...(firstRow.assetId !== OTHER_ASSET ? { asset: firstRow.assetId } : {}),
        ...(firstRow.assetId === OTHER_ASSET ? { asset_description: firstRow.customAsset.trim(), store: storeId ?? undefined } : {}),
        description: description.trim(),
        priority,
        opened_by: user?.id,
      });

      // Add additional assets
      for (let i = 1; i < validRows.length; i++) {
        const row = validRows[i];
        await api.addTicketAsset(ticket.id, {
          ...(row.assetId !== OTHER_ASSET ? { asset_id: row.assetId } : {}),
          ...(row.assetId === OTHER_ASSET ? { asset_description: row.customAsset.trim() } : {}),
        });
      }

      setTicketId(ticket.id);
      setTickets((prev) => [ticket, ...prev]);
      setFormStep("photos");
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to submit.");
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
    } catch { /* ignore */ } finally {
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

  function closeForm() {
    setShowForm(false);
    setFormStep("form");
    setAssetRows([{ assetId: "", customAsset: "" }]);
    setDescription("");
    setPriority("MEDIUM");
    setTicketId(null);
    setImages([]);
    setFormError("");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Logo" className="w-9 h-9 rounded-lg" />
          <div>
            <p className="font-semibold text-slate-800 text-sm">{user?.store?.name ?? "My Store"}</p>
            <p className="text-slate-400 text-xs">Store Manager View</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => { setShowForm(true); setFormStep("form"); }}
          className="w-full mb-8 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold py-4 rounded-xl transition-colors"
        >
          <Plus className="w-5 h-5" />
          Report Equipment Issue
        </button>

        {showForm && (
          <div className="mb-8 bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-800">
                {formStep === "form" ? "New Ticket" : formStep === "photos" ? "Add Photos" : "Submitted"}
              </h2>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form step */}
            {formStep === "form" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Equipment</label>
                    <button type="button" onClick={addRow}
                      className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:text-blue-700">
                      <Plus className="w-3.5 h-3.5" /> Add another
                    </button>
                  </div>
                  <div className="space-y-2">
                    {assetRows.map((row, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <select
                            value={row.assetId}
                            onChange={(e) => updateRow(i, { assetId: e.target.value, customAsset: "" })}
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select equipment…</option>
                            {assets.map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                            <option value={OTHER_ASSET}>Other / Not listed</option>
                          </select>
                          {i > 0 && (
                            <button type="button" onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {row.assetId === OTHER_ASSET && (
                          <input
                            type="text"
                            className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            placeholder="Describe the equipment (e.g. Walk-in cooler, POS terminal…)"
                            value={row.customAsset}
                            onChange={(e) => updateRow(i, { customAsset: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Describe the issue</label>
                  <textarea
                    rows={4}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="e.g. machine not turning on, making a loud noise, displaying an error code…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                {formError && <p className="text-red-500 text-sm">{formError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Ticket
                </button>
              </form>
            )}

            {/* Photos step */}
            {formStep === "photos" && ticketId && (
              <div className="space-y-4">
                <div className="bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Ticket submitted! Add photos if helpful.
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700">Photos (optional)</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImg}
                      className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-700 disabled:opacity-50"
                    >
                      {uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      Add Photo
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                  </div>

                  {images.length === 0 ? (
                    <div
                      className="border-2 border-dashed border-slate-200 rounded-lg py-8 text-center text-slate-400 cursor-pointer hover:border-blue-300 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <p className="text-sm">Tap to add photos</p>
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
                  onClick={closeForm}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        <h2 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">Open Issues</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 text-sm">
            No open issues — all good!
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <a key={t.id} href={`/manager/tickets/${t.id}`} className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {t.assets && t.assets.length > 0
                        ? t.assets.map((ta) => ta.asset_name).join(", ")
                        : t.asset_name}
                    </p>
                    <p className="text-slate-500 text-sm mt-0.5">
                      {t.description || "No description"}
                    </p>
                    {t.assigned_tech_name && (
                      <p className="text-slate-400 text-xs mt-1">Tech: {t.assigned_tech_name}</p>
                    )}
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[t.status] ?? ""}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-3">{new Date(t.created_at).toLocaleDateString()}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
