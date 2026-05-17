"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

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

const EDITABLE_ROLES = [
  "PLATFORM_ADMIN", "DISTRICT_ADMIN",
  "PARENT", "LEARNER", "TEACHER", "CAREGIVER", "THERAPIST",
  "SALES", "MARKETING", "CUSTOMER_CARE", "SUPPORT", "FINANCE", "DEVOPS",
];

interface Learner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
  createdAt: string;
}

interface Tenant {
  id: string;
  name: string;
  type: string;
}

interface UserDetail {
  id: string;
  name: string;
  email: string | null;
  role: string;
  tenantId: string | null;
  emailVerified: boolean;
  avatarUrl: string | null;
  hasGoogle: boolean;
  hasApple: boolean;
  deactivatedAt: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: Tenant | null;
  learners: Learner[];
  activeSessions: number;
}

export default function AdminUserDetailPage() {
  const { user: currentUser, accessToken, impersonate } = useAuth();
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [userData, setUserData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [resetResult, setResetResult] = useState<{ temporaryPassword: string; email: string } | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const [impersonating, setImpersonating] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadUser = () => {
    if (!accessToken || !userId) return;
    setLoading(true);
    fetch(`/api/admin-svc/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load user");
        return r.json();
      })
      .then((data) => {
        setUserData(data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUser();
  }, [accessToken, userId]);

  const handleEdit = () => {
    if (!userData) return;
    setEditName(userData.name || "");
    setEditEmail(userData.email || "");
    setEditRole(userData.role);
    setEditError("");
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSubmitting(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update user");
      }
      setShowEditModal(false);
      loadUser();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setResettingPassword(true);
    setActionError("");
    setResetResult(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset password");
      }
      const data = await res.json();
      setResetResult(data);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to deactivate user");
      }
      setShowDeactivateConfirm(false);
      loadUser();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to deactivate user");
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    setActionError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/reactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reactivate user");
      }
      loadUser();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to reactivate user");
    }
  };

  const handleImpersonate = async () => {
    if (!userData) return;
    setImpersonating(true);
    setActionError("");
    try {
      await impersonate(userId);
      router.push(ROLE_DASHBOARDS[userData.role] || "/");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Impersonation failed");
      setImpersonating(false);
    }
  };

  const isDeactivated = !!userData?.deactivatedAt;
  const canImpersonate = currentUser?.role === "PLATFORM_ADMIN" && currentUser?.id !== userId;

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center vi-text-muted animate-pulse py-20">Loading user details...</div>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="p-8 space-y-4">
        <Link href="/dashboard/admin/users" className="text-sm text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] font-medium">
          ← Back to Users
        </Link>
        <div className="bg-[hsl(var(--visual-math)/0.08)] border border-[hsl(var(--visual-math)/0.25)] text-[hsl(var(--visual-math))] px-4 py-3 rounded-xl text-sm">
          {error || "User not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {actionError && (
        <div className="fixed top-4 right-4 z-[9999] bg-[hsl(var(--visual-math)/0.08)] border border-[hsl(var(--visual-math)/0.25)] text-[hsl(var(--visual-math))] px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          {actionError}
        </div>
      )}

      {resetResult && (
        <div className="bg-[hsl(var(--visual-science)/0.08)] border border-[hsl(var(--visual-science)/0.25)] rounded-xl p-4 space-y-2">
          <p className="text-[hsl(var(--visual-science))] font-semibold">Password reset successfully!</p>
          <div className="text-sm space-y-1">
            <p className="text-[hsl(var(--visual-science))]">
              Email: <span className="font-mono font-semibold">{resetResult.email}</span>
            </p>
            <p className="text-[hsl(var(--visual-science))]">
              Temporary Password: <span className="font-mono font-semibold bg-[hsl(var(--visual-science)/0.14)] px-2 py-0.5 rounded select-all">{resetResult.temporaryPassword}</span>
            </p>
          </div>
          <p className="text-xs text-[hsl(var(--visual-science))] mt-2">
            Share these credentials securely. The user should change their password on first login.
          </p>
          <button
            onClick={() => setResetResult(null)}
            className="text-xs text-[hsl(var(--visual-science))] underline hover:text-[hsl(var(--visual-science))] mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      <Link href="/dashboard/admin/users" className="text-sm text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] font-medium inline-block">
        ← Back to Users
      </Link>

      <div className="vi-card p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--visual-primary))] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {userData.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-heading font-bold vi-text">{userData.name}</h1>
              <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${ROLE_COLORS[userData.role] || "vi-surface-soft vi-text-muted"}`}>
                {userData.role.replace(/_/g, " ")}
              </span>
              {isDeactivated ? (
                <span className="px-2.5 py-0.5 text-xs rounded-full font-semibold bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]">Deactivated</span>
              ) : (
                <span className="px-2.5 py-0.5 text-xs rounded-full font-semibold bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]">Active</span>
              )}
            </div>
            <p className="text-sm vi-text-muted mt-1">{userData.email || "No email"}</p>
            <div className="flex items-center gap-4 mt-2 text-xs vi-text-muted">
              {userData.lastLoginAt && (
                <span>Last login: {new Date(userData.lastLoginAt).toLocaleString()}</span>
              )}
              {userData.lastLoginIp && (
                <span>IP: {userData.lastLoginIp}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t vi-border">
          <button
            onClick={handleEdit}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition"
          >
            Edit
          </button>
          <button
            onClick={handleResetPassword}
            disabled={resettingPassword}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[hsl(var(--visual-sel)/0.10)] text-[hsl(var(--visual-sel))] border border-[hsl(var(--visual-sel)/0.30)] hover:bg-[hsl(var(--visual-sel)/0.18)] transition disabled:opacity-50"
          >
            {resettingPassword ? "Resetting..." : "Reset Password"}
          </button>
          {isDeactivated ? (
            <button
              onClick={handleReactivate}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-[hsl(var(--visual-science)/0.08)] text-[hsl(var(--visual-science))] border border-[hsl(var(--visual-science)/0.25)] hover:bg-[hsl(var(--visual-science)/0.16)] transition"
            >
              Reactivate
            </button>
          ) : (
            <button
              onClick={() => setShowDeactivateConfirm(true)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-[hsl(var(--visual-math)/0.08)] text-[hsl(var(--visual-math))] border border-[hsl(var(--visual-math)/0.25)] hover:bg-[hsl(var(--visual-math)/0.16)] transition"
            >
              Deactivate
            </button>
          )}
          {canImpersonate && (
            <button
              onClick={handleImpersonate}
              disabled={impersonating}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-[hsl(var(--visual-sel)/0.10)] text-[hsl(var(--visual-sel))] border border-[hsl(var(--visual-sel)/0.30)] hover:bg-[hsl(var(--visual-sel)/0.18)] transition disabled:opacity-50"
            >
              {impersonating ? "Switching..." : "Impersonate"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="vi-card p-6">
          <h2 className="text-sm font-semibold vi-text-muted uppercase tracking-wider mb-4">Account Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="vi-text-muted">Email</span>
              <span className="vi-text font-medium">{userData.email || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Role</span>
              <span className="vi-text font-medium">{userData.role.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Email Verified</span>
              <span className={`font-medium ${userData.emailVerified ? "text-[hsl(var(--visual-science))]" : "text-[hsl(var(--visual-math))]"}`}>
                {userData.emailVerified ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Google ID</span>
              <span className="vi-text font-medium truncate ml-2 max-w-[160px]">{userData.hasGoogle ? "Connected" : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Apple ID</span>
              <span className="vi-text font-medium truncate ml-2 max-w-[160px]">{userData.hasApple ? "Connected" : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Created</span>
              <span className="vi-text font-medium">{new Date(userData.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Updated</span>
              <span className="vi-text font-medium">{new Date(userData.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="vi-card p-6">
          <h2 className="text-sm font-semibold vi-text-muted uppercase tracking-wider mb-4">Tenant Info</h2>
          {userData.tenant ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="vi-text-muted">Name</span>
                <span className="vi-text font-medium">{userData.tenant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="vi-text-muted">Type</span>
                <span className="vi-text font-medium">{userData.tenant.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="vi-text-muted">ID</span>
                <span className="vi-text font-medium font-mono text-xs truncate ml-2 max-w-[160px]">{userData.tenant.id}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm vi-text-muted">No tenant assigned</p>
          )}
        </div>

        <div className="vi-card p-6">
          <h2 className="text-sm font-semibold vi-text-muted uppercase tracking-wider mb-4">Session Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="vi-text-muted">Active Sessions</span>
              <span className="vi-text font-bold text-lg">{userData.activeSessions}</span>
            </div>
          </div>
        </div>
      </div>

      {userData?.learners && userData.learners.length > 0 && (
        <div className="vi-card overflow-hidden">
          <div className="p-5 border-b vi-border">
            <h2 className="text-sm font-semibold vi-text-muted uppercase tracking-wider">Learners ({userData.learners.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Functioning Level</th>
                <th className="px-5 py-3 font-semibold">Grade Level</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(userData.learners ?? []).map((learner) => (
                <tr key={learner.id} className="border-b vi-border hover:vi-bg/50 transition">
                  <td className="px-5 py-3 font-medium vi-text">{learner.name}</td>
                  <td className="px-5 py-3 vi-text-muted">{learner.functioningLevel || "—"}</td>
                  <td className="px-5 py-3 vi-text-muted">{learner.gradeLevel || "—"}</td>
                  <td className="px-5 py-3 vi-text-muted">{new Date(learner.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/admin/learners/${learner.id}`}
                      className="text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] font-medium text-xs"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="p-6 border-b vi-border">
              <h2 className="text-lg font-heading font-bold vi-text">Edit User</h2>
              <p className="text-sm vi-text-muted mt-1">Update user information.</p>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="bg-[hsl(var(--visual-math)/0.08)] border border-[hsl(var(--visual-math)/0.25)] text-[hsl(var(--visual-math))] px-4 py-3 rounded-xl text-sm">
                  {editError}
                </div>
              )}
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium vi-text mb-1">Full Name</label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                />
              </div>
              <div>
                <label htmlFor="edit-email" className="block text-sm font-medium vi-text mb-1">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                />
              </div>
              <div>
                <label htmlFor="edit-role" className="block text-sm font-medium vi-text mb-1">Role</label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                >
                  {EDITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl border vi-border vi-text-muted font-semibold hover:vi-bg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowDeactivateConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-heading font-bold vi-text">Deactivate User</h2>
              <p className="text-sm vi-text-muted mt-2">
                Are you sure you want to deactivate <span className="font-semibold vi-text">{userData.name}</span>? They will no longer be able to log in.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDeactivateConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border vi-border vi-text-muted font-semibold hover:vi-bg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  className="flex-1 py-2.5 rounded-xl bg-[hsl(var(--visual-math))] text-white font-semibold hover:bg-[hsl(var(--visual-math)/0.85)] transition disabled:opacity-50"
                >
                  {deactivating ? "Deactivating..." : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
