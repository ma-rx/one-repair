"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, Part, EquipmentModel } from "@/lib/api";
import { AssetCategoryLabels } from "@/types/enums";
import {
  Package, AlertTriangle, Plus, Pencil,
  Loader2, Search, X, Upload, Trash2,
} from "lucide-react";
import CsvImportModal from "@/components/CsvImportModal";

const ASSET_CATEGORIES = Object.keys(AssetCategoryLabels);

type PartForm = {
  name: string;
  sku: string;
  asset_category: string;
  make: string;
  model_number: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
  unit_price: string;
  selling_price: string;
  vendor: string;
  compatible_model_ids: string[];
};

const emptyForm = (): PartForm => ({
  name: "",
  sku: "",
  asset_category: "OTHER",
  make: "",
  model_number: "",
  quantity_on_hand: 0,
  low_stock_threshold: 2,
  unit_price: "0.00",
  selling_price: "0.00",
  vendor: "",
  compatible_model_ids: [],
});

export default function InventoryPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [equipmentModels, setEquipmentModels] = useState<EquipmentModel[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function load() {
    setLoading(true);
    api.listParts(categoryFilter || undefined)
      .then(setParts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [categoryFilter]);

  useEffect(() => {
    api.listEquipmentModels().then(setEquipmentModels).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(p: Part) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      asset_category: p.asset_category,
      make: p.make,
      model_number: p.model_number,
      quantity_on_hand: p.quantity_on_hand,
      low_stock_threshold: p.low_stock_threshold,
      unit_price: p.unit_price,
      selling_price: p.selling_price ?? "0.00",
      vendor: p.vendor ?? "",
      compatible_model_ids: p.compatible_models_display.map((m) => m.id),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleDelete(part: Part) {
    if (!confirm(`Delete "${part.name}"? This cannot be undone.`)) return;
    setDeletingId(part.id);
    try {
      await api.deletePart(part.id);
      setParts((prev) => prev.filter((p) => p.id !== part.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        const updated = await api.updatePart(editing.id, form);
        setParts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await api.createPart(form);
        setParts((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = parts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = parts.filter((p) => p.is_low_stock).length;
  const totalValue = parts.reduce(
    (sum, p) => sum + p.quantity_on_hand * parseFloat(p.unit_price),
    0
  );

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Inventory</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage ORS parts stock</p>
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
            <Plus className="w-4 h-4" /> Add Part
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{parts.length}</p>
            <p className="text-slate-500 text-sm">Total SKUs</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{lowStockCount}</p>
            <p className="text-slate-500 text-sm">Low Stock</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Package className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">${totalValue.toFixed(0)}</p>
            <p className="text-slate-500 text-sm">Inventory Value</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search parts…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Equipment Types</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>{AssetCategoryLabels[c] ?? c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No parts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Part</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">SKU</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Equipment Type</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Vendor</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Qty on Hand</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Cost</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Sell</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Stock</th>
                <th className="px-6 py-3 text-right text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${p.is_low_stock ? "bg-amber-50/40" : ""}`}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    {(p.make || p.model_number) && (
                      <p className="text-slate-400 text-xs mt-0.5">{[p.make, p.model_number].filter(Boolean).join(" · ")}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500 text-xs">{p.sku || "—"}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {AssetCategoryLabels[p.asset_category] ?? p.asset_category}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{p.vendor || "—"}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{p.quantity_on_hand}</td>
                  <td className="px-6 py-4 text-slate-600">${parseFloat(p.unit_price).toFixed(2)}</td>
                  <td className="px-6 py-4 text-slate-600">${parseFloat(p.selling_price ?? "0").toFixed(2)}</td>
                  <td className="px-6 py-4">
                    {p.is_low_stock ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <AlertTriangle className="w-3 h-3" /> Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                        className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CSV Import Modal */}
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Parts from CSV"
        templateFilename="parts_template.csv"
        columns={[
          { key: "name",              label: "name",              required: true,  hint: "Compressor - Scroll 3-Ton" },
          { key: "sku",               label: "sku",               hint: "JC-123" },
          { key: "asset_category",    label: "asset_category",    hint: "REFRIGERATION" },
          { key: "make",              label: "make",              hint: "Copeland" },
          { key: "model_number",      label: "model_number",      hint: "ZR36K3E" },
          { key: "quantity_on_hand",  label: "quantity_on_hand",  hint: "5" },
          { key: "low_stock_threshold", label: "low_stock_threshold", hint: "2" },
          { key: "unit_price",        label: "unit_price",        hint: "250.00" },
          { key: "selling_price",     label: "selling_price",     hint: "399.00" },
          { key: "vendor",            label: "vendor",            hint: "Johnstone Supply" },
          { key: "compatible_models", label: "compatible_models", hint: "Copeland:ZR36K3E|Copeland:ZR42K3E" },
        ]}
        onParseRow={(raw) => {
          const errors: string[] = [];
          if (!raw.name?.trim()) errors.push("name is required");
          const qty = parseInt(raw.quantity_on_hand ?? "0");
          if (isNaN(qty) || qty < 0) errors.push("quantity_on_hand must be a non-negative number");
          const validAssetCats = Object.keys(AssetCategoryLabels);
          if (raw.asset_category && !validAssetCats.includes(raw.asset_category.trim().toUpperCase()))
            errors.push(`asset_category must be one of: ${validAssetCats.join(", ")}`);

          // Resolve compatible_models: "Make:ModelNumber|Make:ModelNumber" → UUIDs
          const compatible_model_ids: string[] = [];
          if (raw.compatible_models?.trim()) {
            const pairs = raw.compatible_models.split("|").map((s: string) => s.trim()).filter(Boolean);
            for (const pair of pairs) {
              const colonIdx = pair.indexOf(":");
              if (colonIdx === -1) { errors.push(`compatible_models: "${pair}" must be in Make:ModelNumber format`); continue; }
              const make = pair.slice(0, colonIdx).trim().toLowerCase();
              const modelNum = pair.slice(colonIdx + 1).trim().toLowerCase();
              const match = equipmentModels.find(
                (m) => m.make.toLowerCase() === make && m.model_number.toLowerCase() === modelNum
              );
              if (match) {
                compatible_model_ids.push(match.id);
              } else {
                errors.push(`compatible_models: no equipment model found for "${pair}"`);
              }
            }
          }

          return {
            data: {
              name:               raw.name?.trim() ?? "",
              sku:                raw.sku?.trim() ?? "",
              asset_category:     raw.asset_category?.trim().toUpperCase() || "OTHER",
              make:               raw.make?.trim() ?? "",
              model_number:       raw.model_number?.trim() ?? "",
              quantity_on_hand:   parseInt(raw.quantity_on_hand ?? "0") || 0,
              low_stock_threshold: parseInt(raw.low_stock_threshold ?? "2") || 2,
              unit_price:         raw.unit_price?.replace(/[$,]/g, "").trim() || "0.00",
              selling_price:      raw.selling_price?.replace(/[$,]/g, "").trim() || "0.00",
              vendor:             raw.vendor?.trim() ?? "",
              compatible_model_ids,
            },
            errors,
          };
        }}
        onImportRow={(data) => api.createPart(data as Parameters<typeof api.createPart>[0])}
        onComplete={(succeeded) => {
          if (succeeded > 0) load();
        }}
      />

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Part" : "Add Part"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Equipment Type</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.asset_category}
                onChange={(e) => setForm({ ...form, asset_category: e.target.value })}
              >
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{AssetCategoryLabels[c] ?? c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Make</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model Number</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.model_number}
                onChange={(e) => setForm({ ...form, model_number: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Qty on Hand</label>
              <input
                type="number"
                min="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.quantity_on_hand}
                onChange={(e) => setForm({ ...form, quantity_on_hand: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Low Stock Alert At</label>
              <input
                type="number"
                min="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.low_stock_threshold}
                onChange={(e) => setForm({ ...form, low_stock_threshold: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Vendor / Supplier</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g. Johnstone Supply"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Compatible Equipment Models</label>
              <div className="border border-slate-300 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {equipmentModels.length === 0 ? (
                  <p className="text-slate-400 text-xs px-3 py-2">No equipment models loaded.</p>
                ) : (
                  equipmentModels.map((m) => {
                    const checked = form.compatible_model_ids.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${checked ? "bg-blue-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="accent-blue-600"
                          checked={checked}
                          onChange={() => {
                            setForm((prev) => ({
                              ...prev,
                              compatible_model_ids: checked
                                ? prev.compatible_model_ids.filter((id) => id !== m.id)
                                : [...prev.compatible_model_ids, m.id],
                            }));
                          }}
                        />
                        <span className="font-mono text-xs text-slate-600">{m.make} {m.model_number}</span>
                        {m.model_name && <span className="text-slate-400 text-xs">— {m.model_name}</span>}
                      </label>
                    );
                  })
                )}
              </div>
              {form.compatible_model_ids.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">{form.compatible_model_ids.length} model{form.compatible_model_ids.length > 1 ? "s" : ""} selected</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Part"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
