"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, EquipmentModel } from "@/lib/api";
import { AssetCategoryLabels } from "@/types/enums";
import { Wrench, Plus, Pencil, Trash2, Loader2, AlertCircle, ChevronLeft } from "lucide-react";

const ASSET_CATEGORIES = Object.keys(AssetCategoryLabels);

type ModelForm = { make: string; model_number: string; model_name: string; category: string; description: string };
const emptyForm = (): ModelForm => ({ make: "", model_number: "", model_name: "", category: "REFRIGERATION", description: "" });

export default function EquipmentPage() {
  const [models, setModels]       = useState<EquipmentModel[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const [selectedMake, setSelectedMake] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<EquipmentModel | null>(null);
  const [form, setForm]           = useState<ModelForm>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.listEquipmentModels()
      .then(setModels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(m: EquipmentModel) {
    setEditing(m);
    setForm({ make: m.make, model_number: m.model_number, model_name: m.model_name, category: m.category, description: m.description });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.make.trim() || !form.model_number.trim()) { setFormError("Make and model number are required."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        const updated = await api.updateEquipmentModel(editing.id, form);
        setModels((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      } else {
        const created = await api.createEquipmentModel(form);
        setModels((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: EquipmentModel) {
    if (!confirm(`Delete "${m.make} ${m.model_number}"? This cannot be undone.`)) return;
    setDeletingId(m.id);
    try {
      await api.deleteEquipmentModel(m.id);
      setModels((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equipment Models</h1>
          <p className="text-slate-500 text-sm mt-0.5">Catalog of makes and models you service</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Model
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No equipment models yet</p>
          <p className="text-sm mt-1">Add the makes and models you service.</p>
        </div>
      ) : selectedMake === null ? (
        /* ── Makes grid ── */
        (() => {
          const makeGroups = Array.from(
            models.reduce((acc, m) => {
              if (!acc.has(m.make)) acc.set(m.make, []);
              acc.get(m.make)!.push(m);
              return acc;
            }, new Map<string, EquipmentModel[]>())
          ).sort(([a], [b]) => a.localeCompare(b));

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {makeGroups.map(([make, group]) => (
                <button
                  key={make}
                  onClick={() => setSelectedMake(make)}
                  className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-blue-400 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                    <Wrench className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="font-semibold text-slate-800 text-sm leading-tight">{make}</p>
                  <p className="text-slate-400 text-xs mt-1">{group.length} model{group.length !== 1 ? "s" : ""}</p>
                </button>
              ))}
            </div>
          );
        })()
      ) : (
        /* ── Models for selected make ── */
        (() => {
          const filtered = models.filter((m) => m.make === selectedMake);
          return (
            <>
              <button
                onClick={() => setSelectedMake(null)}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> All Makes
              </button>
              <h2 className="text-lg font-bold text-slate-800 mb-4">{selectedMake}</h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-slate-500 font-medium">Model Number</th>
                      <th className="text-left px-6 py-3 text-slate-500 font-medium">Model Name</th>
                      <th className="text-left px-6 py-3 text-slate-500 font-medium">Category</th>
                      <th className="text-left px-6 py-3 text-slate-500 font-medium">Instances</th>
                      <th className="text-left px-6 py-3 text-slate-500 font-medium">Notes</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-700">{m.model_number}</td>
                        <td className="px-6 py-4 text-slate-500">{m.model_name || "—"}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium">
                            {AssetCategoryLabels[m.category] ?? m.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{m.instance_count}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs max-w-xs truncate">{m.description || "—"}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => openEdit(m)} className="text-slate-400 hover:text-blue-600 transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(m)} disabled={deletingId === m.id} className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50">
                              {deletingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Equipment Model" : "Add Equipment Model"}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Make <span className="text-red-500">*</span></label>
              <input type="text" className={inputClass} value={form.make}
                onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                placeholder="e.g. Hoshizaki" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model Number <span className="text-red-500">*</span></label>
              <input type="text" className={inputClass} value={form.model_number}
                onChange={(e) => setForm((f) => ({ ...f, model_number: e.target.value }))}
                placeholder="e.g. KM-1301SAJ" required />
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Model Name (optional)</label>
            <input type="text" className={inputClass} value={form.model_name}
              onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
              placeholder="e.g. Two-Door Reach-In Refrigerator" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
            <select className={inputClass} value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{AssetCategoryLabels[c] ?? c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[60px]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Any useful notes about this model..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Model"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
