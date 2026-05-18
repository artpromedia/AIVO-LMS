"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useTranslations } from "next-intl";

interface User {
  id: string;
  name: string;
  email: string | null;
  role: string;
  tenantId: string | null;
  deactivatedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Tenant {
  id: string;
  name: string;
  type: string;
}

const ROLE_COLORS: Record<string, string> = {
  PARENT: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  LEARNER: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  TEACHER: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  THERAPIST: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  CAREGIVER: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  PLATFORM_ADMIN: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  DISTRICT_ADMIN: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  SALES: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  MARKETING: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  CUSTOMER_CARE: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  SUPPORT: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  FINANCE: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  DEVOPS: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
};

const ROLES = [
  "ALL",
  "PARENT",
  "LEARNER",
  "TEACHER",
  "CAREGIVER",
  "THERAPIST",
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
];

const CREATABLE_ROLES = [
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "PARENT",
  "LEARNER",
  "TEACHER",
  "CAREGIVER",
  "THERAPIST",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
];

const INTERNAL_ROLES = [
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
  "PLATFORM_ADMIN",
];

const ROLE_GROUPS: { label: string; roles: string[] }[] = [
  { label: "Admin", roles: ["PLATFORM_ADMIN", "DISTRICT_ADMIN"] },
  { label: "Education", roles: ["PARENT", "LEARNER", "TEACHER", "CAREGIVER", "THERAPIST"] },
  {
    label: "Internal Team",
    roles: ["SALES", "MARKETING", "CUSTOMER_CARE", "SUPPORT", "FINANCE", "DEVOPS"],
  },
];

const ROLE_DASHBOARDS: Record<string, string> = {
  PARENT: "/dashboard/parent",
  LEARNER: "/dashboard/learner",
  TEACHER: "/dashboard/teacher",
  CAREGIVER: "/dashboard/caregiver",
  THERAPIST: "/dashboard/therapist",
  PLATFORM_ADMIN: "/dashboard/admin",
  DISTRICT_ADMIN: "/dashboard/district",
  SALES: "/dashboard/internal/sales",
  MARKETING: "/dashboard/internal/marketing",
  CUSTOMER_CARE: "/dashboard/internal/customer-care",
  SUPPORT: "/dashboard/internal/support",
  FINANCE: "/dashboard/internal/finance",
  DEVOPS: "/dashboard/internal/devops",
};

function CreateUserModal({
  open,
  onClose,
  onCreated,
  accessToken,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  accessToken: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("PLATFORM_ADMIN");
  const [tenantId, setTenantId] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState("");

  const needsTenant = !INTERNAL_ROLES.includes(role);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin-svc/tenants", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTenants(Array.isArray(data) ? data : []))
      .catch(() => setTenants([]));
  }, [open, accessToken]);

  useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
      setRole("PLATFORM_ADMIN");
      setTenantId("");
      setResult(null);
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, string> = { name, email, role };
      if (needsTenant && tenantId) body.tenantId = tenantId;

      const res = await fetch("/api/admin/create-team-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }
      const data = await res.json();
      setResult({ email: data.user.email, temporaryPassword: data.temporaryPassword });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" role="presentation" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="p-6 border-b vi-border">
          <h2 className="text-lg font-heading font-bold vi-text">Create New User</h2>
          <p className="text-sm vi-text-muted mt-1">
            Add a new user to the platform with any role.
          </p>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-[hsl(var(--visual-science))] font-semibold">
                User created successfully!
              </p>
              <div className="text-sm space-y-1">
                <p className="text-[hsl(var(--visual-science))]">
                  Email: <span className="font-mono font-semibold">{result.email}</span>
                </p>
                <p className="text-[hsl(var(--visual-science))]">
                  Temporary Password:{" "}
                  <span className="font-mono font-semibold bg-[hsl(var(--visual-science)/0.14)] px-2 py-0.5 rounded select-all">
                    {result.temporaryPassword}
                  </span>
                </p>
              </div>
              <p className="text-xs text-green-600 mt-2">
                Share these credentials securely. The user should change their password on first
                login.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-[hsl(var(--visual-math))] px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="user-fullname" className="block text-sm font-medium vi-text mb-1">
                Full Name
              </label>
              <input
                id="user-fullname"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label htmlFor="user-email" className="block text-sm font-medium vi-text mb-1">
                Email
              </label>
              <input
                id="user-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                placeholder="jane@aivo.test"
              />
            </div>

            <div>
              <label htmlFor="user-role" className="block text-sm font-medium vi-text mb-1">
                Role
              </label>
              <select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
              >
                {ROLE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.roles.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {needsTenant && (
              <div>
                <label htmlFor="user-tenant" className="block text-sm font-medium vi-text mb-1">
                  Tenant / Organization <span className="text-red-500">*</span>
                </label>
                <select
                  id="user-tenant"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                >
                  <option value="">Select a tenant...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
                <p className="text-xs vi-text-muted mt-1">
                  Non-internal roles require assignment to a tenant.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border vi-border vi-text-muted font-semibold hover:vi-bg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (needsTenant && !tenantId)}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { user: currentUser, accessToken, impersonate } = useAuth();
  const t = useTranslations("platformAdmin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const [totalUsers, setTotalUsers] = useState(0);
  const [searchDebounce, setSearchDebounce] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadUsers = () => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) });
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    if (searchDebounce) params.set("search", searchDebounce);
    fetch(`/api/admin-svc/users?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : { users: [], total: 0 }))
      .then((data) => {
        setUsers(data.users || []);
        setTotalUsers(data.total || 0);
      })
      .catch(() => {
        setUsers([]);
        setTotalUsers(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, [accessToken, roleFilter, currentPage, searchDebounce]);

  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);
  const paginatedUsers = users;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchDebounce, roleFilter]);

  const roleCounts = ROLES.slice(1).reduce(
    (acc, role) => {
      acc[role] = users.filter((u) => u.role === role).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const canImpersonate = currentUser?.role === "PLATFORM_ADMIN";
  const canCreate = currentUser?.role === "PLATFORM_ADMIN";

  const handleImpersonate = async (userId: string, role: string) => {
    setImpersonating(userId);
    setImpersonateError(null);
    try {
      await impersonate(userId);
      router.push(ROLE_DASHBOARDS[role] || "/");
    } catch (err: unknown) {
      setImpersonating(null);
      setImpersonateError(err instanceof Error ? err.message : "Impersonation failed");
      setTimeout(() => setImpersonateError(null), 5000);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {impersonateError && (
        <div className="fixed top-4 right-4 z-[9999] bg-red-50 border border-red-200 text-[hsl(var(--visual-math))] px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          {impersonateError}
        </div>
      )}

      {canCreate && accessToken && (
        <CreateUserModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadUsers}
          accessToken={accessToken}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{t("users")}</h1>
          <p className="text-sm vi-text-muted mt-1">
            Manage all platform users, roles, and access controls.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            Create User
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {ROLES.slice(1).map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(roleFilter === role ? "ALL" : role)}
            className={`p-3 rounded-xl border text-center transition ${
              roleFilter === role
                ? "border-purple-300 vi-surface-soft shadow-sm"
                : "vi-border bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-lg font-bold vi-text">{roleCounts[role] ?? 0}</p>
            <p className="text-[10px] font-semibold vi-text-muted mt-0.5">
              {role.replace(/_/g, " ")}
            </p>
          </button>
        ))}
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder={tc("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 rounded-lg border vi-border text-sm w-full md:w-80 focus:border-primary focus:ring-2 focus:ring-purple-100 outline-none"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border vi-border text-sm bg-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "ALL" ? "All Roles" : r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm vi-text-muted">{totalUsers} users</p>
        </div>

        {loading ? (
          <div className="p-10 text-center vi-text-muted animate-pulse">Loading users...</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">{tc("email")}</th>
                  <th className="px-5 py-3 font-semibold">{tc("role")}</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => (
                  <tr key={u.id} className="border-b vi-border hover:vi-bg/50 transition">
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/admin/users/${u.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-full bg-[hsl(var(--visual-primary))] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name?.charAt(0) || "?"}
                        </div>
                        <span className="font-medium vi-text group-hover:text-[hsl(var(--visual-primary))] transition">
                          {u.name}
                        </span>
                        {u.deactivatedAt && (
                          <span className="text-xs bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] px-1.5 py-0.5 rounded-full">
                            Deactivated
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-5 py-3 vi-text-muted">{u.email || "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${ROLE_COLORS[u.role] || "vi-surface-soft vi-text-muted"}`}
                      >
                        {u.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 vi-text-muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      {canImpersonate && u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleImpersonate(u.id, u.role)}
                          disabled={impersonating === u.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-[hsl(var(--visual-sel))] hover:bg-[hsl(var(--visual-sel)/0.18)] border border-amber-200 transition disabled:opacity-50"
                        >
                          {impersonating === u.id ? "Switching..." : "Login as"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {paginatedUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center vi-text-muted">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalUsers}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </div>
    </div>
  );
}
