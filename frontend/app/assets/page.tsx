"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, Asset, EquipmentModel, Store } from "@/lib/api";
import {
  AssetCategoryLabels, AssetStatusLabels,
} from "@/types/enums";
import {
  Cpu, Plus, Pencil, Loader2, AlertCircle,
  CheckCircle2, AlertTriangle, XCircle, MinusCircle, Upload, Trash2,
} from "lucide-react";
import CsvImportModal from "@/components/CsvImportModal";

const STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ElementType }> = {
  OPERATIONAL:       { label: "Operational",       style: "bg-emerald-100 text-emerald-700", icon: CheckCircle2  },
  UNDER_MAINTENANCE: { label: "Under Maintenance", style: "bg-amber-100 text-amber-700",    icon: AlertTriangle },
  OUT_OF_SERVICE:    { label: "Out of Service",    style: "bg-red-100 text-red-700",         icon: XCircle       },
  DECOMMISSIONED:    { label: "Decommissioned",    style: "bg-slate-100 text-slate-500",     icon: MinusCircle   },
};

const EMPTY: Partial<Asset> = {
  name: "", category: "OTHER", make: "", model_number: "",
  serial_number: "", install_date: "", warranty_expiry: "",
  status: "OPERATIONAL", store: "", is_active: true, equipment_model: null,
};

export default function AssetsPage() {
  const [assets, setAssets]             = useState<Asset[]>([]);
  const [stores, setStores]             = useState<Store[]>([]);
  const [equipmentModels, setEquipmentModels] = useState<EquipmentModel[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [filterStore, setFilterStore]       = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus]     = useState("");
  const [modalOpen, setModalOpen]   = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing]       = useState<Asset | null>(null);
  const [form, setForm]             = useState<Partial<Asset>>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listAssets(), api.listStores(), api.listEquipmentModels()])
      .then(([a, s, em]) => { setAssets(a); setStores(s); setEquipmentModels(em); })
      .catch(() => setError("Failed to load assets."))
      .finally(() => setLoading(false));
  }, []);

  const displayed = assets.filter((a) => {
    if (filterStore    && a.store    !== filterStore)    return false;
    if (filterCategory && a.category !== filterCategory) return false;
    if (filterStatus   && a.status   !== filterStatus)   return false;
    return true;
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditing(asset);
    setForm({
      name: asset.name, category: asset.category, make: asset.make,
      model_number: asset.model_number, serial_number: asset.serial_number,
      install_date: asset.install_date ?? "", warranty_expiry: asset.warranty_expiry ?? "",
      status: asset.status, store: asset.store, is_active: asset.is_active,
      equipment_model: asset.equipment_model,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const body = {
      ...form,
      install_date:    form.install_date    || null,
      warranty_expiry: form.warranty_expiry || null,
    };
    try {
      if (editing) {
        const updated = await api.updateAsset(editing.id, body);
        setAssets((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      } else {
        const created = await api.createAsset(body);
        setAssets((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(asset: Asset) {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    setDeletingId(asset.id);
    try {
      await api.deleteAsset(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  const set = (key: keyof Asset) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assets</h1>
          <p className="text-slate-500 text-sm mt-0.5">All equipment across your stores</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
        >
          <option value="">All Stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {Object.entries(AssetCategoryLabels).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(AssetStatusLabels).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        {(filterStore || filterCategory || filterStatus) && (
          <button
            onClick={() => { setFilterStore(""); setFilterCategory(""); setFilterStatus(""); }}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Clear filters
          </button>
        )}

        <span className="text-slate-400 text-sm ml-auto">{displayed.length} asset{displayed.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {displayed.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Cpu className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No assets found</p>
              <p className="text-sm mt-1">
                {assets.length === 0 ? "Add your first asset to get started." : "Try adjusting your filters."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Asset</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Category</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Equipment Model</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Serial #</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Store</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Warranty</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {displayed.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.OPERATIONAL;
                  const Icon = cfg.icon;
                  const warrantyExpired = a.warranty_expiry && new Date(a.warranty_expiry) < new Date();
                  return (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{a.name}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded">
                          {AssetCategoryLabels[a.category] ?? a.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {a.equipment_model_display
                          ? <span className="font-medium text-slate-700">{a.equipment_model_display.make} <span className="font-mono text-xs">{a.equipment_model_display.model_number}</span></span>
                          : <span className="text-slate-300 text-xs">Not linked</span>
                        }
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                        {a.serial_number || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{a.store_name}</td>
                      <td className="px-6 py-4">
                        {a.warranty_expiry ? (
                          <span className={`text-xs font-medium ${warrantyExpired ? "text-red-500" : "text-slate-500"}`}>
                            {warrantyExpired ? "Expired " : ""}{a.warranty_expiry}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.style}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-blue-600 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(a)} disabled={deletingId === a.id} className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50">
                            {deletingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Assets from CSV"
        templateFilename="assets_template.csv"
        columns={[
          { key: "store_name",        label: "store_name",        required: true, hint: "Downtown Location" },
          { key: "equipment_model",   label: "equipment_model",   required: true, hint: "True:T-49-HC" },
          { key: "serial_number",     label: "serial_number",     hint: "SN123456" },
          { key: "name",              label: "name",              hint: "Walk-in Freezer #2 (leave blank to auto-generate)" },
          { key: "install_date",      label: "install_date",      hint: "2022-06-15" },
          { key: "warranty_expiry",   label: "warranty_expiry",   hint: "2027-06-15" },
          { key: "status",            label: "status",            hint: "OPERATIONAL" },
        ]}
        onParseRow={(raw) => {
          const errors: string[] = [];

          if (!raw.store_name?.trim()) errors.push("store_name is required");
          if (!raw.equipment_model?.trim()) errors.push("equipment_model is required (Make:ModelNumber)");

          const storeMatch = stores.find(
            (s) => s.name.toLowerCase() === raw.store_name?.trim().toLowerCase()
          );
          if (raw.store_name?.trim() && !storeMatch)
            errors.push(`Store "${raw.store_name.trim()}" not found`);

          // Resolve equipment model
          let modelMatch: EquipmentModel | undefined;
          if (raw.equipment_model?.trim()) {
            const colonIdx = raw.equipment_model.indexOf(":");
            if (colonIdx === -1) {
              errors.push(`equipment_model must be in Make:ModelNumber format`);
            } else {
              const make = raw.equipment_model.slice(0, colonIdx).trim().toLowerCase();
              const modelNum = raw.equipment_model.slice(colonIdx + 1).trim().toLowerCase();
              modelMatch = equipmentModels.find(
                (m) => m.make.toLowerCase() === make && m.model_number.toLowerCase() === modelNum
              );
              if (!modelMatch) errors.push(`Equipment model "${raw.equipment_model.trim()}" not found`);
            }
          }

          const validStatuses = ["OPERATIONAL", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DECOMMISSIONED"];
          if (raw.status && !validStatuses.includes(raw.status.trim().toUpperCase()))
            errors.push(`status must be one of: ${validStatuses.join(", ")}`);

          const serial = raw.serial_number?.trim() ?? "";
          const autoName = modelMatch
            ? `${modelMatch.make} ${modelMatch.model_number}${serial ? ` — ${serial}` : ""}`
            : "";

          return {
            data: {
              store:           storeMatch?.id ?? "",
              equipment_model: modelMatch?.id ?? null,
              category:        modelMatch?.category ?? "OTHER",
              make:            modelMatch?.make ?? "",
              model_number:    modelMatch?.model_number ?? "",
              name:            raw.name?.trim() || autoName,
              serial_number:   serial,
              install_date:    raw.install_date?.trim() || null,
              warranty_expiry: raw.warranty_expiry?.trim() || null,
              status:          raw.status?.trim().toUpperCase() || "OPERATIONAL",
              is_active:       true,
            },
            errors,
          };
        }}
        onImportRow={(data) => api.createAsset(data as Partial<Asset>)}
        onComplete={(succeeded) => {
          if (succeeded > 0) {
            api.listAssets().then(setAssets).catch(() => {});
          }
        }}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editing ? "Edit Asset" : "New Asset"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        width="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Store */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Store <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.store ?? ""}
                onChange={set("store")}
              >
                <option value="">Select store...</option>
                {stores.filter((s) => s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Equipment Model */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Equipment Model</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.equipment_model ?? ""}
                onChange={(e) => {
                  const selected = equipmentModels.find((m) => m.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    equipment_model: e.target.value || null,
                    ...(selected ? { category: selected.category, make: selected.make, model_number: selected.model_number } : {}),
                  }));
                }}
              >
                <option value="">— not linked —</option>
                {equipmentModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.make} {m.model_number}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Linking auto-fills category, make, and model number.</p>
            </div>

            {/* Name */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Asset Name <span className="text-red-500">*</span>
              </label>
              <input
                required type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder='e.g. "Walk-in Freezer #2"'
                value={form.name ?? ""}
                onChange={set("name")}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.category ?? "OTHER"}
                onChange={set("category")}
              >
                {Object.entries(AssetCategoryLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.status ?? "OPERATIONAL"}
                onChange={set("status")}
              >
                {Object.entries(AssetStatusLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Make */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Make</label>
              <input type="text" placeholder="e.g. Carrier"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.make ?? ""} onChange={set("make")} />
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Model Number</label>
              <input type="text" placeholder="e.g. 38CKC060"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.model_number ?? ""} onChange={set("model_number")} />
            </div>

            {/* Serial */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Serial Number</label>
              <input type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.serial_number ?? ""} onChange={set("serial_number")} />
            </div>

            {/* Install date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Install Date</label>
              <input type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.install_date ?? ""} onChange={set("install_date")} />
            </div>

            {/* Warranty expiry */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Warranty Expiry</label>
              <input type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.warranty_expiry ?? ""} onChange={set("warranty_expiry")} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-blue-600"
              checked={form.is_active ?? true}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Asset"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
