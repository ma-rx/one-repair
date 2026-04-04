"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { api, DistrictManager, Organization, Store } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Plus, Pencil, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";

const EMPTY: Partial<Store> = {
  name: "", organization: "", address_line1: "", address_line2: "",
  city: "", state: "", zip_code: "", country: "US", phone: "", email: "", hours: "",
  is_active: true,
};

export default function StoresPage() {
  const { user } = useAuth();
  const isORS = user?.role === "ORS_ADMIN";

  const [stores, setStores]               = useState<Store[]>([]);
  const [orgs, setOrgs]                   = useState<Organization[]>([]);
  const [districtManagers, setDMs]        = useState<DistrictManager[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [filterOrg, setFilterOrg]         = useState("");
  const [modalOpen, setModalOpen]         = useState(false);
  const [editing, setEditing]             = useState<Store | null>(null);
  const [form, setForm]                   = useState<Partial<Store>>(EMPTY);
  const [saving, setSaving]               = useState(false);
  const [formError, setFormError]         = useState<string | null>(null);

  const [dmModalOpen, setDmModalOpen]     = useState(false);
  const [editingDM, setEditingDM]         = useState<DistrictManager | null>(null);
  const [dmForm, setDmForm]               = useState<Partial<DistrictManager>>({ name: "", phone: "", email: "", organization: "" });
  const [dmStoreIds, setDmStoreIds]       = useState<string[]>([]);
  const [dmSaving, setDmSaving]           = useState(false);
  const [dmFormError, setDmFormError]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.listStores(),
      isORS ? api.listOrganizations() : Promise.resolve([]),
      api.listDistrictManagers(),
    ])
      .then(([s, o, dms]) => { setStores(s); setOrgs(o as Organization[]); setDMs(dms); })
      .catch(() => setError("Failed to load stores."))
      .finally(() => setLoading(false));
  }, [isORS]);

  const displayed = filterOrg
    ? stores.filter((s) => s.organization === filterOrg)
    : stores;

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, organization: isORS ? "" : (user?.organization?.id ?? "") });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(store: Store) {
    setEditing(store);
    setForm({
      name: store.name, organization: store.organization,
      address_line1: store.address_line1, address_line2: store.address_line2,
      city: store.city, state: store.state, zip_code: store.zip_code,
      country: store.country, phone: store.phone, email: store.email,
      hours: store.hours, is_active: store.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const updated = await api.updateStore(editing.id, form);
        setStores((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      } else {
        const created = await api.createStore(form);
        setStores((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function openCreateDM() {
    setEditingDM(null);
    setDmForm({ name: "", phone: "", email: "", organization: isORS ? "" : (user?.organization?.id ?? "") });
    setDmStoreIds([]);
    setDmFormError(null);
    setDmModalOpen(true);
  }

  function openEditDM(dm: DistrictManager) {
    setEditingDM(dm);
    setDmForm({ name: dm.name, phone: dm.phone, email: dm.email, organization: dm.organization });
    setDmStoreIds(stores.filter((s) => s.district_manager === dm.id).map((s) => s.id));
    setDmFormError(null);
    setDmModalOpen(true);
  }

  async function handleDMSave(e: React.FormEvent) {
    e.preventDefault();
    setDmSaving(true);
    setDmFormError(null);
    try {
      let dm: DistrictManager;
      if (editingDM) {
        dm = await api.updateDistrictManager(editingDM.id, dmForm);
        setDMs((prev) => prev.map((d) => d.id === dm.id ? dm : d));
      } else {
        dm = await api.createDistrictManager(dmForm);
        setDMs((prev) => [...prev, dm]);
      }

      // Sync store assignments: add/remove district_manager on affected stores
      const prevStoreIds = stores.filter((s) => s.district_manager === dm.id).map((s) => s.id);
      const toAdd    = dmStoreIds.filter((id) => !prevStoreIds.includes(id));
      const toRemove = prevStoreIds.filter((id) => !dmStoreIds.includes(id));

      const updates = await Promise.all([
        ...toAdd.map((id) => api.updateStore(id, { district_manager: dm.id })),
        ...toRemove.map((id) => api.updateStore(id, { district_manager: null })),
      ]);
      if (updates.length > 0) {
        setStores((prev) => {
          const map = new Map(updates.map((s) => [s.id, s]));
          return prev.map((s) => map.get(s.id) ?? s);
        });
      }

      setDmModalOpen(false);
    } catch (err: any) {
      setDmFormError(err.message || "Failed to save.");
    } finally {
      setDmSaving(false);
    }
  }

  const f = (key: keyof Store, label: string, placeholder = "") => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stores</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage store locations</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Store
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Org filter (ORS Admin only) */}
      {isORS && orgs.length > 0 && (
        <div className="mb-5">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
          >
            <option value="">All Organizations</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {displayed.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No stores yet</p>
              <p className="text-sm mt-1">Add your first store location to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Store</th>
                  {isORS && <th className="text-left px-6 py-3 text-slate-500 font-medium">Organization</th>}
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Location</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Assets</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {displayed.map((store) => (
                  <tr key={store.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">{store.name}</p>
                      {store.phone && <p className="text-xs text-slate-400 mt-0.5">{store.phone}</p>}
                      {store.email && <p className="text-xs text-slate-400">{store.email}</p>}
                    </td>
                    {isORS && <td className="px-6 py-4 text-slate-500">{store.organization_name}</td>}
                    <td className="px-6 py-4 text-slate-500">
                      {[store.city, store.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{store.asset_count}</td>
                    <td className="px-6 py-4">
                      {store.is_active
                        ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                        : <span className="flex items-center gap-1 text-slate-400 text-xs font-medium"><XCircle className="w-3.5 h-3.5" /> Inactive</span>
                      }
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEdit(store)} className="text-slate-400 hover:text-blue-600 transition-colors">
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

      {/* District Managers section */}
      <div className="mt-10 mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">District Managers</h2>
          <p className="text-slate-500 text-sm mt-0.5">Assign district managers to stores</p>
        </div>
        <button
          onClick={openCreateDM}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add DM
        </button>
      </div>

      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {districtManagers.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No district managers yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Name</th>
                  {isORS && <th className="text-left px-6 py-3 text-slate-500 font-medium">Organization</th>}
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Phone</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Email</th>
                  <th className="text-left px-6 py-3 text-slate-500 font-medium">Stores</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {districtManagers.map((dm) => {
                  const dmStores = stores.filter((s) => s.district_manager === dm.id);
                  return (
                  <tr key={dm.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{dm.name}</td>
                    {isORS && <td className="px-6 py-4 text-slate-500">{orgs.find((o) => o.id === dm.organization)?.name ?? "—"}</td>}
                    <td className="px-6 py-4 text-slate-500">{dm.phone || "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{dm.email || "—"}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {dmStores.length === 0 ? <span className="text-slate-300">None</span> : dmStores.map((s) => s.name).join(", ")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEditDM(dm)} className="text-slate-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal
        title={editing ? "Edit Store" : "New Store"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        width="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          {/* Org selector (ORS admin only) */}
          {isORS && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Organization <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.organization ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, organization: e.target.value }))}
              >
                <option value="">Select organization...</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Store Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Address Line 1</label>
            <AddressAutocomplete
              value={form.address_line1 ?? ""}
              onChange={(v) => setForm((prev) => ({ ...prev, address_line1: v }))}
              onSelect={(parts) => setForm((prev) => ({
                ...prev,
                address_line1: parts.address_line1,
                city:          parts.city,
                state:         parts.state,
                zip_code:      parts.zip_code,
                country:       parts.country || prev.country,
              }))}
            />
          </div>
          {f("address_line2", "Address Line 2 (optional)")}

          <div className="grid grid-cols-3 gap-3">
            {f("city", "City")}
            {f("state", "State")}
            {f("zip_code", "ZIP Code")}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {f("phone", "Phone")}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={(form.email as string) ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>
          <div>
            {f("country", "Country")}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Store Hours</label>
            <textarea
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="e.g. Mon–Fri 5:30am–9pm, Sat–Sun 6am–8pm"
              value={(form.hours as string) ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, hours: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-blue-600"
              checked={form.is_active ?? true}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Store"}
            </button>
          </div>
        </form>
      </Modal>

      {/* District Manager Modal */}
      <Modal
        title={editingDM ? "Edit District Manager" : "New District Manager"}
        open={dmModalOpen}
        onClose={() => setDmModalOpen(false)}
        width="max-w-md"
      >
        <form onSubmit={handleDMSave} className="space-y-4">
          {dmFormError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {dmFormError}
            </div>
          )}

          {isORS && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Organization <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dmForm.organization ?? ""}
                onChange={(e) => setDmForm((prev) => ({ ...prev, organization: e.target.value }))}
              >
                <option value="">Select organization...</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dmForm.name ?? ""}
              onChange={(e) => setDmForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                type="tel"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dmForm.phone ?? ""}
                onChange={(e) => setDmForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dmForm.email ?? ""}
                onChange={(e) => setDmForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>

          {/* Store assignments */}
          {(() => {
            const orgId = dmForm.organization || (editingDM?.organization ?? "");
            const eligible = stores.filter((s) => !orgId || s.organization === orgId);
            if (eligible.length === 0) return null;
            return (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assigned Stores</label>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {eligible.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-blue-600"
                        checked={dmStoreIds.includes(s.id)}
                        onChange={(e) => setDmStoreIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                        )}
                      />
                      <span className="text-sm text-slate-700">{s.name}</span>
                      {s.city && <span className="text-xs text-slate-400 ml-auto">{s.city}, {s.state}</span>}
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setDmModalOpen(false)}
              className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={dmSaving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {dmSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingDM ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
