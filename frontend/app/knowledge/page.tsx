"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, EquipmentModel, KnowledgeEntry } from "@/lib/api";
import {
  AssetCategoryLabels, KnowledgeDifficultyLabels,
  SymptomCodeLabels, ResolutionCodeLabels,
} from "@/types/enums";
import {
  BookOpen, Plus, Pencil, Loader2, CheckCircle2,
  ShieldCheck, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ASSET_CATEGORIES = [
  "HVAC", "REFRIGERATION", "COOKING_EQUIPMENT", "ICE_MACHINE",
  "DISHWASHER", "POS_SYSTEM", "LIGHTING", "PLUMBING", "ELECTRICAL",
  "ELEVATOR", "COFFEE_EQUIPMENT", "ESPRESSO_MACHINE", "OTHER",
];

const SYMPTOM_CODES = [
  "NO_POWER", "WONT_START", "OVERHEATING", "TEMPERATURE_INCONSISTENT",
  "UNUSUAL_NOISE", "LEAKING", "NOT_COOLING", "NOT_HEATING", "NOT_DISPENSING",
  "ICE_BUILDUP", "COMPRESSOR_ISSUE", "FILTER_CLOG", "PUMP_FAILURE",
  "DOOR_SEAL_ISSUE", "IGNITER_ISSUE", "PILOT_LIGHT_OUT", "DISPLAY_ISSUE",
  "ERROR_CODE_DISPLAYED", "CONNECTIVITY_ISSUE", "PHYSICAL_DAMAGE",
  "SLOW_PERFORMANCE", "CALIBRATION_NEEDED", "OTHER",
];

const RESOLUTION_CODES = [
  "REPLACED_COMPRESSOR", "REPLACED_THERMOSTAT", "REPLACED_PUMP",
  "REPLACED_HEATING_ELEMENT", "REPLACED_IGNITER", "REPLACED_CONTROL_BOARD",
  "REPLACED_SEAL_GASKET", "REPLACED_FILTER", "REPLACED_PART",
  "REPAIRED_IN_FIELD", "DESCALED_CLEANED", "CLEANED_SERVICED",
  "ADJUSTED_SETTINGS", "CALIBRATED", "REPROGRAMMED", "FIRMWARE_UPDATE",
  "PREVENTIVE_MAINTENANCE", "TRAINED_STAFF", "AWAITING_PARTS",
  "REFERRED_TO_VENDOR", "NO_FAULT_FOUND", "OTHER",
];

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "ADVANCED"];

const difficultyStyle: Record<string, string> = {
  EASY:     "bg-emerald-100 text-emerald-700",
  MEDIUM:   "bg-blue-100 text-blue-700",
  HARD:     "bg-orange-100 text-orange-700",
  ADVANCED: "bg-red-100 text-red-700",
};

type EntryForm = {
  equipment_model: string | null;
  asset_category: string;
  make: string;
  model_number: string;
  symptom_code: string;
  resolution_code: string;
  difficulty: string;
  cause_summary: string;
  procedure: string;
  parts_commonly_used: string;
  pro_tips: string;
};

const emptyForm = (): EntryForm => ({
  equipment_model:     null,
  asset_category:      "REFRIGERATION",
  make:                "",
  model_number:        "",
  symptom_code:        "NOT_COOLING",
  resolution_code:     "REPLACED_COMPRESSOR",
  difficulty:          "MEDIUM",
  cause_summary:       "",
  procedure:           "",
  parts_commonly_used: "",
  pro_tips:            "",
});

export default function KnowledgePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ORS_ADMIN";

  const [entries, setEntries]         = useState<KnowledgeEntry[]>([]);
  const [equipmentModels, setEquipmentModels] = useState<EquipmentModel[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const [filterCategory, setFilterCategory] = useState("");
  const [filterSymptom,  setFilterSymptom]  = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<KnowledgeEntry | null>(null);
  const [form,      setForm]      = useState<EntryForm>(emptyForm());
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");

  // Detail drawer
  const [selected, setSelected] = useState<KnowledgeEntry | null>(null);

  useEffect(() => {
    api.listEquipmentModels().then(setEquipmentModels).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    api.listKnowledgeEntries({
      asset_category:  filterCategory || undefined,
      symptom_code:    filterSymptom  || undefined,
    })
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filterCategory, filterSymptom]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(e: KnowledgeEntry) {
    setEditing(e);
    setForm({
      equipment_model:     e.equipment_model,
      asset_category:      e.asset_category,
      make:                e.make,
      model_number:        e.model_number,
      symptom_code:        e.symptom_code,
      resolution_code:     e.resolution_code,
      difficulty:          e.difficulty,
      cause_summary:       e.cause_summary,
      procedure:           e.procedure,
      parts_commonly_used: e.parts_commonly_used,
      pro_tips:            e.pro_tips,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        const updated = await api.updateKnowledgeEntry(editing.id, form);
        setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e));
        if (selected?.id === updated.id) setSelected(updated);
      } else {
        const created = await api.createKnowledgeEntry(form);
        setEntries((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify(entry: KnowledgeEntry) {
    try {
      const updated = await api.verifyKnowledgeEntry(entry.id);
      setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e));
      if (selected?.id === updated.id) setSelected(updated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to verify.");
    }
  }

  const set = (key: keyof EntryForm) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: ev.target.value }));

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const textareaClass = `${inputClass} resize-y min-h-[80px]`;

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-slate-500 text-sm mt-0.5">Technician expertise for AI-assisted diagnostics</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Equipment Types</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>{AssetCategoryLabels[c] ?? c}</option>
          ))}
        </select>

        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterSymptom}
          onChange={(e) => setFilterSymptom(e.target.value)}
        >
          <option value="">All Symptoms</option>
          {SYMPTOM_CODES.map((c) => (
            <option key={c} value={c}>{SymptomCodeLabels[c] ?? c}</option>
          ))}
        </select>

        {(filterCategory || filterSymptom) && (
          <button
            onClick={() => { setFilterCategory(""); setFilterSymptom(""); }}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Clear filters
          </button>
        )}

        <span className="text-slate-400 text-sm ml-auto">
          {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      <div className="flex gap-6">
        {/* List */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No entries yet</p>
              <p className="text-sm mt-1">Add the first knowledge base entry to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelected(selected?.id === entry.id ? null : entry)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                    selected?.id === entry.id
                      ? "border-blue-400 ring-1 ring-blue-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {AssetCategoryLabels[entry.asset_category] ?? entry.asset_category}
                        </span>
                        {(entry.make || entry.model_number) && (
                          <span className="text-xs text-slate-400">
                            {[entry.make, entry.model_number].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${difficultyStyle[entry.difficulty] ?? "bg-slate-100 text-slate-600"}`}>
                          {KnowledgeDifficultyLabels[entry.difficulty] ?? entry.difficulty}
                        </span>
                        {entry.is_verified && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-800">
                        {SymptomCodeLabels[entry.symptom_code] ?? entry.symptom_code}
                        {" → "}
                        {ResolutionCodeLabels[entry.resolution_code] ?? entry.resolution_code}
                      </p>
                      {entry.equipment_model_display && (
                        <p className="text-xs text-blue-600 font-mono mt-0.5">
                          {entry.equipment_model_display.make} {entry.equipment_model_display.model_number}
                        </p>
                      )}
                      {entry.cause_summary && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{entry.cause_summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-96 shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {AssetCategoryLabels[selected.asset_category] ?? selected.asset_category}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${difficultyStyle[selected.difficulty] ?? ""}`}>
                      {KnowledgeDifficultyLabels[selected.difficulty] ?? selected.difficulty}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {SymptomCodeLabels[selected.symptom_code] ?? selected.symptom_code}
                    {" → "}
                    {ResolutionCodeLabels[selected.resolution_code] ?? selected.resolution_code}
                  </h3>
                  {(selected.make || selected.model_number) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[selected.make, selected.model_number].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                {selected.is_verified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : isAdmin ? (
                  <button
                    onClick={() => handleVerify(selected)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                  </button>
                ) : null}
              </div>

              {selected.cause_summary && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Root Cause</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.cause_summary}</p>
                </section>
              )}

              {selected.procedure && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Procedure</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.procedure}</p>
                </section>
              )}

              {selected.parts_commonly_used && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Parts Commonly Used</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.parts_commonly_used}</p>
                </section>
              )}

              {selected.pro_tips && (
                <section>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Pro Tips</p>
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 whitespace-pre-wrap">{selected.pro_tips}</p>
                </section>
              )}

              <p className="text-xs text-slate-400 pt-1">
                Added by {selected.contributed_by_name ?? "Unknown"} · {new Date(selected.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Knowledge Entry" : "New Knowledge Entry"}
        width="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Link to Equipment Model (recommended)</label>
              <select
                className={inputClass}
                value={form.equipment_model ?? ""}
                onChange={(e) => {
                  const selected = equipmentModels.find((m) => m.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    equipment_model: e.target.value || null,
                    ...(selected ? { asset_category: selected.category, make: selected.make, model_number: selected.model_number } : {}),
                  }));
                }}
              >
                <option value="">— general (not model-specific) —</option>
                {equipmentModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.make} {m.model_number}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Linking makes this entry searchable by model for AI diagnostics.</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Equipment Type <span className="text-red-500">*</span>
              </label>
              <select className={inputClass} value={form.asset_category} onChange={set("asset_category")} required>
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{AssetCategoryLabels[c] ?? c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Make (optional)</label>
              <input type="text" className={inputClass} value={form.make} onChange={set("make")}
                placeholder="e.g. True, Carrier, Hoshizaki" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model Number (optional)</label>
              <input type="text" className={inputClass} value={form.model_number} onChange={set("model_number")}
                placeholder="e.g. T-49-HC" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Symptom <span className="text-red-500">*</span>
              </label>
              <select className={inputClass} value={form.symptom_code} onChange={set("symptom_code")} required>
                {SYMPTOM_CODES.map((c) => (
                  <option key={c} value={c}>{SymptomCodeLabels[c] ?? c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Resolution <span className="text-red-500">*</span>
              </label>
              <select className={inputClass} value={form.resolution_code} onChange={set("resolution_code")} required>
                {RESOLUTION_CODES.map((c) => (
                  <option key={c} value={c}>{ResolutionCodeLabels[c] ?? c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
              <select className={inputClass} value={form.difficulty} onChange={set("difficulty")}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{KnowledgeDifficultyLabels[d] ?? d}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Root Cause</label>
              <textarea
                className={textareaClass}
                value={form.cause_summary}
                onChange={set("cause_summary")}
                placeholder="What typically causes this issue? e.g. Compressor fails due to refrigerant leak starving the motor of cooling..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Procedure</label>
              <textarea
                className={textareaClass}
                rows={5}
                value={form.procedure}
                onChange={set("procedure")}
                placeholder={"Step-by-step instructions:\n1. Recover refrigerant\n2. Check capacitor with multimeter\n3. ..."}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Parts Commonly Used</label>
              <textarea
                className={textareaClass}
                value={form.parts_commonly_used}
                onChange={set("parts_commonly_used")}
                placeholder="e.g. Copeland ZR36K3E-PFV compressor, 45MFD run capacitor, 10-ton service valve..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Pro Tips & Gotchas</label>
              <textarea
                className={textareaClass}
                value={form.pro_tips}
                onChange={set("pro_tips")}
                placeholder="Things to watch out for, shortcuts, common mistakes..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Add to Knowledge Base"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
