"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";

type Props = {
  injectedCodes: string[] | null;
  onCodesShown: () => void;
};

export function RecoveryCodesTab({ injectedCodes, onCodesShown }: Props) {
  const { accessToken } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const loadStatus = async () => {
    try {
      const r = await fetch("/api/auth/mfa/recovery/status", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = await r.json();
      if (r.ok) setRemaining(d.remaining ?? 0);
    } catch {}
  };

  useEffect(() => {
    if (accessToken) loadStatus();
  }, [accessToken]);

  useEffect(() => {
    if (injectedCodes && injectedCodes.length) {
      setCodes(injectedCodes);
      setRemaining(injectedCodes.length);
      onCodesShown();
    }
  }, [injectedCodes, onCodesShown]);

  const regenerate = async () => {
    if (!password) return;
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/mfa/recovery/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Could not regenerate codes");
      else {
        setCodes(d.recoveryCodes || []);
        setRemaining((d.recoveryCodes || []).length);
        setPassword("");
        setShowPwForm(false);
      }
    } catch {
      setErr("Network error");
    }
    setBusy(false);
  };

  const copyAll = () => {
    if (!codes) return;
    navigator.clipboard.writeText(codes.join("\n")).catch(() => {});
  };

  const downloadTxt = () => {
    if (!codes) return;
    const blob = new Blob([codes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aivo-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Single-use recovery codes let you sign in if you lose your authenticator or passkey.
        </p>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 whitespace-nowrap">
          {remaining ?? "—"} remaining
        </span>
      </div>

      {codes ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold">
            Save these now — they will not be shown again.
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-sm">
            {codes.map((c, i) => (
              <div key={i} className="tracking-widest">
                {c}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyAll}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Copy all
            </button>
            <button
              onClick={downloadTxt}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download .txt
            </button>
            <button
              onClick={() => setCodes(null)}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700"
            >
              I've saved them
            </button>
          </div>
        </div>
      ) : showPwForm ? (
        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm your password"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={regenerate}
              disabled={busy || !password}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate new codes"}
            </button>
            <button
              onClick={() => {
                setShowPwForm(false);
                setPassword("");
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      ) : (
        <button
          onClick={() => setShowPwForm(true)}
          className="px-5 py-2.5 rounded-xl border border-violet-200 text-violet-700 text-sm font-bold hover:bg-violet-50"
        >
          Generate new recovery codes
        </button>
      )}
    </div>
  );
}
