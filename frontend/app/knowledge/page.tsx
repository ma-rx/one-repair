"use client";

import { useEffect, useRef, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, DiagnosticStep, EquipmentModel, KnowledgeEntry, Part, RepairDocument, RepairImage, VerifiedAnswer } from "@/lib/api";
import { AssetCategoryLabels, KnowledgeDifficultyLabels, SymptomCodeLabels } from "@/types/enums";
import {
  BookOpen, Plus, Pencil, Loader2, CheckCircle2,
  ShieldCheck, AlertCircle, ChevronDown, X, ArrowUp, ArrowDown, GripVertical,
  FileText, Upload, Trash2, BadgeCheck, Send, MessageSquare, ImageIcon,
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
  const [docs, setDocs]           = useState<RepairDocument[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [pendingMake, setPendingMake] = useState("");
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
          new Promise<{ title: string; make: string; content: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              title:   file.name.replace(/\.(txt|md)$/i, ""),
              make:    pendingMake,
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

  // Group by manufacturer
  const grouped = docs.reduce<Record<string, RepairDocument[]>>((acc, d) => {
    const key = d.make?.trim() || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});
  const manufacturers = Object.keys(grouped).sort((a, b) =>
    a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <p className="text-sm text-slate-500">
          Upload Plaud summary transcripts (.txt or .md). The AI diagnostic tool will reference these when techs ask questions in the field.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            placeholder="Manufacturer (optional)"
            value={pendingMake}
            onChange={(e) => setPendingMake(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          />
          <input ref={fileInputRef} type="file" accept=".txt,.md" multiple className="hidden" onChange={handleFiles} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Upload .txt / .md</>}
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
          <p className="text-sm mt-1">Upload Plaud summary .txt or .md files to give the AI field knowledge.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {manufacturers.map((mfr) => (
            <div key={mfr}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 px-1">{mfr}</h3>
              <div className="space-y-2">
                {grouped[mfr].map((doc) => (
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
                        {doc.uploaded_by_name ? ` · ${doc.uploaded_by_name}` : ""}
                        {" · "}{new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                      className="text-slate-400 hover:text-red-600 transition-colors shrink-0 p-1"
                    >
                      {deleting === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ORS Verified Answers tab ──────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

function VerifiedAnswersTab() {
  const [answers, setAnswers]         = useState<VerifiedAnswer[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [selected, setSelected]       = useState<VerifiedAnswer | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing]         = useState<VerifiedAnswer | null>(null);

  // Builder state
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState("");
  const [sending, setSending]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveForm, setSaveForm]       = useState<{ question: string; answer: string; make: string; asset_category: string } | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.listVerifiedAnswers()
      .then(setAnswers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    const updated: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setSending(true);
    try {
      const { reply } = await api.diagnosticChat(updated, { asset_name: "", asset_category: "", make: "", model_number: "", store_name: "" });
      setMessages([...updated, { role: "assistant", content: reply }]);
    } catch (e: unknown) {
      setMessages([...updated, { role: "assistant", content: "Error — please try again." }]);
    } finally {
      setSending(false);
    }
  }

  function openSaveForm() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastAI   = [...messages].reverse().find((m) => m.role === "assistant");
    setSaveForm({
      question:       lastUser?.content ?? "",
      answer:         lastAI?.content  ?? "",
      make:           "",
      asset_category: "",
    });
  }

  async function handleSave() {
    if (!saveForm || !saveForm.question.trim() || !saveForm.answer.trim()) return;
    setSaving(true);
    try {
      const created = await api.createVerifiedAnswer(saveForm);
      setAnswers((prev) => [created, ...prev]);
      setBuilderOpen(false);
      setMessages([]);
      setSaveForm(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(ans: VerifiedAnswer) {
    setEditing(ans);
    setSaveForm({ question: ans.question, answer: ans.answer, make: ans.make, asset_category: ans.asset_category });
    setBuilderOpen(false);
  }

  async function handleEditSave() {
    if (!saveForm || !editing) return;
    setSaving(true);
    try {
      const updated = await api.updateVerifiedAnswer(editing.id, saveForm);
      setAnswers((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      if (selected?.id === updated.id) setSelected(updated);
      setEditing(null);
      setSaveForm(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this verified answer? The AI will no longer return it.")) return;
    setDeleting(id);
    try {
      await api.deleteVerifiedAnswer(id);
      setAnswers((prev) => prev.filter((a) => a.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch {
      setError("Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  // Group by manufacturer
  const grouped = answers.reduce<Record<string, VerifiedAnswer[]>>((acc, a) => {
    const key = a.make.trim() || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
  const manufacturers = Object.keys(grouped).sort((a, b) =>
    a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b)
  );

  return (
    <div className="flex gap-6 min-h-0">
      {/* List */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-slate-500">
            Curated answers built through AI conversation — returned verbatim when a tech asks a matching question.
          </p>
          <button
            onClick={() => { setBuilderOpen(true); setMessages([]); setSaveForm(null); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> New Verified Answer
          </button>
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
        ) : answers.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <BadgeCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No verified answers yet</p>
            <p className="text-sm mt-1">Use the builder to create your first verified Q&A.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {manufacturers.map((mfr) => (
              <div key={mfr}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 px-1">{mfr}</h3>
                <div className="space-y-2">
                  {grouped[mfr].map((ans) => (
                    <div
                      key={ans.id}
                      onClick={() => setSelected(selected?.id === ans.id ? null : ans)}
                      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                        selected?.id === ans.id ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />
                            <p className="text-sm font-medium text-slate-800">{ans.question}</p>
                            {ans.is_embedded ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                                <CheckCircle2 className="w-3 h-3" /> AI Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                                <AlertCircle className="w-3 h-3" /> Not embedded
                              </span>
                            )}
                          </div>
                          {selected?.id !== ans.id && (
                            <p className="text-xs text-slate-400 line-clamp-2 ml-6">{ans.answer}</p>
                          )}
                          {selected?.id === ans.id && (
                            <div className="ml-6 mt-2 space-y-2">
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{ans.answer}</p>
                              {ans.aliases?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Also matches</p>
                                  <div className="flex flex-wrap gap-1">
                                    {ans.aliases.map((a, i) => (
                                      <span key={i} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{a}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {ans.asset_category && (
                            <span className="ml-6 mt-2 inline-block text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                              {AssetCategoryLabels[ans.asset_category] ?? ans.asset_category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(ans); }}
                            className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(ans.id); }}
                            disabled={deleting === ans.id}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          >
                            {deleting === ans.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit panel */}
      {editing && saveForm && (
        <div className="w-[420px] shrink-0 border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Edit Verified Answer</span>
            <button onClick={() => { setEditing(null); setSaveForm(null); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Question</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={saveForm.question}
                onChange={(e) => setSaveForm((f) => f ? { ...f, question: e.target.value } : f)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Answer</label>
              <textarea
                rows={6}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={saveForm.answer}
                onChange={(e) => setSaveForm((f) => f ? { ...f, answer: e.target.value } : f)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Manufacturer</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. TurboChef"
                  value={saveForm.make}
                  onChange={(e) => setSaveForm((f) => f ? { ...f, make: e.target.value } : f)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={saveForm.asset_category}
                  onChange={(e) => setSaveForm((f) => f ? { ...f, asset_category: e.target.value } : f)}
                >
                  <option value="">— any —</option>
                  {Object.keys(AssetCategoryLabels).map((c) => (
                    <option key={c} value={c}>{AssetCategoryLabels[c]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setEditing(null); setSaveForm(null); }} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving || !saveForm.question.trim() || !saveForm.answer.trim()}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Q&A Builder panel */}
      {builderOpen && (
        <div className="w-[420px] shrink-0 flex flex-col border border-slate-200 rounded-xl bg-white overflow-hidden" style={{ height: "70vh" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-800">Q&A Builder</span>
            </div>
            <button onClick={() => { setBuilderOpen(false); setSaveForm(null); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-400 text-center mt-8">
                Ask any technical question. Iterate until the answer is exactly right, then save it as a verified answer.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  {[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Save form */}
          {saveForm ? (
            <div className="border-t border-slate-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Save as Verified Answer</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Canonical Question</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={saveForm.question}
                  onChange={(e) => setSaveForm((f) => f ? { ...f, question: e.target.value } : f)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Answer</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={saveForm.answer}
                  onChange={(e) => setSaveForm((f) => f ? { ...f, answer: e.target.value } : f)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Manufacturer</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. TurboChef"
                    value={saveForm.make}
                    onChange={(e) => setSaveForm((f) => f ? { ...f, make: e.target.value } : f)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={saveForm.asset_category}
                    onChange={(e) => setSaveForm((f) => f ? { ...f, asset_category: e.target.value } : f)}
                  >
                    <option value="">— any —</option>
                    {Object.keys(AssetCategoryLabels).map((c) => (
                      <option key={c} value={c}>{AssetCategoryLabels[c]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSaveForm(null)} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50">
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !saveForm.question.trim() || !saveForm.answer.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Verified Answer
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-100 p-3 space-y-2">
              {messages.some((m) => m.role === "assistant") && (
                <button
                  onClick={openSaveForm}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  <BadgeCheck className="w-4 h-4" /> Save as Verified Answer
                </button>
              )}
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Ask a technical question…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg px-3 flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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

// ── Component Images tab ──────────────────────────────────────────────────────

function ComponentImagesTab() {
  const [images, setImages]       = useState<RepairImage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [lightbox, setLightbox]   = useState<RepairImage | null>(null);
  const [editing, setEditing]     = useState<RepairImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [title, setTitle]               = useState("");
  const [make, setMake]                 = useState("");
  const [assetCategory, setAssetCategory] = useState("");
  const [tagsInput, setTagsInput]       = useState("");

  useEffect(() => {
    api.listRepairImages()
      .then(setImages)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !title.trim()) {
      setError("Please enter a title before selecting an image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("title", title.trim());
      formData.append("make", make.trim());
      formData.append("asset_category", assetCategory.trim());
      formData.append("tags", tagsInput);
      const created = await api.uploadRepairImage(formData);
      setImages((prev) => [...prev, created]);
      setTitle(""); setMake(""); setAssetCategory(""); setTagsInput("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this image?")) return;
    setDeleting(id);
    try {
      await api.deleteRepairImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    try {
      const updated = await api.updateRepairImage(editing.id, {
        title: editing.title,
        make: editing.make,
        asset_category: editing.asset_category,
        tags: editing.tags,
      });
      setImages((prev) => prev.map((img) => img.id === updated.id ? updated : img));
      setEditing(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  }

  const grouped = images.reduce<Record<string, RepairImage[]>>((acc, img) => {
    const key = img.make?.trim() || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(img);
    return acc;
  }, {});
  const manufacturers = Object.keys(grouped).sort((a, b) =>
    a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b)
  );

  return (
    <div>
      {/* Upload form */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-slate-700 mb-3">Add Component Image</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            placeholder="Title (e.g. TurboChef Triac Relay Board) *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Tags — comma separated (relay, board, power)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Manufacturer (e.g. TurboChef)"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Equipment category (e.g. Conveyor Oven)"
            value={assetCategory}
            onChange={(e) => setAssetCategory(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <button
            onClick={() => {
              if (!title.trim()) { setError("Enter a title first."); return; }
              setError("");
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Upload Image</>}
          </button>
          <p className="text-xs text-slate-400">JPG, PNG, WEBP. The AI will suggest tapping component names to view these images.</p>
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
      ) : images.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No component images yet</p>
          <p className="text-sm mt-1">Upload images of boards, relays, sensors, and connectors so techs can identify them in the field.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {manufacturers.map((mfr) => (
            <div key={mfr}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 px-1">{mfr}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {grouped[mfr].map((img) => (
                  <div key={img.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden group relative">
                    <button
                      className="w-full block"
                      onClick={() => setLightbox(img)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.title}
                        className="w-full h-36 object-cover bg-slate-100"
                      />
                    </button>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-slate-800 truncate">{img.title}</p>
                      {img.tags.length > 0 && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{img.tags.join(", ")}</p>
                      )}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing({ ...img })}
                        className="bg-white rounded-lg shadow p-1 text-slate-500 hover:text-blue-600"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(img.id)}
                        disabled={deleting === img.id}
                        className="bg-white rounded-lg shadow p-1 text-slate-500 hover:text-red-600"
                      >
                        {deleting === img.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.title} className="w-full max-h-96 object-contain bg-slate-100" />
            <div className="p-4">
              <p className="font-semibold text-slate-800">{lightbox.title}</p>
              {lightbox.make && <p className="text-sm text-slate-500 mt-0.5">{lightbox.make}{lightbox.asset_category ? ` · ${lightbox.asset_category}` : ""}</p>}
              {lightbox.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {lightbox.tags.map((t) => (
                    <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}
              <button onClick={() => setLightbox(null)} className="mt-4 text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-3">
            <p className="font-semibold text-slate-800 mb-1">Edit Image</p>
            <input
              type="text"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Title"
              className={inputClass}
            />
            <input
              type="text"
              value={editing.make}
              onChange={(e) => setEditing({ ...editing, make: e.target.value })}
              placeholder="Manufacturer"
              className={inputClass}
            />
            <input
              type="text"
              value={editing.asset_category}
              onChange={(e) => setEditing({ ...editing, asset_category: e.target.value })}
              placeholder="Equipment category"
              className={inputClass}
            />
            <input
              type="text"
              value={editing.tags.join(", ")}
              onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              placeholder="Tags (comma separated)"
              className={inputClass}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
              <button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Tab = "entries" | "documents" | "verified" | "images";

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
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
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
        <button
          onClick={() => setTab("verified")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "verified"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4" /> ORS Verified Answers
          </span>
        </button>
        <button
          onClick={() => setTab("images")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "images"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Component Images
          </span>
        </button>
      </div>

      {tab === "images" ? (
        <ComponentImagesTab />
      ) : tab === "verified" ? (
        <VerifiedAnswersTab />
      ) : tab === "documents" ? (
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
