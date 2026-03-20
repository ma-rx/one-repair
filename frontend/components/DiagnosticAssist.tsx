"use client";

import { useState } from "react";
import { api, DiagnosticTicketResult, DiagnosticKnowledgeResult } from "@/lib/api";
import { Brain, Loader2, ChevronDown, ChevronUp, CheckCircle2, Wrench } from "lucide-react";

interface Props {
  initialDescription?: string;
  assetCategory?: string;
  make?: string;
  modelNumber?: string;
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
                  <span key={p.sku} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {p.name} <span className="opacity-60">({p.sku})</span>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<DiagnosticTicketResult[]>([]);
  const [knowledge, setKnowledge] = useState<DiagnosticKnowledgeResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!description.trim()) return;
    setLoading(true);
    setError("");
    setSearched(false);
    try {
      const result = await api.diagnosticSearch({
        description,
        ...(assetCategory ? { asset_category: assetCategory } : {}),
        ...(make ? { make } : {}),
        ...(modelNumber ? { model_number: modelNumber } : {}),
      });
      setTickets(result.tickets);
      setKnowledge(result.knowledge);
      setSearched(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  const hasResults = tickets.length > 0 || knowledge.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4 text-violet-600" />
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">AI Diagnostic Assist</p>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Describe the issue in plain language to find similar past repairs and knowledge base entries.
      </p>

      <div className="space-y-3">
        <textarea
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          placeholder="e.g. unit makes clicking noise then shuts off after a few minutes, compressor seems to start but trips…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !description.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {searched && !hasResults && (
        <p className="mt-4 text-sm text-slate-400 text-center py-4">
          No similar repairs found yet. Results will improve as more tickets are imported.
        </p>
      )}

      {knowledge.length > 0 && (
        <div className="mt-5">
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
        <div className="mt-5">
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
  );
}
