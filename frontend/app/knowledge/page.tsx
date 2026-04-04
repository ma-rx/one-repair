"use client";

import { useEffect, useRef, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, DiagnosticStep, EquipmentModel, KnowledgeEntry, Part, RepairDocument } from "@/lib/api";
import { AssetCategoryLabels, KnowledgeDifficultyLabels, SymptomCodeLabels } from "@/types/enums";
import {
  BookOpen, Plus, Pencil, Loader2, CheckCircle2,
  ShieldCheck, AlertCircle, ChevronDown, X, ArrowUp, ArrowDown, GripVertical,
  FileText, Upload, Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ASSET_CATEGORIES = Object.keys(AssetCategoryLabels);
const SYMPTOM_CODES = [
  "NO_POWER", "WONT_START", "OVERHEATING", "TEMPERATURE_INCONSISTENT",
  "UNUSUAL_NOISE", "LEAKING", "NOT_COOLING", "NOT_HEATING", "NOT_DISPENSING",
  "ICE_BUILDUP", "COMPRESSOR_ISSUE", "FILTER_CLOG", "PUMP_FAILURE",
  "DOOR_SEAL_ISSUE", "IGNITER_ISSUE", "PILOT_LIGHT_OUT", "DISPLAY_ISSUE",
  "ERROR_CODE_DISPLAYED", "CONNECTIVITY_ISSUE", "PHYSICAL_DAMAGE",
  "SLOW_PERFORMANCE", "CALIBRATION_NEEDED", "OTHER",
];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "ADVANCED"];

const difficultyStyle: Record<string, string> = {
  EASY:     "bg-emerald-100 text-emerald-700",
  MEDIUM:   "bg-blue-100 text-blue-700",
  HARD:     "bg-orange-100 text-orange-700",
  ADVANCED: "bg-red-100 text-red-700",
};

const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const textareaClass = `${inputClass} resize-y`;

// ── Parts multi-select ────────────────────────────────────────────────────────

function PartsMultiSelect({ parts, selected, onChange }: {
  parts: Part[];
  selected: Part[];
  onChange: (parts: Part[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedIds = new Set(selected.map((p) => p.id));
  const filtered = parts.filter(
    (p) => !selectedIds.has(p.id) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
              {p.name}
              <button type="button" onClick={() => onChange(selected.filter((x) => x.id !== p.id))}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div
          className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus-within:ring-2 focus-within:ring-blue-500 cursor-text"
          onClick={() => setOpen(true)}
        >
          <input
            className="flex-1 outline-none bg-transparent text-slate-800 placeholder-slate-400"
            placeholder={selected.length === 0 ? "Search parts by name or SKU…" : "Add another part…"}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">{search ? "No matching parts" : "No more parts to add"}</p>
            ) : (
              filtered.map((p) => (
                <button key={p.id} type="button"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  onClick={() => { onChange([...selected, p]); setSearch(""); setOpen(false); }}
                >
                  <p className="font-medium text-slate-800">{p.name}</p>
                  {p.sku && <p className="text-xs text-slate-400 mt-0.5">SKU: {p.sku}</p>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step builder ──────────────────────────────────────────────────────────────

function emptyStep(): DiagnosticStep {
  return { action: "", finding: "", next_action: "" };
}

function StepBuilder({ steps, onChange }: {
  steps: DiagnosticStep[];
  onChange: (steps: DiagnosticStep[]) => void;
}) {
  function update(i: number, key: keyof DiagnosticStep, value: string) {
    const next = steps.map((s, idx) => idx === i ? { ...s, [key]: value } : s);
    onChange(next);
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...steps];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function remove(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Step {i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-20">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => remove(i)}
                className="p-1 text-red-400 hover:text-red-600 ml-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Check / Action <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Check if evaporator fan is spinning"
              value={step.action}
              onChange={(e) => update(i, "action", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Finding / Observation</label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Fan not spinning"
                value={step.finding}
                onChange={(e) => update(i, "finding", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Next Action / Recommendation</label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Test motor windings, replace if open"
                value={step.next_action}
                onChange={(e) => update(i, "next_action", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...steps, emptyStep()])}
        className="flex items-center gap-2 w-full border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl py-3 text-sm font-medium transition-colors justify-center"
      >
        <Plus className="w-4 h-4" /> Add Diagnostic Step
      </button>
    </div>
  );
}

// ── Support Documents tab ─────────────────────────────────────────────────────

function DocumentsTab() {
  const [docs, setDocs]         = useState<RepairDocument[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listRepairDocuments()
      .then(setDocs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setError("");

    try {
      const documents = await Promise.all(
        files.map((file) =>
          new Promise<{ title: string; content: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              title: file.name.replace(/\.(txt|md)$/i, ""),
              content: reader.result as string,
            });
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsText(file);
          })
        )
      );

      await api.bulkUploadDocuments(documents);
      const updated = await api.listRepairDocuments();
      setDocs(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document? The AI will no longer be able to reference it.")) return;
    setDeleting(id);
    try {
      await api.deleteRepairDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">
          Upload Plaud summary transcripts (.txt or .md). The AI diagnostic tool will reference these when techs ask questions in the field.
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload .txt / .md Files</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents uploaded yet</p>
          <p className="text-sm mt-1">Upload Plaud summary .txt files to give the AI field knowledge.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-4">
              <FileText className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                  {doc.is_embedded ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> AI Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                      <AlertCircle className="w-3 h-3" /> Not embedded
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {doc.content.length.toLocaleString()} characters
                  {doc.uploaded_by_name ? ` · Uploaded by ${doc.uploaded_by_name}` : ""}
                  {" · "}{new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deleting === doc.id}
                className="text-slate-400 hover:text-red-600 transition-colors shrink-0 p-1"
              >
                {deleting === doc.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type EntryForm = {
  equipment_model: string | null;
  asset_category: string;
  make: string;
  model_number: string;
  symptom_code: string;
  symptom_description: string;
  diagnostic_steps: DiagnosticStep[];
  difficulty: string;
  cause_summary: string;
  parts_commonly_used: string;
  pro_tips: string;
};

const emptyForm = (): EntryForm => ({
  equipment_model:     null,
  asset_category:      "REFRIGERATION",
  make:                "",
  model_number:        "",
  symptom_code:        "",
  symptom_description: "",
  diagnostic_steps:    [],
  difficulty:          "MEDIUM",
  cause_summary:       "",
  parts_commonly_used: "",
  pro_tips:            "",
});

type Tab = "entries" | "documents";

export default function KnowledgePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ORS_ADMIN";

  const [tab, setTab] = useState<Tab>("entries");

  const [entries, setEntries]             = useState<KnowledgeEntry[]>([]);
  const [equipmentModels, setEquipmentModels] = useState<EquipmentModel[]>([]);
  const [allParts, setAllParts]           = useState<Part[]>([]);
  const [selectedParts, setSelectedParts] = useState<Part[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");

  const [filterCategory, setFilterCategory] = useState("");
  const [filterSymptom,  setFilterSymptom]  = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<KnowledgeEntry | null>(null);
  const [form,      setForm]      = useState<EntryForm>(emptyForm());
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");

  const [selected, setSelected] = useState<KnowledgeEntry | null>(null);

  useEffect(() => {
    api.listEquipmentModels().then(setEquipmentModels).catch(() => {});
    api.listParts().then(setAllParts).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    api.listKnowledgeEntries({
      asset_category: filterCategory || undefined,
      symptom_code:   filterSymptom  || undefined,
    })
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filterCategory, filterSymptom]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setSelectedParts([]);
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
      symptom_description: e.symptom_description,
      diagnostic_steps:    e.diagnostic_steps ?? [],
      difficulty:          e.difficulty,
      cause_summary:       e.cause_summary,
      parts_commonly_used: e.parts_commonly_used,
      pro_tips:            e.pro_tips,
    });
    const storedNames = e.parts_commonly_used.split(",").map((n) => n.trim().toLowerCase()).filter(Boolean);
    setSelectedParts(allParts.filter((p) => storedNames.includes(p.name.toLowerCase())));
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.symptom_description.trim() && form.diagnostic_steps.length === 0) {
      setFormError("Add a symptom description or at least one diagnostic step.");
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = { ...form, parts_commonly_used: selectedParts.map((p) => p.name).join(", ") };
    try {
      if (editing) {
        const updated = await api.updateKnowledgeEntry(editing.id, payload);
        setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e));
        if (selected?.id === updated.id) setSelected(updated);
      } else {
        const created = await api.createKnowledgeEntry(payload);
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

  return (
    <DashboardShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-slate-500 text-sm mt-0.5">Diagnostic pathways and support documents for AI-assisted field repairs</p>
        </div>
        {tab === "entries" && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setTab("entries")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "entries"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Diagnostic Entries
          </span>
        </button>
        <button
          onClick={() => setTab("documents")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "documents"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Support Documents
          </span>
        </button>
      </div>

      {tab === "documents" ? (
        <DocumentsTab />
      ) : (
        <>
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
              <option value="">All Symptom Categories</option>
              {SYMPTOM_CODES.map((c) => (
                <option key={c} value={c}>{SymptomCodeLabels[c] ?? c}</option>
              ))}
            </select>

            {(filterCategory || filterSymptom) && (
              <button onClick={() => { setFilterCategory(""); setFilterSymptom(""); }}
                className="text-sm text-slate-400 hover:text-slate-600">
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
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
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

                          {entry.symptom_description ? (
                            <p className="text-sm font-medium text-slate-800 line-clamp-2">{entry.symptom_description}</p>
                          ) : entry.symptom_code ? (
                            <p className="text-sm font-medium text-slate-800">{SymptomCodeLabels[entry.symptom_code] ?? entry.symptom_code}</p>
                          ) : null}

                          <div className="flex items-center gap-3 mt-1.5">
                            {entry.diagnostic_steps?.length > 0 && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <GripVertical className="w-3 h-3" />
                                {entry.diagnostic_steps.length} diagnostic step{entry.diagnostic_steps.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {entry.cause_summary && (
                              <p className="text-xs text-slate-400 line-clamp-1">{entry.cause_summary}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                          className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="w-96 shrink-0">
                <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-4 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {AssetCategoryLabels[selected.asset_category] ?? selected.asset_category}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${difficultyStyle[selected.difficulty] ?? ""}`}>
                          {KnowledgeDifficultyLabels[selected.difficulty] ?? selected.difficulty}
                        </span>
                      </div>
                      {selected.symptom_description && (
                        <p className="font-semibold text-slate-800 text-sm">{selected.symptom_description}</p>
                      )}
                      {(selected.make || selected.model_number) && (
                        <p className="text-xs text-slate-400 mt-0.5">{[selected.make, selected.model_number].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                    {selected.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : isAdmin ? (
                      <button
                        onClick={() => handleVerify(selected)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                      </button>
                    ) : null}
                  </div>

                  {selected.cause_summary && (
                    <section>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Root Cause</p>
                      <p className="text-sm text-slate-700">{selected.cause_summary}</p>
                    </section>
                  )}

                  {selected.diagnostic_steps?.length > 0 && (
                    <section>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Diagnostic Steps</p>
                      <div className="space-y-3">
                        {selected.diagnostic_steps.map((step, i) => (
                          <div key={i} className="border-l-2 border-blue-200 pl-3">
                            <p className="text-xs font-semibold text-slate-500 mb-0.5">Step {i + 1}</p>
                            <p className="text-sm text-slate-800 font-medium">{step.action}</p>
                            {step.finding && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                <span className="font-medium text-amber-600">If:</span> {step.finding}
                              </p>
                            )}
                            {step.next_action && (
                              <p className="text-xs text-slate-600 mt-0.5">
                                <span className="font-medium text-blue-600">Then:</span> {step.next_action}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {selected.parts_commonly_used && (
                    <section>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Parts Commonly Used</p>
                      <p className="text-sm text-slate-700">{selected.parts_commonly_used}</p>
                    </section>
                  )}

                  {selected.pro_tips && (
                    <section>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Pro Tips</p>
                      <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 whitespace-pre-wrap">{selected.pro_tips}</p>
                    </section>
                  )}

                  <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                    Added by {selected.contributed_by_name ?? "Unknown"} · {new Date(selected.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Knowledge Entry" : "New Knowledge Entry"}
        width="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          {/* Equipment */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Equipment</p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Link to Equipment Model (recommended)</label>
              <select
                className={inputClass}
                value={form.equipment_model ?? ""}
                onChange={(e) => {
                  const m = equipmentModels.find((x) => x.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    equipment_model: e.target.value || null,
                    ...(m ? { asset_category: m.category, make: m.make, model_number: m.model_number } : {}),
                  }));
                }}
              >
                <option value="">— general (not model-specific) —</option>
                {equipmentModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.make} {m.model_number}{m.model_name ? ` — ${m.model_name}` : ""}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Equipment Type <span className="text-red-500">*</span></label>
                <select className={inputClass} value={form.asset_category} onChange={set("asset_category")} required>
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{AssetCategoryLabels[c] ?? c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Make</label>
                <input type="text" className={inputClass} value={form.make} onChange={set("make")} placeholder="e.g. True" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Model #</label>
                <input type="text" className={inputClass} value={form.model_number} onChange={set("model_number")} placeholder="e.g. T-49-HC" />
              </div>
            </div>
          </div>

          {/* Symptom */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Symptom</p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                What is the unit doing? <span className="text-red-500">*</span>
              </label>
              <textarea
                className={textareaClass}
                rows={2}
                required
                placeholder="e.g. Unit is running but not producing cold air. Compressor is audible, evaporator fan spinning, but temperature stays at ambient."
                value={form.symptom_description}
                onChange={set("symptom_description")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Symptom Category (for filtering)</label>
                <select className={inputClass} value={form.symptom_code} onChange={set("symptom_code")}>
                  <option value="">— none —</option>
                  {SYMPTOM_CODES.map((c) => (
                    <option key={c} value={c}>{SymptomCodeLabels[c] ?? c}</option>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Most Likely Root Cause</label>
              <textarea
                className={textareaClass}
                rows={2}
                placeholder="e.g. Low refrigerant charge from a slow leak at the evaporator coil connections."
                value={form.cause_summary}
                onChange={set("cause_summary")}
              />
            </div>
          </div>

          {/* Diagnostic steps */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Diagnostic Steps</p>
            <p className="text-xs text-slate-500">
              Add steps in order. Each step has a check to perform, what you might find, and what to do next.
            </p>
            <StepBuilder
              steps={form.diagnostic_steps}
              onChange={(steps) => setForm((f) => ({ ...f, diagnostic_steps: steps }))}
            />
          </div>

          {/* Parts & tips */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Parts & Tips</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parts Commonly Used</label>
              <PartsMultiSelect parts={allParts} selected={selectedParts} onChange={setSelectedParts} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pro Tips & Gotchas</label>
              <textarea
                className={textareaClass}
                rows={2}
                placeholder="Shortcuts, common mistakes, things experienced techs know…"
                value={form.pro_tips}
                onChange={set("pro_tips")}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
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
