"use client";

import { useRef, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api } from "@/lib/api";
import {
  Upload, Download, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, ChevronLeft, Check,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawRow {
  date: string;
  store_name: string;
  make: string;
  model_number: string;
  asset_category: string;
  symptom_description: string;
  resolution_description: string;
  parts_used: string;
  labor_cost: string;
  tech_notes: string;
  technician: string;
}

interface SuggestedCode {
  code: string;
  label: string;
  make: string;
  asset_category: string;
  is_new: boolean;
  type: "symptom" | "resolution";
  approved: boolean;
}

interface MappedRow extends RawRow {
  symptom_code: string;
  symptom_label: string;
  symptom_is_new: boolean;
  resolution_code: string;
  resolution_label: string;
  resolution_is_new: boolean;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string> = {
  // date
  date: "date", "job date": "date", "service date": "date", "completed date": "date", "close date": "date",
  // store
  store: "store_name", "store name": "store_name", location: "store_name",
  // make
  make: "make", manufacturer: "make", brand: "make",
  // model
  model: "model_number", "model number": "model_number", "model #": "model_number", "model no": "model_number",
  // category
  category: "asset_category", "equipment type": "asset_category", type: "asset_category",
  // symptom
  symptom: "symptom_description", "symptom description": "symptom_description", "problem": "symptom_description", "issue": "symptom_description", complaint: "symptom_description",
  // resolution
  resolution: "resolution_description", "resolution description": "resolution_description", "fix": "resolution_description", "repair": "resolution_description", "work done": "resolution_description", "work performed": "resolution_description",
  // parts
  parts: "parts_used", "parts used": "parts_used", "materials": "parts_used",
  // labor
  labor: "labor_cost", "labor cost": "labor_cost", "labour": "labor_cost", "amount": "labor_cost", total: "labor_cost",
  // tech notes
  notes: "tech_notes", "tech notes": "tech_notes", "technician notes": "tech_notes", description: "tech_notes",
  // technician
  technician: "technician", tech: "technician", "assigned to": "technician", "assigned tech": "technician",
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  function splitLine(line: string): string[] {
    const cols: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  }
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach((h, i) => {
    const key = COLUMN_ALIASES[h.toLowerCase().trim()];
    if (key) mapping[key] = String(i);
  });
  return mapping;
}

function downloadTemplate() {
  const rows = [
    ["date", "store_name", "make", "model_number", "asset_category", "symptom_description", "resolution_description", "parts_used", "labor_cost", "tech_notes", "technician"],
    ["2024-03-15", "Downtown Chicago", "Hoshizaki", "KM-1301SAJ", "ICE_MACHINE", "Unit not making ice, compressor running hot", "Replaced expansion valve and recharged R-404A refrigerant", "Expansion valve, R-404A", "285.00", "Found refrigerant leak at valve fitting", "John Smith"],
    ["2024-03-16", "Uptown Store", "True", "T-49-HC", "REFRIGERATION", "Cooler not holding temperature, compressor short cycling", "Replaced run capacitor and cleaned condenser coils", "45MFD capacitor", "195.00", "", "Jane Doe"],
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "historical_import_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

const BATCH_SIZE = 8;

const inputClass = "border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ── Main Component ────────────────────────────────────────────────────────────

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [parseError, setParseError] = useState("");

  // Step 2 — AI processing
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [processProgress, setProcessProgress] = useState(0);
  const [processTotal, setProcessTotal] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState("");

  // Step 3 — new codes review
  const [newCodes, setNewCodes] = useState<SuggestedCode[]>([]);

  // Step 4 — import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);

  // ── Step 1: Parse CSV ──────────────────────────────────────────────────────

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    setParseError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCSV(text);
        const mapping = mapHeaders(headers);

        const get = (row: string[], key: string) => {
          const idx = mapping[key];
          return idx !== undefined ? (row[parseInt(idx)] ?? "").replace(/^"|"$/g, "").trim() : "";
        };

        const parsed: RawRow[] = rows
          .filter((r) => r.some((c) => c.trim()))
          .map((row) => ({
            date: get(row, "date"),
            store_name: get(row, "store_name"),
            make: get(row, "make"),
            model_number: get(row, "model_number"),
            asset_category: get(row, "asset_category"),
            symptom_description: get(row, "symptom_description"),
            resolution_description: get(row, "resolution_description"),
            parts_used: get(row, "parts_used"),
            labor_cost: get(row, "labor_cost"),
            tech_notes: get(row, "tech_notes"),
            technician: get(row, "technician"),
          }));

        if (parsed.length === 0) { setParseError("No data rows found. Check your CSV format."); return; }
        setRawRows(parsed);
      } catch {
        setParseError("Failed to parse CSV. Make sure it is a valid CSV file.");
      }
    };
    reader.readAsText(file);
  }

  // ── Step 2: AI processing ──────────────────────────────────────────────────

  async function runProcessing() {
    setProcessing(true);
    setProcessError("");
    setProcessProgress(0);
    setProcessTotal(rawRows.length);

    const results: MappedRow[] = [];
    const proposedNewCodes: Map<string, SuggestedCode> = new Map();

    for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
      const batch = rawRows.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/import/suggest-codes/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
          body: JSON.stringify({ rows: batch }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { results: batchResults } = await res.json();

        batch.forEach((row, j) => {
          const suggestion = batchResults.find((r: { row_index: number }) => r.row_index === j) || {};
          const mapped: MappedRow = {
            ...row,
            symptom_code: suggestion.symptom_code || "OTHER",
            symptom_label: suggestion.symptom_label || "Other",
            symptom_is_new: !!suggestion.symptom_is_new,
            resolution_code: suggestion.resolution_code || "OTHER",
            resolution_label: suggestion.resolution_label || "Other",
            resolution_is_new: !!suggestion.resolution_is_new,
          };
          results.push(mapped);

          if (suggestion.symptom_is_new) {
            const key = `S:${suggestion.symptom_code}:${suggestion.symptom_make || ""}`;
            if (!proposedNewCodes.has(key)) {
              proposedNewCodes.set(key, {
                code: suggestion.symptom_code,
                label: suggestion.symptom_label,
                make: suggestion.symptom_make || "",
                asset_category: suggestion.symptom_asset_category || "",
                is_new: true,
                type: "symptom",
                approved: true,
              });
            }
          }
          if (suggestion.resolution_is_new) {
            const key = `R:${suggestion.resolution_code}:${suggestion.resolution_make || ""}`;
            if (!proposedNewCodes.has(key)) {
              proposedNewCodes.set(key, {
                code: suggestion.resolution_code,
                label: suggestion.resolution_label,
                make: suggestion.resolution_make || "",
                asset_category: suggestion.resolution_asset_category || "",
                is_new: true,
                type: "resolution",
                approved: true,
              });
            }
          }
        });
      } catch (err: unknown) {
        // On error, fill batch with OTHER
        batch.forEach((row) => {
          results.push({
            ...row,
            symptom_code: "OTHER", symptom_label: "Other", symptom_is_new: false,
            resolution_code: "OTHER", resolution_label: "Other", resolution_is_new: false,
            error: err instanceof Error ? err.message : "AI processing failed",
          });
        });
      }

      setProcessProgress(Math.min(i + BATCH_SIZE, rawRows.length));
    }

    setMappedRows(results);
    setNewCodes(Array.from(proposedNewCodes.values()));
    setProcessing(false);
    setStep(3);
  }

  // ── Step 3: Update a new code field ───────────────────────────────────────

  function updateCode(idx: number, patch: Partial<SuggestedCode>) {
    setNewCodes((prev) => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }

  // ── Step 4: Run import ─────────────────────────────────────────────────────

  async function runImport() {
    setImporting(true);

    // 1. Create approved new codes
    const approvedCodes = newCodes.filter((c) => c.approved);
    for (const code of approvedCodes) {
      try {
        if (code.type === "symptom") {
          await api.createSymptomCode({ code: code.code, label: code.label, make: code.make, asset_category: code.asset_category, sort_order: 100 });
        } else {
          await api.createResolutionCode({ code: code.code, label: code.label, make: code.make, asset_category: code.asset_category, sort_order: 100 });
        }
      } catch { /* ignore duplicate errors */ }
    }

    // 2. Bulk import tickets
    const tickets = mappedRows.map((row) => ({
      date: row.date,
      store_name: row.store_name,
      make: row.make,
      model_number: row.model_number,
      asset_category: row.asset_category || "OTHER",
      symptom_code: row.symptom_code,
      resolution_code: row.resolution_code,
      symptom_description: row.symptom_description,
      resolution_description: row.resolution_description,
      parts_used: row.parts_used,
      labor_cost: row.labor_cost,
      tech_notes: row.tech_notes || row.resolution_description,
      technician: row.technician,
    }));

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/import/bulk-tickets/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({ tickets }),
      });
      const data = await res.json();
      setImportResult(data);
    } catch (err: unknown) {
      setImportResult({ created: 0, errors: [err instanceof Error ? err.message : "Import failed"] });
    } finally {
      setImporting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const newCodesCount = newCodes.filter((c) => c.approved).length;
  const steps = ["Upload CSV", "AI Processing", "Review Codes", "Import"];

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Historical Import</h1>
          <p className="text-slate-500 text-sm mt-0.5">Import past repair records and build your code library with AI assistance</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {steps.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  done ? "bg-emerald-100 text-emerald-700" : active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                }`}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{n}</span>}
                  {label}
                </div>
                {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-slate-800">Upload your CSV</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    The file should have columns for date, store, equipment, symptom description, and resolution description.
                    Column names are auto-detected — download the template to see the expected format.
                  </p>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium shrink-0 ml-4">
                  <Download className="w-4 h-4" /> Template
                </button>
              </div>

              <div
                className="border-2 border-dashed border-slate-200 rounded-xl py-12 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">Click to select a CSV file</p>
                <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

              {parseError && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {parseError}
                </div>
              )}

              {rawRows.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {rawRows.length} rows parsed successfully
                  </p>

                  {/* Preview */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Date", "Store", "Make", "Model", "Symptom", "Resolution"].map((h) => (
                            <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rawRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-600">{row.date || "—"}</td>
                            <td className="px-3 py-2 text-slate-600 max-w-24 truncate">{row.store_name || "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{row.make || "—"}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{row.model_number || "—"}</td>
                            <td className="px-3 py-2 text-slate-500 max-w-32 truncate">{row.symptom_description || "—"}</td>
                            <td className="px-3 py-2 text-slate-500 max-w-32 truncate">{row.resolution_description || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rawRows.length > 5 && (
                      <p className="text-xs text-slate-400 px-3 py-2 bg-slate-50 border-t border-slate-100">
                        +{rawRows.length - 5} more rows
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => { setStep(2); runProcessing(); }}
                disabled={rawRows.length === 0}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
              >
                Process with AI <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Processing ── */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-5">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
            <div>
              <h2 className="font-semibold text-slate-800">AI is classifying your records...</h2>
              <p className="text-slate-500 text-sm mt-1">Processing {processProgress} of {processTotal} rows</p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 max-w-sm mx-auto">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: processTotal > 0 ? `${(processProgress / processTotal) * 100}%` : "0%" }}
              />
            </div>
            {processError && (
              <p className="text-red-500 text-sm">{processError}</p>
            )}
          </div>
        )}

        {/* ── Step 3: Review new codes ── */}
        {step === 3 && (
          <div className="space-y-5">
            {newCodes.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-medium text-emerald-800">All records matched existing codes</p>
                <p className="text-emerald-600 text-sm mt-1">No new codes need to be created.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-800">New Codes Proposed</h2>
                    <p className="text-slate-500 text-sm mt-0.5">
                      The AI found {newCodes.length} code{newCodes.length !== 1 ? "s" : ""} that don&apos;t exist yet. Review and approve before importing.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setNewCodes((p) => p.map((c) => ({ ...c, approved: true })))}
                      className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                      Approve All
                    </button>
                    <button onClick={() => setNewCodes((p) => p.map((c) => ({ ...c, approved: false })))}
                      className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
                      Reject All
                    </button>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium w-8"></th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Type</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Code</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Label</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Make</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Approve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {newCodes.map((code, i) => (
                      <tr key={i} className={`${code.approved ? "" : "opacity-40"}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-block w-2 h-2 rounded-full ${code.type === "symptom" ? "bg-amber-400" : "bg-blue-400"}`} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${code.type === "symptom" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                            {code.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className={`${inputClass} font-mono text-xs w-48`}
                            value={code.code}
                            onChange={(e) => updateCode(i, { code: e.target.value.toUpperCase().replace(/\s/g, "_") })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className={`${inputClass} w-48`}
                            value={code.label}
                            onChange={(e) => updateCode(i, { label: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className={`${inputClass} w-32`}
                            value={code.make}
                            onChange={(e) => updateCode(i, { make: e.target.value })}
                            placeholder="blank = global"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => updateCode(i, { approved: !code.approved })}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                              code.approved
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-slate-300 text-transparent hover:border-slate-400"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Row summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-medium text-slate-800 text-sm mb-3">Mapped Records Preview ({mappedRows.length} rows)</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Store", "Make/Model", "Symptom", "Resolution"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600">{row.store_name || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{[row.make, row.model_number].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`font-mono ${row.symptom_is_new ? "text-amber-600" : "text-slate-600"}`}>
                            {row.symptom_code}
                          </span>
                          {row.symptom_is_new && <span className="ml-1 text-amber-500 text-xs">new</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-mono ${row.resolution_is_new ? "text-amber-600" : "text-slate-600"}`}>
                            {row.resolution_code}
                          </span>
                          {row.resolution_is_new && <span className="ml-1 text-amber-500 text-xs">new</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappedRows.length > 8 && (
                  <p className="text-xs text-slate-400 px-3 py-2 bg-slate-50 border-t border-slate-100">+{mappedRows.length - 8} more rows</p>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setStep(4)} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
                Continue to Import <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Import ── */}
        {step === 4 && (
          <div className="space-y-5">
            {!importResult ? (
              <>
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                  <h2 className="font-semibold text-slate-800">Ready to Import</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-slate-800">{mappedRows.length}</p>
                      <p className="text-xs text-slate-500 mt-1">Tickets to create</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700">{newCodesCount}</p>
                      <p className="text-xs text-amber-600 mt-1">New codes to add</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-700">{mappedRows.filter((r) => r.symptom_is_new || r.resolution_is_new).length}</p>
                      <p className="text-xs text-blue-600 mt-1">Rows using new codes</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    All tickets will be created as <strong>CLOSED</strong> historical records. New codes will be created first, then tickets will be imported.
                  </p>
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setStep(3)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={runImport}
                    disabled={importing}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {importing ? "Importing..." : "Start Import"}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
                {importResult.created > 0
                  ? <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  : <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                }
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{importResult.created} ticket{importResult.created !== 1 ? "s" : ""} imported</h2>
                  {newCodesCount > 0 && <p className="text-slate-500 text-sm mt-1">{newCodesCount} new code{newCodesCount !== 1 ? "s" : ""} added to your code library</p>}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="text-left bg-red-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                    <p className="text-red-700 text-sm font-medium mb-2">{importResult.errors.length} error{importResult.errors.length !== 1 ? "s" : ""}:</p>
                    {importResult.errors.map((e, i) => <p key={i} className="text-red-600 text-xs">{e}</p>)}
                  </div>
                )}
                <button
                  onClick={() => { setStep(1); setRawRows([]); setMappedRows([]); setNewCodes([]); setImportResult(null); }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Import another file
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
