"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, Organization } from "@/lib/api";
import { Building2, Plus, Pencil, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";

const PLAN_STYLES: Record<string, string> = {
  STARTER:      "bg-slate-100 text-slate-600",
  PROFESSIONAL: "bg-blue-100 text-blue-700",
  ENTERPRISE:   "bg-violet-100 text-violet-700",
};

const EMPTY: Partial<Organization> = {
  name: "", email: "", phone: "", address: "", plan: "STARTER", is_active: true, code: "", nte_limit: "500",
};

export default function OrganizationsPage() {
  const [orgs, setOrgs]         = useState<Organization[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState<Organization | null>(null);
  const [form, setForm]         = useState<Partial<Organization>>(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setOrgs(await api.listOrganizations()); }
    catch { setError("Failed to load organizations."); }
    finally { setLoading(false); }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(org: Organization) {
    setEditing(org);
    setForm({ name: org.name, email: org.email, phone: org.phone, address: org.address, plan: org.plan, is_active: org.is_active, code: org.code ?? "", nte_limit: org.nte_limit ?? "500" });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const updated = await api.updateOrganization(editing.id, form);
        setOrgs((prev) => prev.map((o) => o.id === updated.id ? updated : o));
      } else {
        const created = await api.createOrganization(form);
        setOrgs((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof Organization, label: string, type = "text", required = false) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        required={required}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage client organizations</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Organization
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {orgs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No organizations yet</p>
              <p className="text-sm mt-1">Add your first client organization to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Name</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Email</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Code</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">NTE</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Plan</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Stores</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{org.name}</td>
                    <td className="px-6 py-4 text-slate-500">{org.email || "—"}</td>
                    <td className="px-6 py-4 text-slate-700 font-mono text-xs">{org.code || "—"}</td>
                    <td className="px-6 py-4 text-slate-500">${org.nte_limit || "500"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PLAN_STYLES[org.plan]}`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{org.store_count}</td>
                    <td className="px-6 py-4">
                      {org.is_active
                        ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                        : <span className="flex items-center gap-1 text-slate-400 text-xs font-medium"><XCircle className="w-3.5 h-3.5" /> Inactive</span>
                      }
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(org)}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal
        title={editing ? "Edit Organization" : "New Organization"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          {field("name", "Organization Name", "text", true)}

          <div className="grid grid-cols-2 gap-4">
            {field("email", "Email", "email")}
            {field("phone", "Phone")}
          </div>

          {field("address", "Address")}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Ticket Code</label>
              <input
                type="text"
                maxLength={2}
                placeholder="DD"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                value={(form.code as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().slice(0, 2) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">NTE Limit ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={(form.nte_limit as string) ?? "500"}
                onChange={(e) => setForm((f) => ({ ...f, nte_limit: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Plan</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.plan ?? "STARTER"}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
              >
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-blue-600"
                  checked={form.is_active ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
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
              {editing ? "Save Changes" : "Create Organization"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
