"use client";
/**
 * District Administrators page (Sprint 8).
 *
 * Lets a DISTRICT_ADMIN invite peer admins, deactivate/reactivate them,
 * resend or revoke pending invites, and trigger a temporary-password
 * reset. Every mutation goes through `fetchWithStepUp` so the existing
 * StepUpModal kicks in for the `district:admin-mgmt` scope.
 */
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { fetchWithStepUp } from "@/lib/step-up";
import { Mail, ShieldCheck, ShieldAlert, UserPlus, Send, X, KeyRound, Power, Clock } from "lucide-react";

interface AdminRow {
  id: string;
  email: string;
  name: string;
  mfaEnabled: boolean;
  deactivatedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}
interface InviteRow {
  id: string;
  email: string;
  name: string;
  expiresAt: string;
  createdAt: string;
}

const purple = "hsl(var(--visual-primary))";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function DistrictAdminsPage() {
  const { accessToken } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [pending, setPending] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [tempPwd, setTempPwd] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const r = await fetch("/api/district/admins", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!r.ok) throw new Error("Failed to load administrators");
      const data = await r.json();
      setAdmins(data.admins || []);
      setPending(data.pendingInvites || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const doMutation = useCallback(async (label: string, url: string, init: RequestInit = {}) => {
    if (!accessToken) return;
    setBusy(label); setError(null);
    try {
      const r = await fetchWithStepUp(url, { ...init, accessToken });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Request failed");
      return data;
    } catch (e: any) {
      setError(e?.message || "Request failed");
    } finally { setBusy(null); await load(); }
  }, [accessToken, load]);

  const onResetPassword = async (admin: AdminRow) => {
    if (!confirm(`Generate a temporary password for ${admin.email}? They will be required to change it on next login.`)) return;
    const data = await doMutation(`reset-${admin.id}`, `/api/district/admins/${admin.id}/reset-password`, { method: "POST" });
    if (data?.tempPassword) setTempPwd({ email: admin.email, password: data.tempPassword });
  };

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--visual-primary))]">District Administrators</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Manage who can administer your district on AIVO. Every change here is recorded in the activity log and requires step-up verification.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm"
          style={{ backgroundColor: purple }}
        >
          <UserPlus className="w-4 h-4" /> Invite admin
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending invitations ({pending.length})
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Name / Email</th>
                  <th className="text-left px-4 py-2">Sent</th>
                  <th className="text-left px-4 py-2">Expires</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-gray-500 text-xs">{p.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmt(p.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(p.expiresAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy === `resend-${p.id}`}
                        onClick={() => doMutation(`resend-${p.id}`, `/api/district/admins/invites/${p.id}/resend`, { method: "POST" })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded-md mr-2"
                      >
                        <Send className="w-3 h-3" /> Resend
                      </button>
                      <button
                        type="button"
                        disabled={busy === `revoke-${p.id}`}
                        onClick={() => doMutation(`revoke-${p.id}`, `/api/district/admins/invites/${p.id}`, { method: "DELETE" })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <X className="w-3 h-3" /> Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Active admins */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Administrators ({admins.length})</h2>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Name / Email</th>
                <th className="text-left px-4 py-2">MFA</th>
                <th className="text-left px-4 py-2">Last login</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>)}
              {!loading && admins.length === 0 && (<tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No administrators yet. Invite the first one.</td></tr>)}
              {admins.map((a) => {
                const inactive = !!a.deactivatedAt;
                return (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{a.name}</div>
                      <div className="text-gray-500 text-xs">{a.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {a.mfaEnabled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" /> Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-medium">
                          <ShieldAlert className="w-3.5 h-3.5" /> Not enrolled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmt(a.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      {inactive
                        ? <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">Deactivated</span>
                        : <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy === `reset-${a.id}` || inactive}
                        onClick={() => onResetPassword(a)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded-md mr-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <KeyRound className="w-3 h-3" /> Reset password
                      </button>
                      {inactive ? (
                        <button
                          type="button"
                          disabled={busy === `react-${a.id}`}
                          onClick={() => doMutation(`react-${a.id}`, `/api/district/admins/${a.id}/reactivate`, { method: "POST" })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-md"
                        >
                          <Power className="w-3 h-3" /> Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === `deact-${a.id}`}
                          onClick={() => {
                            if (!confirm(`Deactivate ${a.email}? They will lose access immediately.`)) return;
                            return doMutation(`deact-${a.id}`, `/api/district/admins/${a.id}/deactivate`, { method: "POST" });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md"
                        >
                          <Power className="w-3 h-3" /> Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showInvite && (
        <InviteModal
          accessToken={accessToken!}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); void load(); }}
        />
      )}

      {tempPwd && (
        <TempPasswordModal email={tempPwd.email} password={tempPwd.password} onClose={() => setTempPwd(null)} />
      )}
    </div>
  );
}

function InviteModal({ accessToken, onClose, onInvited }: { accessToken: string; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setErr(null);
    try {
      const r = await fetchWithStepUp("/api/district/admins", {
        method: "POST", accessToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Invite failed");
      onInvited();
    } catch (e: any) {
      setErr(e?.message || "Invite failed");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Mail className="w-5 h-5 text-purple-600" /> Invite a district administrator
        </h3>
        <p className="text-sm text-gray-600 mb-4">They'll receive an email with a link that expires in 72 hours.</p>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          <span>Full name</span>
          <input
            required value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full mb-3 rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Jane Doe"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          <span>Email</span>
          <input
            required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full mb-4 rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="jane@district.org"
          />
        </label>
        {err && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md text-gray-700 hover:bg-gray-100">Cancel</button>
          <button
            type="submit" disabled={submitting}
            className="px-4 py-2 text-sm rounded-md text-white font-semibold disabled:opacity-50"
            style={{ backgroundColor: purple }}
          >
            {submitting ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TempPasswordModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-amber-600" /> Temporary password generated
        </h3>
        <p className="text-sm text-gray-700 mb-3">
          Share this one-time password with <strong>{email}</strong> over a secure channel. They will be required to change it on next login.
        </p>
        <div className="flex items-center gap-2 mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-sm break-all">
          {password}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={async () => { await navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md text-white font-semibold" style={{ backgroundColor: purple }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
