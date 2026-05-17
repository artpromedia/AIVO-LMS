/**
 * Sprint 6: District SSO + SCIM settings.
 *
 * District admins use this page to configure SAML SSO with their IdP and
 * to issue SCIM bearer tokens for automatic user provisioning. Sensitive
 * fields (IdP cert, SP private key) are stored encrypted server-side.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { ShieldCheck, KeyRound, Plus, Trash2 } from "lucide-react";

const PRESETS = [
  { value: "azure", label: "Microsoft Entra ID" },
  { value: "google", label: "Google Workspace" },
  { value: "okta", label: "Okta" },
  { value: "onelogin", label: "OneLogin" },
  { value: "custom", label: "Custom SAML 2.0 IdP" },
];

const PROVISIONABLE_ROLES = ["DISTRICT_ADMIN", "TEACHER", "CAREGIVER", "THERAPIST"];

interface SsoConfig {
  enabled: boolean;
  idpLabel?: string;
  emailDomains?: string[];
  requireSso?: boolean;
  entryPoint?: string;
  logoutUrl?: string;
  issuer?: string;
  identifierFormat?: string;
  emailAttribute?: string;
  nameAttribute?: string;
  roleAttribute?: string;
  defaultRole?: string;
  roleMap?: Record<string, string>;
  // Write-only fields the API surfaces only as `*Set` booleans on read.
  idpCert?: string;
  spPrivateKey?: string;
  idpCertSet?: boolean;
  spPrivateKeySet?: boolean;
}

interface ScimToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export default function SsoSettingsPage() {
  const { accessToken, user } = useAuth();
  const [config, setConfig] = useState<SsoConfig>({ enabled: false });
  const [preset, setPreset] = useState("azure");
  const [emailDomainsRaw, setEmailDomainsRaw] = useState("");
  const [roleMapRaw, setRoleMapRaw] = useState("");
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const tenantId = user?.tenantId;
  const metadataUrl = tenantId ? `/api/sso/saml/${encodeURIComponent(tenantId)}/metadata` : "";
  const acsUrl = tenantId ? `/api/sso/saml/${encodeURIComponent(tenantId)}/acs` : "";

  const fetchAll = useCallback(async () => {
    try {
      const [cfgRes, tokRes] = await Promise.all([
        fetch("/api/district/sso", { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch("/api/admin-svc/scim-tokens", { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setConfig(cfg.config || { enabled: false });
        setEmailDomainsRaw((cfg.config?.emailDomains || []).join(", "));
        setRoleMapRaw(Object.entries(cfg.config?.roleMap || {})
          .map(([k, v]) => `${k}=${v}`).join("\n"));
      }
      if (tokRes.ok) {
        const t = await tokRes.json();
        setTokens(t.tokens || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [accessToken]);

  useEffect(() => { if (accessToken) fetchAll(); }, [accessToken, fetchAll]);

  const saveConfig = async () => {
    setSaving(true); setMessage(null);
    try {
      const emailDomains = emailDomainsRaw.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const roleMap: Record<string, string> = {};
      for (const line of roleMapRaw.split("\n")) {
        const [k, v] = line.split("=").map((s) => s.trim());
        if (k && v) roleMap[k] = v;
      }
      const body = { ...config, emailDomains, roleMap, preset };
      const res = await fetch("/api/district/sso", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setMessage({ kind: "ok", text: "SSO configuration saved" });
      // Don't echo back the cert/key — fetch fresh.
      await fetchAll();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const issueToken = async () => {
    if (!newTokenName) return;
    setCreatedToken(null);
    try {
      const res = await fetch("/api/admin-svc/scim-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: newTokenName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCreatedToken(data.plaintext);
      setNewTokenName("");
      await fetchAll();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Could not issue token" });
    }
  };

  const revokeToken = async (id: string) => {
    if (!confirm("Revoke this SCIM token? Your IdP will lose provisioning access immediately.")) return;
    await fetch(`/api/admin-svc/scim-tokens/${id}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await fetchAll();
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/dashboard/district/settings" className="hover:text-violet-700 transition">Settings</Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Single Sign-On</span>
      </div>

      <header className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
          <ShieldCheck size={28} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Single Sign-On &amp; SCIM</h1>
          <p className="text-sm text-slate-500 mt-1">Connect your identity provider so staff sign in with their work credentials.</p>
        </div>
      </header>

      {message && (
        <p className={`text-sm rounded-lg px-3 py-2 ${
          message.kind === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>{message.text}</p>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <h2 className="text-lg font-heading font-bold text-slate-900">SAML 2.0 IdP</h2>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={!!config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="rounded text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm font-medium text-slate-900">SSO enabled</span>
        </label>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="sso-preset">IdP type</label>
          <select id="sso-preset" value={preset} onChange={(e) => setPreset(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="sso-domains">Email domains owned by your district</label>
          <input id="sso-domains" type="text" value={emailDomainsRaw} onChange={(e) => setEmailDomainsRaw(e.target.value)}
            placeholder="example.org, schools.example.org"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" />
          <p className="mt-1 text-xs text-slate-500">When users enter emails on these domains, they&apos;re sent to your IdP.</p>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={!!config.requireSso}
            onChange={(e) => setConfig({ ...config, requireSso: e.target.checked })}
            className="rounded text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm font-medium text-slate-900">Require SSO (block password login for these domains)</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="sso-entry">SSO entry point (IdP redirect URL)</label>
            <input id="sso-entry" type="url" value={config.entryPoint || ""}
              onChange={(e) => setConfig({ ...config, entryPoint: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="sso-logout">SLO URL (optional)</label>
            <input id="sso-logout" type="url" value={config.logoutUrl || ""}
              onChange={(e) => setConfig({ ...config, logoutUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="sso-cert">IdP signing certificate (PEM)</label>
          <textarea id="sso-cert" rows={6} value={config.idpCert || ""}
            onChange={(e) => setConfig({ ...config, idpCert: e.target.value })}
            placeholder={config.idpCertSet ? "(stored — paste a new cert to replace)" : "-----BEGIN CERTIFICATE-----\n..."}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono" />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">Advanced: attribute mapping</summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1" htmlFor="email-attr">Email attribute</label>
              <input id="email-attr" value={config.emailAttribute || ""}
                onChange={(e) => setConfig({ ...config, emailAttribute: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1" htmlFor="name-attr">Name attribute</label>
              <input id="name-attr" value={config.nameAttribute || ""}
                onChange={(e) => setConfig({ ...config, nameAttribute: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1" htmlFor="role-attr">Role attribute</label>
              <input id="role-attr" value={config.roleAttribute || ""}
                onChange={(e) => setConfig({ ...config, roleAttribute: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-slate-600 mb-1" htmlFor="role-map">Role map (one per line, idp_value=AIVO_ROLE)</label>
            <textarea id="role-map" rows={4} value={roleMapRaw} onChange={(e) => setRoleMapRaw(e.target.value)}
              placeholder="aivo-admin=DISTRICT_ADMIN&#10;aivo-teacher=TEACHER"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono" />
            <p className="mt-1 text-xs text-slate-500">
              Allowed AIVO roles: {PROVISIONABLE_ROLES.join(", ")}.
            </p>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-slate-600 mb-1" htmlFor="default-role">Default role (when no mapping matches)</label>
            <select id="default-role" value={config.defaultRole || "TEACHER"}
              onChange={(e) => setConfig({ ...config, defaultRole: e.target.value })}
              className="w-full md:w-auto px-3 py-2 rounded-lg border border-slate-200 text-sm">
              {PROVISIONABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </details>

        <div className="flex gap-3 pt-2">
          <button onClick={saveConfig} disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-violet-700 text-white font-bold text-sm hover:bg-violet-800 transition disabled:opacity-50">
            {saving ? "Saving..." : "Save SSO configuration"}
          </button>
          {tenantId && (
            <a href={metadataUrl} target="_blank" rel="noreferrer"
              className="px-5 py-2.5 rounded-xl border border-violet-200 text-violet-700 font-semibold text-sm hover:bg-violet-50 transition">
              Download SP metadata
            </a>
          )}
        </div>

        {tenantId && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
            <p><strong>ACS URL:</strong> <code className="break-all">{acsUrl}</code></p>
            <p><strong>Entity ID:</strong> <code>aivo:sp:{tenantId}</code></p>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <KeyRound size={20} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-bold text-slate-900">SCIM provisioning tokens</h2>
              <p className="text-xs text-slate-500">Use one of these tokens as the bearer secret in your IdP&apos;s SCIM configuration.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder="Token name (e.g. Okta Production)"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <button onClick={issueToken} disabled={!newTokenName}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition disabled:opacity-50 flex items-center gap-2">
            <Plus size={16} aria-hidden="true" /> Issue token
          </button>
        </div>

        {createdToken && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-sm font-bold text-emerald-800 mb-1">Token created — store it now</p>
            <p className="text-xs text-emerald-700 mb-2">This is the only time the full value is shown.</p>
            <div className="bg-white border border-emerald-300 rounded-lg px-3 py-2 font-mono text-xs break-all select-all">{createdToken}</div>
            <button onClick={() => setCreatedToken(null)}
              className="mt-3 text-xs font-semibold text-emerald-700 hover:underline">Done</button>
          </div>
        )}

        {tokens.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No SCIM tokens issued yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 font-semibold">Name</th>
                <th className="py-2 font-semibold">Prefix</th>
                <th className="py-2 font-semibold">Last used</th>
                <th className="py-2 font-semibold">Status</th>
                <th className="py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium">{t.name}</td>
                  <td className="py-2 font-mono text-xs">{t.prefix}…</td>
                  <td className="py-2 text-slate-500 text-xs">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "Never"}</td>
                  <td className="py-2 text-xs">
                    {t.revokedAt ? <span className="text-red-600">Revoked</span> : <span className="text-emerald-600">Active</span>}
                  </td>
                  <td className="py-2 text-right">
                    {!t.revokedAt && (
                      <button onClick={() => revokeToken(t.id)}
                        className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 ml-auto">
                        <Trash2 size={14} aria-hidden="true" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
