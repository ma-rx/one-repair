"use client";

import { useState } from "react";
import {
  api, Diagnosis, DiagnosticTicketResult, DiagnosticKnowledgeResult,
} from "@/lib/api";
import {
  Brain, Loader2, ChevronDown, ChevronUp, CheckCircle2,
  Wrench, AlertTriangle, Package, ListChecks,
} from "lucide-react";

interface Props {
  initialDescription?: string;
  assetCategory?: string;
  make?: string;
  modelNumber?: string;
}

const confidenceStyles: Record<string, string> = {
  high:   "bg-emerald-100 text-emerald-700",
  medium: "bg-blue-100 text-blue-700",
  low:    "bg-amber-100 text-amber-700",
};

const difficultyStyles: Record<string, string> = {
  easy:     "bg-slate-100 text-slate-600",
  medium:   "bg-yellow-100 text-yellow-700",
  hard:     "bg-orange-100 text-orange-700",
  advanced: "bg-red-100 text-red-700",
};

function DiagnosisCard({ d }: { d: Diagnosis }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-violet-900">AI Diagnosis</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceStyles[d.confidence] ?? "bg-slate-100 text-slate-600"}`}>
            {d.confidence} confidence
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyStyles[d.difficulty?.toLowerCase()] ?? "bg-slate-100 text-slate-600"}`}>
            {d.difficulty}
          </span>
        </div>
      </div>

      {/* Likely cause */}
      <div>
        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Likely Cause</p>
        <p className="text-sm text-slate-800">{d.likely_cause}</p>
      </div>

      {/* Safety caution */}
      {d.caution && (
        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{d.caution}</p>
        </div>
      )}

      {/* Steps */}
      {d.recommended_steps.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ListChecks className="w-3.5 h-3.5 text-violet-600" />
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Recommended Steps</p>
          </div>
          <ol className="space-y-1.5">
            {d.recommended_steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Parts to order */}
      {d.parts_to_order.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-3.5 h-3.5 text-violet-600" />
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Parts to Order</p>
          </div>
          <div className="space-y-1.5">
            {d.parts_to_order.map((p, i) => (
              <div key={i} className="flex items-start justify-between gap-3 bg-white rounded-lg px-3 py-2 border border-violet-100">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.reason}</p>
                </div>
                {p.sku && (
                  <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded shrink-0">
                    {p.sku}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-emerald-100 text-emerald-700" :
    pct >= 60 ? "bg-blue-100 text-blue-700" :
                "bg-slate-100 text-slate-500";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {pct}% match
    </span>
  );
}

function TicketCard({ t }: { t: DiagnosticTicketResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{t.asset_description || "Unknown equipment"}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.description || t.tech_notes || "—"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SimilarityBadge score={t.similarity} />
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {t.resolution_code && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Resolution</p>
              <p className="text-sm text-slate-700">{t.resolution_code}</p>
            </div>
          )}
          {t.tech_notes && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tech Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{t.tech_notes}</p>
            </div>
          )}
          {t.parts_used.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Parts Used</p>
              <div className="flex flex-wrap gap-1.5">
                {t.parts_used.map((p) => (
                  <span key={p.sku || p.name} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {p.name}{p.sku && <span className="opacity-60"> ({p.sku})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KnowledgeCard({ k }: { k: DiagnosticKnowledgeResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800">
              {[k.make, k.model_number].filter(Boolean).join(" ") || k.asset_category}
            </p>
            {k.is_verified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Verified" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{k.cause_summary || "—"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SimilarityBadge score={k.similarity} />
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {k.cause_summary && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Cause</p>
              <p className="text-sm text-slate-700">{k.cause_summary}</p>
            </div>
          )}
          {k.procedure && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Procedure</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{k.procedure}</p>
            </div>
          )}
          {k.parts_commonly_used && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Common Parts</p>
              <p className="text-sm text-slate-700">{k.parts_commonly_used}</p>
            </div>
          )}
          {k.pro_tips && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Pro Tips</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{k.pro_tips}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DiagnosticAssist({ initialDescription, assetCategory, make, modelNumber }: Props) {
  const [description, setDescription] = useState(initialDescription ?? "");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [diagnosis, setDiagnosis]     = useState<Diagnosis | null>(null);
  const [tickets, setTickets]         = useState<DiagnosticTicketResult[]>([]);
  const [knowledge, setKnowledge]     = useState<DiagnosticKnowledgeResult[]>([]);
  const [searched, setSearched]       = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  async function handleSearch() {
    if (!description.trim()) return;
    setLoading(true);
    setError("");
    setSearched(false);
    setShowEvidence(false);
    try {
      const result = await api.diagnosticSearch({
        description,
        ...(assetCategory ? { asset_category: assetCategory } : {}),
        ...(make         ? { make }                            : {}),
        ...(modelNumber  ? { model_number: modelNumber }       : {}),
      });
      setDiagnosis(result.diagnosis);
      setTickets(result.tickets);
      setKnowledge(result.knowledge);
      setSearched(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  const hasEvidence = tickets.length > 0 || knowledge.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4 text-violet-600" />
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">AI Diagnostic Assist</p>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Describe the issue in plain language. Claude will analyse past repairs and the knowledge base to suggest a diagnosis and next steps.
      </p>

      <div className="space-y-3">
        <textarea
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          placeholder="e.g. unit makes clicking noise then shuts off, compressor tries to start but trips after a few seconds…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !description.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
            : <><Brain className="w-4 h-4" /> Diagnose</>
          }
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {searched && !diagnosis && !hasEvidence && (
        <p className="mt-4 text-sm text-slate-400 text-center py-4">
          No similar repairs found yet. Results improve as more tickets are imported and the knowledge base grows.
        </p>
      )}

      {/* AI-generated diagnosis — primary output */}
      {diagnosis && (
        <div className="mt-4">
          <DiagnosisCard d={diagnosis} />
        </div>
      )}

      {/* Supporting evidence — collapsible */}
      {hasEvidence && (
        <div className="mt-4">
          <button
            onClick={() => setShowEvidence((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            {showEvidence
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
            {showEvidence ? "Hide" : "Show"} supporting evidence
            ({tickets.length} past repair{tickets.length !== 1 ? "s" : ""}
            {knowledge.length > 0 ? `, ${knowledge.length} knowledge entr${knowledge.length !== 1 ? "ies" : "y"}` : ""})
          </button>

          {showEvidence && (
            <div className="mt-3 space-y-4">
              {knowledge.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Knowledge Base</p>
                  </div>
                  <div className="space-y-2">
                    {knowledge.map((k) => <KnowledgeCard key={k.id} k={k} />)}
                  </div>
                </div>
              )}

              {tickets.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-3.5 h-3.5 text-blue-600" />
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Similar Past Repairs</p>
                  </div>
                  <div className="space-y-2">
                    {tickets.map((t) => <TicketCard key={t.id} t={t} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
