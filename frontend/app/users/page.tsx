"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { api, OrgUser, Organization, Store, CreateUserBody } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, Plus, Loader2, UserCheck, UserX, Pencil,
} from "lucide-react";

const ROLES = [
  { value: "ORS_ADMIN",      label: "ORS Admin",      forORS: true,    forClient: false },
  { value: "CLIENT_ADMIN",   label: "Client Admin",   forORS: true,    forClient: false },
  { value: "CLIENT_MANAGER", label: "Store Manager",  forORS: true,    forClient: true  },
  { value: "TECH",           label: "Technician",     forORS: true,    forClient: true  },
];

const roleBadge: Record<string, string> = {
  ORS_ADMIN:      "bg-purple-100 text-purple-700",
  CLIENT_ADMIN:   "bg-blue-100 text-blue-700",
  CLIENT_MANAGER: "bg-teal-100 text-teal-700",
  TECH:           "bg-orange-100 text-orange-700",
};

const roleLabel: Record<string, string> = {
  ORS_ADMIN: "ORS Admin", CLIENT_ADMIN: "Client Admin",
  CLIENT_MANAGER: "Store Manager", TECH: "Technician",
};

type UserForm = Omit<CreateUserBody, "organization" | "store"> & {
  organization: string;
  store: string;
};

const emptyForm = (): UserForm => ({
  email: "", first_name: "", last_name: "",
  password: "", role: "TECH",
  organization: "", store: "",
});

export default function UsersPage() {
  const { user: me } = useAuth();
  const isORS = me?.role === "ORS_ADMIN";

  const [users, setUsers]     = useState<OrgUser[]>([]);
  const [orgs, setOrgs]       = useState<Organization[]>([]);
  const [stores, setStores]   = useState<Store[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<OrgUser | null>(null);
  const [form, setForm]           = useState<UserForm>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  function loadUsers() {
    setLoading(true);
    api.listUsers(roleFilter || undefined)
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, [roleFilter]);

  useEffect(() => {
    if (isORS) {
      api.listOrganizations().then(setOrgs).catch(() => {});
    }
    api.listStores().then(setStores).catch(() => {});
  }, [isORS]);

  // Filter stores by selected org
  const orgStores = form.organization
    ? stores.filter((s) => s.organization === form.organization)
    : stores;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(u: OrgUser) {
    setEditing(u);
    setForm({
      email:        u.email,
      first_name:   u.first_name,
      last_name:    u.last_name,
      password:     "",
      role:         u.role,
      organization: u.organization?.id ?? "",
      store:        u.store?.id ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (editing) {
      // Edit mode — password optional
      if (!form.email || !form.first_name || !form.role) {
        setFormError("Email, first name, and role are required.");
        return;
      }
      setSaving(true);
      setFormError("");
      const body: Partial<CreateUserBody> = {
        email:      form.email,
        first_name: form.first_name,
        last_name:  form.last_name,
        role:       form.role,
        ...(form.organization ? { organization: form.organization } : { organization: undefined }),
        ...(form.store        ? { store: form.store }               : { store: undefined }),
      };
      if (form.password) body.password = form.password;
      try {
        const updated = await api.updateUser(editing.id, body);
        setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        setModalOpen(false);
      } catch (e: unknown) {
        setFormError(e instanceof Error ? e.message : "Failed to update user.");
      } finally {
        setSaving(false);
      }
    } else {
      // Create mode
      if (!form.email || !form.first_name || !form.password || !form.role) {
        setFormError("Email, first name, password, and role are required.");
        return;
      }
      setSaving(true);
      setFormError("");
      const body: CreateUserBody = {
        email:      form.email,
        first_name: form.first_name,
        last_name:  form.last_name,
        password:   form.password,
        role:       form.role,
        ...(form.organization ? { organization: form.organization } : {}),
        ...(form.store        ? { store: form.store }               : {}),
      };
      try {
        const created = await api.createUser(body);
        setUsers((prev) => [created, ...prev]);
        setModalOpen(false);
      } catch (e: unknown) {
        setFormError(e instanceof Error ? e.message : "Failed to create user.");
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleToggle(u: OrgUser) {
    try {
      const updated = await api.toggleUserActive(u.id);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch {/* ignore */}
  }

  const availableRoles = ROLES.filter((r) => isORS ? r.forORS : r.forClient);
  const filterRoles    = ROLES.filter((r) => isORS ? r.forORS : r.forClient);

  return (
    <DashboardShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage team members and access</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Role filter tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setRoleFilter("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            roleFilter === "" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          All
        </button>
        {filterRoles.map((r) => (
          <button
            key={r.value}
            onClick={() => setRoleFilter(r.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              roleFilter === r.value ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No users yet. Add your first team member.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Name</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Role</th>
                {isORS && <th className="text-left px-6 py-3 text-slate-500 font-medium">Organization</th>}
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Store</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-6 py-3 text-right text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!u.is_active ? "opacity-50" : ""}`}
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">
                      {`${u.first_name} ${u.last_name}`.trim() || "—"}
                    </p>
                    <p className="text-slate-400 text-xs">{u.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {roleLabel[u.role] ?? u.role}
                    </span>
                  </td>
                  {isORS && (
                    <td className="px-6 py-4 text-slate-500">{u.organization?.name ?? "—"}</td>
                  )}
                  <td className="px-6 py-4 text-slate-500">{u.store?.name ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit user"
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors text-slate-600 bg-slate-100 hover:bg-slate-200"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleToggle(u)}
                        title={u.is_active ? "Deactivate" : "Reactivate"}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                          u.is_active
                            ? "text-red-600 bg-red-50 hover:bg-red-100"
                            : "text-green-600 bg-green-50 hover:bg-green-100"
                        }`}
                      >
                        {u.is_active
                          ? <><UserX className="w-3.5 h-3.5" /> Deactivate</>
                          : <><UserCheck className="w-3.5 h-3.5" /> Reactivate</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit User Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit User" : "Add User"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password {!editing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              minLength={8}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
            />
            <p className="text-slate-400 text-xs mt-1">
              {editing ? "Leave blank to keep current password" : "Minimum 8 characters"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value, store: "" })}
              required
            >
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Org selector — ORS Admin only */}
          {isORS && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Organization
                {["CLIENT_ADMIN", "CLIENT_MANAGER", "TECH"].includes(form.role) && (
                  <span className="text-red-500"> *</span>
                )}
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value, store: "" })}
              >
                <option value="">— None (ORS staff) —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Store selector — only for CLIENT_MANAGER */}
          {form.role === "CLIENT_MANAGER" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Assigned Store <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.store}
                onChange={(e) => setForm({ ...form, store: e.target.value })}
                required
              >
                <option value="">Select a store…</option>
                {orgStores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
