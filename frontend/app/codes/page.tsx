"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, SymptomCodeEntry, ResolutionCodeEntry } from "@/lib/api";
import { AssetCategoryLabels } from "@/types/enums";
import { Tag, Plus, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";

type CodeEntry = SymptomCodeEntry | ResolutionCodeEntry;

type Tab = "symptom" | "resolution";

const ASSET_CATEGORIES = Object.keys(AssetCategoryLabels);

type EntryForm = {
  code: string;
  label: string;
  make: string;
  asset_category: string;
  sort_order: number;
};

const emptyForm = (): EntryForm => ({
  code: "",
  label: "",
  make: "",
  asset_category: "",
  sort_order: 0,
});

const inputClass =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function CodesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("symptom");

  const [symptomCodes, setSymptomCodes] = useState<SymptomCodeEntry[]>([]);
  const [resolutionCodes, setResolutionCodes] = useState<ResolutionCodeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterMake, setFilterMake] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CodeEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<CodeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError("");
    Promise.all([api.listSymptomCodes(), api.listResolutionCodes()])
      .then(([s, r]) => {
        setSymptomCodes(s);
        setResolutionCodes(r);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const codes: CodeEntry[] =
    activeTab === "symptom" ? symptomCodes : resolutionCodes;

  const distinctMakes = Array.from(
    new Set(codes.map((c) => c.make).filter(Boolean))
  ).sort();

  const filtered = filterMake
    ? codes.filter((c) => c.make === filterMake)
    : codes;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(entry: CodeEntry) {
    setEditing(entry);
    setForm({
      code: entry.code,
      label: entry.label,
      make: entry.make,
      asset_category: entry.asset_category,
      sort_order: entry.sort_order,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (activeTab === "symptom") {
        if (editing) {
          const updated = await api.updateSymptomCode(editing.id, form);
          setSymptomCodes((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
        } else {
          const created = await api.createSymptomCode(form);
          setSymptomCodes((prev) => [...prev, created]);
        }
      } else {
        if (editing) {
          const updated = await api.updateResolutionCode(editing.id, form);
          setResolutionCodes((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
        } else {
          const created = await api.createResolutionCode(form);
          setResolutionCodes((prev) => [...prev, created]);
        }
      }
      setModalOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      if (activeTab === "symptom") {
        await api.deleteSymptomCode(deleteConfirm.id);
        setSymptomCodes((prev) => prev.filter((c) => c.id !== deleteConfirm.id));
      } else {
        await api.deleteResolutionCode(deleteConfirm.id);
        setResolutionCodes((prev) =>
          prev.filter((c) => c.id !== deleteConfirm.id)
        );
      }
      setDeleteConfirm(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const set =
    (key: keyof EntryForm) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        key === "sort_order" ? Number(ev.target.value) : ev.target.value;
      setForm((f) => ({ ...f, [key]: value }));
    };

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Codes</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage symptom and resolution codes for work orders
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Code
        </button>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {(["symptom", "resolution"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setFilterMake("");
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "symptom" ? "Symptom Codes" : "Resolution Codes"}
          </button>
        ))}
      </div>

      {/* Make filter */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterMake}
          onChange={(e) => setFilterMake(e.target.value)}
        >
          <option value="">All Makes (incl. Global)</option>
          <option value="">Global only</option>
          {distinctMakes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {filterMake && (
          <button
            onClick={() => setFilterMake("")}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Clear filter
          </button>
        )}

        <span className="text-slate-400 text-sm ml-auto">
          {filtered.length} code{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No codes yet</p>
          <p className="text-sm mt-1">Add the first code to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Code
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Label
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Make
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Category
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Order
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {entry.code}
                  </td>
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {entry.label}
                  </td>
                  <td className="px-4 py-3">
                    {entry.make ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {entry.make}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                        Global
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {entry.asset_category
                      ? (AssetCategoryLabels[entry.asset_category] ??
                        entry.asset_category)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {entry.sort_order}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(entry)}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(entry)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editing
            ? `Edit ${activeTab === "symptom" ? "Symptom" : "Resolution"} Code`
            : `New ${activeTab === "symptom" ? "Symptom" : "Resolution"} Code`
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              value={form.code}
              onChange={set("code")}
              placeholder="e.g. NO_POWER"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              value={form.label}
              onChange={set("label")}
              placeholder="e.g. No Power"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Make (optional — leave blank for global)
            </label>
            <input
              type="text"
              className={inputClass}
              value={form.make}
              onChange={set("make")}
              placeholder="Leave blank for global"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Asset Category (optional)
            </label>
            <select
              className={inputClass}
              value={form.asset_category}
              onChange={set("asset_category")}
            >
              <option value="">— any category —</option>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {AssetCategoryLabels[c] ?? c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.sort_order}
              onChange={set("sort_order")}
              min={0}
            />
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
              {editing ? "Save Changes" : "Add Code"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Code"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{deleteConfirm?.label}</span>? This
          cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </Modal>
    </DashboardShell>
  );
}
