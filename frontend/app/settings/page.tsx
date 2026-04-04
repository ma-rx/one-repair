"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, PricingConfig } from "@/lib/api";
import { Building2, DollarSign, CheckCircle2, Loader2, Upload } from "lucide-react";

type Tab = "company" | "pricing";

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const LOGO_BUCKET    = "ors-logo";

export default function SettingsPage() {
  const [tab, setTab]       = useState<Tab>("company");
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [uploading, setUploading] = useState(false);

  // Company fields
  const [companyName,    setCompanyName]    = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone,   setCompanyPhone]   = useState("");
  const [companyEmail,   setCompanyEmail]   = useState("");
  const [logoUrl,        setLogoUrl]        = useState("");

  // Pricing fields
  const [tripCharge, setTripCharge] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [minHours,   setMinHours]   = useState("");
  const [taxRate,    setTaxRate]    = useState("");

  useEffect(() => {
    api.getPricing()
      .then((c) => {
        setConfig(c);
        setCompanyName(c.company_name || "");
        setCompanyAddress(c.company_address || "");
        setCompanyPhone(c.company_phone || "");
        setCompanyEmail(c.company_email || "");
        setLogoUrl(c.logo_url || "");
        setTripCharge(c.trip_charge);
        setHourlyRate(c.hourly_rate);
        setMinHours(c.min_hours);
        setTaxRate(c.tax_rate || "0");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const ext      = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${ext}`;
      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${LOGO_BUCKET}/${fileName}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
          },
          body: file,
        },
      );
      if (!res.ok) throw new Error("Upload failed");
      const url = `${SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${fileName}`;
      setLogoUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError("");
    try {
      const body: Partial<PricingConfig> = tab === "company"
        ? { company_name: companyName, company_address: companyAddress, company_phone: companyPhone, company_email: companyEmail, logo_url: logoUrl }
        : { trip_charge: tripCharge, hourly_rate: hourlyRate, min_hours: minHours, tax_rate: taxRate };
      const updated = await api.updatePricing(body);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Company info, branding, and pricing configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6">
        {(["company", "pricing"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSaved(false); setError(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t === "company" ? "Company Info" : "Pricing"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <form onSubmit={handleSave} className="max-w-lg space-y-5">
          {error && <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
          {saved && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Saved successfully.
            </div>
          )}

          {tab === "company" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Company Information</p>
                  <p className="text-slate-500 text-xs">Appears on invoices and emails sent to clients</p>
                </div>
              </div>

              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo</label>
                {logoUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logoUrl} alt="Logo" className="h-14 mb-3 rounded-lg border border-slate-200 object-contain p-1" />
                )}
                <label className={`flex items-center gap-2 w-fit cursor-pointer px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading…" : "Upload Logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
                <p className="text-slate-400 text-xs mt-1">PNG or JPG recommended. Will appear in invoice PDFs and emails.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name</label>
                <input
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === "pricing" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Labor Rates</p>
                  <p className="text-slate-500 text-xs">Applied automatically when a tech closes a ticket</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Flat Trip Charge ($)</label>
                <input type="number" min="0" step="0.01" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={tripCharge} onChange={(e) => setTripCharge(e.target.value)} />
                <p className="text-slate-400 text-xs mt-1">Charged once per visit regardless of duration</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Hourly Rate ($/hr)</label>
                <input type="number" min="0" step="0.01" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Minimum Billable Hours</label>
                <input type="number" min="0.5" step="0.5" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={minHours} onChange={(e) => setMinHours(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Default Sales Tax Rate (%)</label>
                <input type="number" min="0" step="0.01" max="100" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                <p className="text-slate-400 text-xs mt-1">Can be overridden per org or per store</p>
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
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save {tab === "company" ? "Company Info" : "Pricing"}
          </button>

          {config && (
            <p className="text-center text-slate-400 text-xs">Last updated {new Date(config.updated_at).toLocaleString()}</p>
          )}
        </form>
      )}
    </DashboardShell>
  );
}
