"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import {
  Upload, Download, CheckCircle2, XCircle, Loader2, AlertTriangle,
} from "lucide-react";

export interface CsvColumn {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
}

interface ParsedRow {
  index: number;
  raw: Record<string, string>;
  data: unknown;
  errors: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  templateFilename: string;
  columns: CsvColumn[];
  /** Validate and transform a raw CSV row → { data, errors } */
  onParseRow: (raw: Record<string, string>, index: number) => { data: unknown; errors: string[] };
  /** Create a single record; should throw on failure */
  onImportRow: (data: unknown) => Promise<unknown>;
  onComplete: (succeeded: number, failed: number) => void;
}

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

function generateTemplate(columns: CsvColumn[], filename: string) {
  const header = columns.map((c) => c.label).join(",");
  const example = columns.map((c) => c.hint ?? "").join(",");
  const blob = new Blob([header + "\n" + example], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Stage = "upload" | "preview" | "importing" | "done";

export default function CsvImportModal({
  open, onClose, title, templateFilename, columns,
  onParseRow, onImportRow, onComplete,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<{ succeeded: number; failed: number }>({ succeeded: 0, failed: 0 });

  function reset() {
    setStage("upload");
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setResults({ succeeded: 0, failed: 0 });
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rawRows = parseCsvText(text);
      const parsed = rawRows
        .filter((r) => Object.values(r).some((v) => v.trim() !== ""))
        .map((raw, i) => {
          const { data, errors } = onParseRow(raw, i);
          return { index: i + 1, raw, data, errors };
        });
      setRows(parsed);
      setStage("preview");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r.errors.length === 0);
    setProgress({ done: 0, total: validRows.length });
    setStage("importing");
    let succeeded = 0;
    let failed = 0;
    for (const row of validRows) {
      try {
        await onImportRow(row.data);
        succeeded++;
      } catch {
        failed++;
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setResults({ succeeded, failed });
    setStage("done");
    onComplete(succeeded, failed);
  }

  const invalidCount = rows.filter((r) => r.errors.length > 0).length;
  const validCount = rows.length - invalidCount;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      width="max-w-3xl"
    >
      {stage === "upload" && (
        <div className="space-y-5">
          <p className="text-sm text-slate-500">
            Download the template, fill it in, then upload your CSV to import records in bulk.
          </p>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Template Columns</p>
            <div className="flex flex-wrap gap-2">
              {columns.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  {c.label}
                  {c.required && <span className="text-red-400">*</span>}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => generateTemplate(columns, templateFilename)}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" /> Download Template CSV
          </button>
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-xl py-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
            <Upload className="w-8 h-8 text-slate-300" />
            <span className="text-sm text-slate-500">Click to upload your CSV file</span>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>
        </div>
      )}

      {stage === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> {validCount} valid
            </span>
            {invalidCount > 0 && (
              <span className="flex items-center gap-1.5 text-red-500 font-medium">
                <XCircle className="w-4 h-4" /> {invalidCount} with errors (will be skipped)
              </span>
            )}
            <button onClick={reset} className="ml-auto text-slate-400 hover:text-slate-600 text-xs underline">
              Upload different file
            </button>
          </div>

          <div className="overflow-auto max-h-72 rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">#</th>
                  {columns.slice(0, 5).map((c) => (
                    <th key={c.key} className="text-left px-3 py-2 text-slate-500 font-medium">{c.label}</th>
                  ))}
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.index} className={`border-t border-slate-100 ${row.errors.length > 0 ? "bg-red-50/50" : ""}`}>
                    <td className="px-3 py-2 text-slate-400">{row.index}</td>
                    {columns.slice(0, 5).map((c) => (
                      <td key={c.key} className="px-3 py-2 text-slate-600 max-w-[120px] truncate">
                        {row.raw[c.label] ?? "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {row.errors.length === 0 ? (
                        <span className="text-emerald-600 font-medium">OK</span>
                      ) : (
                        <span className="text-red-500" title={row.errors.join("; ")}>
                          {row.errors[0]}{row.errors.length > 1 ? ` +${row.errors.length - 1}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validCount === 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> No valid rows to import. Fix the errors and re-upload.
            </div>
          ) : (
            <div className="flex gap-3 pt-1">
              <button onClick={handleClose} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Import {validCount} Record{validCount !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      )}

      {stage === "importing" && (
        <div className="py-8 text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-600 font-medium">Importing records…</p>
          <div className="w-full bg-slate-100 rounded-full h-2 max-w-sm mx-auto">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-slate-400">{progress.done} / {progress.total}</p>
        </div>
      )}

      {stage === "done" && (
        <div className="py-8 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="font-semibold text-slate-800 text-lg">Import Complete</p>
          <div className="flex items-center justify-center gap-6 text-sm">
            <span className="text-emerald-600 font-medium">{results.succeeded} succeeded</span>
            {results.failed > 0 && (
              <span className="text-red-500 font-medium">{results.failed} failed</span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="mt-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
