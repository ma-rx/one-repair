"use client";

import { useEffect, useState } from "react";
import { api, PricingConfig } from "@/lib/api";
import { CheckCircle2, DollarSign, Loader2, Wrench } from "lucide-react";

export default function PricingPage() {
  const [config, setConfig]   = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  const [tripCharge, setTripCharge] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [minHours, setMinHours]     = useState("");
  const [taxRate, setTaxRate]       = useState("");

  useEffect(() => {
    api.getPricing()
      .then((c) => {
        setConfig(c);
        setTripCharge(c.trip_charge);
        setHourlyRate(c.hourly_rate);
        setMinHours(c.min_hours);
        setTaxRate(c.tax_rate || "0");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError("");
    try {
      const updated = await api.updatePricing({
        trip_charge: tripCharge,
        hourly_rate: hourlyRate,
        min_hours: minHours,
        tax_rate: taxRate,
      } as Partial<PricingConfig>);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">Pricing Configuration</p>
          <p className="text-slate-400 text-xs">Labor rates applied to all service reports</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}
            {saved && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4" /> Pricing saved.
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <DollarSign className="w-4.5 h-4.5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Labor Rates</p>
                  <p className="text-slate-500 text-xs">Applied automatically when a tech closes a ticket</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Flat Trip Charge ($)</label>
                <input
                  type="number" min="0" step="0.01" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={tripCharge}
                  onChange={(e) => setTripCharge(e.target.value)}
                />
                <p className="text-slate-400 text-xs mt-1">Charged once per visit regardless of duration</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Hourly Rate ($/hr)</label>
                <input
                  type="number" min="0" step="0.01" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Minimum Billable Hours</label>
                <input
                  type="number" min="0.5" step="0.5" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={minHours}
                  onChange={(e) => setMinHours(e.target.value)}
                />
                <p className="text-slate-400 text-xs mt-1">Tech must bill at least this many hours even if clocked time is less</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Default Sales Tax Rate (%)</label>
                <input
                  type="number" min="0" step="0.01" max="100" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
                <p className="text-slate-400 text-xs mt-1">Applied to parts + labor. Set to 0 for no tax.</p>
              </div>

              {tripCharge && hourlyRate && minHours && (
                <div className="bg-slate-50 rounded-lg p-4 text-sm">
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">Example — 1.5 hrs on site</p>
                  <p className="text-slate-700">
                    ${tripCharge} trip + {Math.max(parseFloat(minHours), 1.5)}h × ${hourlyRate} = <span className="font-bold text-slate-900">${(parseFloat(tripCharge) + Math.max(parseFloat(minHours), 1.5) * parseFloat(hourlyRate)).toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit" disabled={saving}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save Pricing
            </button>

            {config && (
              <p className="text-center text-slate-400 text-xs">Last updated {new Date(config.updated_at).toLocaleString()}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
