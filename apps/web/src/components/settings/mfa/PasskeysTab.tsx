"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { startRegistration } from "@simplewebauthn/browser";

type Credential = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

type Props = {
  strongMfaEnabled: boolean;
  onChanged: () => void;
  onRecoveryCodes: (codes: string[]) => void;
};

export function PasskeysTab({ strongMfaEnabled, onChanged, onRecoveryCodes }: Props) {
  const { accessToken } = useAuth();
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const r = await fetch("/api/auth/mfa/webauthn/credentials", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = await r.json();
      if (r.ok) setCreds(d.credentials || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [accessToken]);

  const register = async () => {
    setErr("");
    setBusy(true);
    try {
      const optsRes = await fetch("/api/auth/mfa/webauthn/register/options", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const opts = await optsRes.json();
      if (!optsRes.ok) throw new Error(opts.error || "Failed to start passkey enrollment");
      const att = await startRegistration(opts.options);
      const verifyRes = await fetch("/api/auth/mfa/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          challengeToken: opts.challengeToken,
          response: att,
          label: navigator.platform || "Passkey",
        }),
      });
      const d = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(d.error || "Passkey verification failed");
      if (d.recoveryCodes && d.recoveryCodes.length) onRecoveryCodes(d.recoveryCodes);
      await load();
      onChanged();
    } catch (e: any) {
      setErr(e.message || "Could not register passkey");
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this passkey?")) return;
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/auth/mfa/webauthn/credentials/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) {
        const d = await r.json();
        setErr(d.error || "Could not remove passkey");
      } else {
        await load();
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const rename = async (id: string) => {
    if (!renameValue.trim()) {
      setRenaming(null);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/auth/mfa/webauthn/credentials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ label: renameValue.trim().slice(0, 120) }),
      });
      if (!r.ok) {
        const d = await r.json();
        setErr(d.error || "Rename failed");
      } else await load();
    } finally {
      setBusy(false);
      setRenaming(null);
      setRenameValue("");
    }
  };

  return (
    <div className="space-y-4">
      {!strongMfaEnabled && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Passkeys are not the default sign-in method until your administrator enables strong MFA.
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Passkeys are phishing-resistant — they only work on real AIVO domains and never leave your
          device.
        </p>
        <button
          onClick={register}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? "Working…" : "Add a passkey"}
        </button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading passkeys…</p>
      ) : creds.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">No passkeys yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {creds.map((c) => (
            <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {renaming === c.id ? (
                  <input
                    ref={(el) => {
                      el?.focus();
                    }}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename(c.id);
                      if (e.key === "Escape") {
                        setRenaming(null);
                        setRenameValue("");
                      }
                    }}
                    onBlur={() => rename(c.id)}
                    className="w-full px-2 py-1 text-sm rounded border border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setRenaming(c.id);
                      setRenameValue(c.label);
                    }}
                    className="text-left text-sm font-semibold text-slate-900 hover:text-violet-600 truncate block w-full"
                  >
                    {c.label}
                  </button>
                )}
                <p className="text-xs text-slate-500">
                  Added {new Date(c.createdAt).toLocaleDateString()}
                  {c.lastUsedAt && ` · Last used ${new Date(c.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => remove(c.id)}
                disabled={busy}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
