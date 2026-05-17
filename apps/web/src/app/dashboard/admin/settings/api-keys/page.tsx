"use client";
import { useAuth } from "@/providers/auth-provider";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { IconWell } from "@/components/discovery/_vi";
import { KeyRound, Plus, RotateCw, Trash2, AlertTriangle } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  rotatedFromId: string | null;
  gracePeriodEndsAt: string | null;
  createdAt: string;
}

const AVAILABLE_SCOPES = [
  "read:users", "write:users",
  "read:learners", "write:learners",
  "read:tenants", "write:tenants",
  "read:sessions", "read:assessments",
  "read:billing", "admin:full",
];

export default function ApiKeysPage() {
  const { accessToken } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>([]);
  const [newExpiry, setNewExpiry] = useState<number | "">(90);
  const [createdKey, setCreatedKey] = useState<{ plain: string; warning: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin-svc/api-keys", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { if (accessToken) load(); }, [accessToken, load]);

  const toggleScope = (scope: string) => {
    setNewScopes(newScopes.includes(scope) ? newScopes.filter((s) => s !== scope) : [...newScopes, scope]);
  };

  const handleCreate = async () => {
    if (!newName || newScopes.length === 0) return;
    setError(null);
    try {
      const res = await fetch("/api/admin-svc/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: newName, scopes: newScopes, expiresInDays: newExpiry || 90 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      setCreatedKey({ plain: data.plaintext, warning: data.warning });
      setNewName(""); setNewScopes([]); setNewExpiry(90); setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const handleRotate = async (id: string) => {
    if (!confirm("Rotate this key? The old key will continue working for 24 hours during overlap.")) return;
    try {
      const res = await fetch(`/api/admin-svc/api-keys/${id}/rotate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rotate failed");
      setCreatedKey({ plain: data.plaintext, warning: data.warning });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rotate failed");
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this key immediately? Any caller using it will start receiving 401.")) return;
    try {
      const res = await fetch(`/api/admin-svc/api-keys/${id}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Revoke failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    }
  };

  const status = (k: ApiKey): { label: string; tone: string } => {
    if (k.revokedAt) return { label: "Revoked", tone: "text-red-600 bg-red-50" };
    if (k.expiresAt && new Date(k.expiresAt) < new Date()) return { label: "Expired", tone: "text-slate-500 bg-slate-100" };
    if (k.gracePeriodEndsAt && new Date(k.gracePeriodEndsAt) > new Date() && k.rotatedFromId === null) {
      return { label: "Grace period", tone: "text-amber-700 bg-amber-50" };
    }
    return { label: "Active", tone: "text-emerald-700 bg-emerald-50" };
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm vi-text-muted">
        <Link href="/dashboard/admin/settings" className="hover:text-[hsl(var(--visual-primary))] transition">Settings</Link>
        <span>/</span>
        <span className="vi-text font-medium">API Keys</span>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="reading">
            <KeyRound size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">API Keys</h1>
            <p className="text-sm vi-text-muted mt-1">Manage API keys for programmatic access. Keys are hashed with argon2id and shown only once.</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreatedKey(null); }}
          className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition flex items-center gap-2"
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
          Generate Key
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {createdKey && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <p className="text-emerald-800 font-semibold mb-2">API key created</p>
          <p className="text-sm text-emerald-700 mb-3">{createdKey.warning}</p>
          <div className="bg-white border border-green-300 rounded-xl px-4 py-3 font-mono text-sm select-all break-all">{createdKey.plain}</div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-3 px-4 py-2 text-sm font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 transition"
          >Done</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm vi-text-muted">Loading...</p>
      ) : keys.length === 0 && !showCreate ? (
        <div className="vi-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]">
            <KeyRound size={28} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <p className="text-lg font-semibold vi-text">No API keys</p>
          <p className="text-sm vi-text-muted mt-1">Generate an API key to start using the AIVO REST API.</p>
        </div>
      ) : (
        <div className="vi-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Key</th>
                <th className="px-5 py-3 font-semibold">Scopes</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Expires</th>
                <th className="px-5 py-3 font-semibold">Last used</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const s = status(k);
                return (
                  <tr key={k.id} className="border-b vi-border hover:vi-bg/50 transition">
                    <td className="px-5 py-3 font-medium vi-text">{k.name}</td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs vi-surface-soft px-2 py-1 rounded">{k.keyPrefix}…</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.slice(0, 3).map((sc) => (
                          <span key={sc} className="text-xs vi-surface-soft text-[hsl(var(--visual-primary))] px-2 py-0.5 rounded-full">{sc}</span>
                        ))}
                        {k.scopes.length > 3 && <span className="text-xs vi-surface-soft vi-text-muted px-2 py-0.5 rounded-full">+{k.scopes.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.tone}`}>{s.label}</span>
                    </td>
                    <td className="px-5 py-3 vi-text-muted text-xs">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "Never"}</td>
                    <td className="px-5 py-3 vi-text-muted text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        {!k.revokedAt && (
                          <>
                            <button onClick={() => handleRotate(k.id)}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition flex items-center gap-1"
                              title="Rotate (24h grace overlap)">
                              <RotateCw size={12} aria-hidden="true" /> Rotate
                            </button>
                            <button onClick={() => handleRevoke(k.id)}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition flex items-center gap-1">
                              <Trash2 size={12} aria-hidden="true" /> Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && !createdKey && (
        <div className="vi-card p-6 space-y-4">
          <h2 className="text-lg font-heading font-bold vi-text">Generate New API Key</h2>
          <div>
            <label htmlFor="key-name" className="block text-sm font-medium vi-text mb-1">Key Name</label>
            <input id="key-name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Production Integration"
              className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none" />
          </div>
          <div>
            <label htmlFor="key-expiry" className="block text-sm font-medium vi-text mb-1">Expires in (days, max 365)</label>
            <input id="key-expiry" type="number" value={newExpiry} min={1} max={365}
              onChange={(e) => setNewExpiry(e.target.value === "" ? "" : Math.max(1, Math.min(365, parseInt(e.target.value, 10))))}
              className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none" />
          </div>
          <div>
            <p className="text-sm font-medium vi-text mb-2">Scopes</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 cursor-pointer" htmlFor={`scope-${scope}`}>
                  <input id={`scope-${scope}`} type="checkbox" checked={newScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="rounded border-slate-300 text-[hsl(var(--visual-primary))] focus:ring-purple-500" />
                  <span className="text-sm vi-text">{scope}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border vi-border vi-text-muted font-semibold hover:vi-bg transition">Cancel</button>
            <button onClick={handleCreate} disabled={!newName || newScopes.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-50">
              Generate Key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
