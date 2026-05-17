"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, School, Users, ClipboardList, type LucideIcon } from "lucide-react";

interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface TenantLearner {
  id: string;
  name: string;
  functioningLevel: string | null;
  gradeLevel: string | null;
  createdAt: string;
}

interface TenantDetail {
  id: string;
  name: string;
  type: string;
  settings: any;
  status: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
  users: TenantUser[];
  learners: TenantLearner[];
  userCount: number;
  learnerCount: number;
}

const TYPE_CONFIG: Record<string, { label: string; Icon: LucideIcon; color: string; well: string }> = {
  B2C_FAMILY: { label: "Family", Icon: Users, color: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]", well: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" },
  B2B_SCHOOL: { label: "School", Icon: School, color: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]", well: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" },
  B2B_DISTRICT: { label: "District", Icon: Building2, color: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]", well: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" },
};

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  STANDARD: { label: "Standard", color: "text-[hsl(var(--visual-science))]", bg: "bg-[hsl(var(--visual-science)/0.14)]" },
  SUPPORTED: { label: "Supported", color: "text-[hsl(var(--visual-reading))]", bg: "bg-[hsl(var(--visual-reading)/0.12)]" },
  LOW_VERBAL: { label: "Low Verbal", color: "text-[hsl(var(--visual-sel))]", bg: "bg-[hsl(var(--visual-sel)/0.18)]" },
  NON_VERBAL: { label: "Non-Verbal", color: "text-[hsl(var(--visual-sel))]", bg: "bg-[hsl(var(--visual-sel)/0.18)]" },
  PRE_SYMBOLIC: { label: "Pre-Symbolic", color: "text-[hsl(var(--visual-math))]", bg: "bg-[hsl(var(--visual-math)/0.12)]" },
};

export default function TenantDetailPage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSettings, setEditSettings] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [suspending, setSuspending] = useState(false);

  const fetchTenant = () => {
    if (!accessToken || !id) return;
    setLoading(true);
    fetch(`/api/admin-svc/tenants/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load tenant");
        return r.json();
      })
      .then((data) => {
        setTenant(data);
        setEditName(data.name);
        setEditSettings(JSON.stringify(data.settings || {}, null, 2));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenant();
  }, [accessToken, id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      let parsedSettings;
      try {
        parsedSettings = JSON.parse(editSettings);
      } catch {
        setSaveError("Invalid JSON in settings");
        setSaving(false);
        return;
      }
      const res = await fetch(`/api/admin-svc/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: editName, settings: parsedSettings }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update tenant");
      }
      setShowEdit(false);
      fetchTenant();
    } catch (e: any) {
      setSaveError(e.message);
    }
    setSaving(false);
  };

  const handleToggleSuspend = async () => {
    if (!tenant) return;
    const newStatus = tenant.status === "suspended" ? "active" : "suspended";
    const reason = newStatus === "suspended" ? prompt("Suspension reason:") : undefined;
    if (newStatus === "suspended" && !reason) return;
    setSuspending(true);
    try {
      const body: any = { status: newStatus };
      if (reason) body.suspensionReason = reason;
      const res = await fetch(`/api/admin-svc/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update status");
      fetchTenant();
    } catch {
    }
    setSuspending(false);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-10 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-8 space-y-4">
        <Link href="/dashboard/admin/tenants" className="text-sm text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] font-medium">
          ← Back to Tenants
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-600">
          {error || "Tenant not found"}
        </div>
      </div>
    );
  }

  const typeConfig = TYPE_CONFIG[tenant.type] || { label: tenant.type, Icon: ClipboardList, color: "vi-surface-soft vi-text-muted", well: "vi-surface-soft vi-text-muted" };
  const HeroIcon = typeConfig.Icon;
  const isSuspended = tenant.status === "suspended";

  return (
    <div className="p-8 space-y-6">
      <Link href="/dashboard/admin/tenants" className="text-sm text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] font-medium inline-flex items-center gap-1">
        ← Back to Tenants
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${typeConfig.well}`}>
            <HeroIcon size={26} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-heading font-bold vi-text">{tenant.name}</h1>
              <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${typeConfig.color}`}>{typeConfig.label}</span>
              {isSuspended ? (
                <span className="px-2.5 py-0.5 text-xs rounded-full font-semibold bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]">Suspended</span>
              ) : (
                <span className="px-2.5 py-0.5 text-xs rounded-full font-semibold bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]">Active</span>
              )}
            </div>
            <p className="text-sm vi-text-muted mt-0.5">Created {new Date(tenant.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition"
          >
            Edit
          </button>
          <button
            onClick={handleToggleSuspend}
            disabled={suspending}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition disabled:opacity-50 ${
              isSuspended
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {suspending ? "..." : isSuspended ? "Unsuspend" : "Suspend"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-4">Tenant Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="vi-text-muted">ID</span>
              <span className="font-mono text-xs vi-text-muted">{tenant.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Type</span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${typeConfig.color}`}>{typeConfig.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Users</span>
              <span className="font-medium vi-text">{tenant.userCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Learners</span>
              <span className="font-medium vi-text">{tenant.learnerCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Updated</span>
              <span className="font-medium vi-text">{new Date(tenant.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-4">Settings</h3>
          <pre className="text-xs vi-text-muted vi-bg rounded-lg p-3 overflow-auto max-h-48 font-mono">
            {JSON.stringify(tenant.settings || {}, null, 2)}
          </pre>
        </div>

        {isSuspended && (
          <div className="bg-red-50 rounded-2xl shadow-sm border border-red-200 p-6">
            <h3 className="font-heading font-bold text-red-900 mb-4">Suspension Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-red-500">Suspended At</span>
                <span className="font-medium text-red-900">
                  {tenant.suspendedAt ? new Date(tenant.suspendedAt).toLocaleDateString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-red-500">Reason</span>
                <p className="mt-1 text-[hsl(var(--visual-math))] font-medium">{tenant.suspensionReason || "No reason provided"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg vi-text">Users</h2>
          <span className="text-sm vi-text-muted">{tenant.users.length} users</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {tenant.users.map((u) => (
              <tr key={u.id} className="border-b vi-border hover:vi-bg/50 transition">
                <td className="px-5 py-3">
                  <Link href={`/dashboard/admin/users/${u.id}`} className="font-medium text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))]">
                    {u.name}
                  </Link>
                </td>
                <td className="px-5 py-3 vi-text-muted">{u.email}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 text-xs rounded-full vi-surface-soft vi-text-muted font-medium">
                    {u.role.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-3 vi-text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {tenant.users.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-10 text-center vi-text-muted">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg vi-text">Learners</h2>
          <span className="text-sm vi-text-muted">{tenant.learners.length} learners</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Functioning Level</th>
              <th className="px-5 py-3 font-semibold">Grade</th>
              <th className="px-5 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {tenant.learners.map((l) => {
              const lc = LEVEL_CONFIG[l.functioningLevel || ""] || { label: "N/A", color: "vi-text-muted", bg: "vi-surface-soft" };
              return (
                <tr key={l.id} className="border-b vi-border hover:vi-bg/50 transition">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/admin/learners/${l.id}`} className="font-medium text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))]">
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${lc.bg} ${lc.color}`}>{lc.label}</span>
                  </td>
                  <td className="px-5 py-3 vi-text-muted">{l.gradeLevel || "—"}</td>
                  <td className="px-5 py-3 vi-text-muted">{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {tenant.learners.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-10 text-center vi-text-muted">No learners found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-heading font-bold vi-text">Edit Tenant</h2>
              <button onClick={() => setShowEdit(false)} className="vi-text-muted hover:vi-text-muted text-xl">×</button>
            </div>
            {saveError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{saveError}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium vi-text mb-1">Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border vi-border focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-settings" className="block text-sm font-medium vi-text mb-1">Settings (JSON)</label>
                <textarea
                  id="edit-settings"
                  value={editSettings}
                  onChange={(e) => setEditSettings(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2.5 rounded-lg border vi-border focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="px-4 py-2 rounded-xl border vi-border vi-text-muted font-semibold text-sm hover:vi-bg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
