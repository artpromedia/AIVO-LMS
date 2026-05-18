"use client";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";

type Props = {
  active: boolean;
  onChanged: () => void;
  onRecoveryCodes: (codes: string[]) => void;
};

export function AuthenticatorTab({ active, onChanged, onRecoveryCodes }: Props) {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [enroll, setEnroll] = useState<{
    enrollToken: string;
    otpauthUrl: string;
    base32Secret: string;
    qrDataUrl: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  const start = async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/mfa/totp/enroll", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "Failed to start enrollment");
      } else setEnroll(d);
    } catch {
      setErr("Network error");
    }
    setLoading(false);
  };

  const confirm = async () => {
    if (!enroll || code.length !== 6) return;
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/mfa/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ enrollToken: enroll.enrollToken, code }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "Invalid code");
        setCode("");
      } else {
        onRecoveryCodes(d.recoveryCodes || []);
        setEnroll(null);
        setCode("");
        onChanged();
      }
    } catch {
      setErr("Network error");
    }
    setLoading(false);
  };

  const disable = async () => {
    if (!disablePassword) return;
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/mfa/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ password: disablePassword }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Failed to disable");
      else {
        setShowDisableForm(false);
        setDisablePassword("");
        onChanged();
      }
    } catch {
      setErr("Network error");
    }
    setLoading(false);
  };

  if (active) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="text-emerald-700 text-sm font-semibold">
            Authenticator app is active
          </span>
        </div>
        <p className="text-sm text-slate-600">
          You'll be prompted for a 6-digit code from your authenticator app at sign-in.
        </p>
        {showDisableForm ? (
          <div className="space-y-3">
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={disable}
                disabled={loading || !disablePassword}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Removing…" : "Remove authenticator"}
              </button>
              <button
                onClick={() => {
                  setShowDisableForm(false);
                  setDisablePassword("");
                  setErr("");
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDisableForm(true)}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
          >
            Remove authenticator
          </button>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    );
  }

  if (!enroll) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Use an app like 1Password, Authy, or Google Authenticator. Codes never travel by email.
        </p>
        <button
          onClick={start}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "Starting…" : "Set up authenticator"}
        </button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {enroll.qrDataUrl && (
          <img
            src={enroll.qrDataUrl}
            alt="TOTP QR code"
            className="w-48 h-48 rounded-lg border border-slate-200 bg-white p-2"
          />
        )}
        <div className="flex-1 space-y-2">
          <p className="text-sm text-slate-600">
            Scan the QR with your authenticator app, then enter the 6-digit code below.
          </p>
          <button
            type="button"
            onClick={() => setShowSecret((s) => !s)}
            className="text-xs text-violet-600 underline"
          >
            {showSecret ? "Hide" : "Show"} setup key
          </button>
          {showSecret && (
            <code className="block break-all p-2 rounded bg-slate-50 border border-slate-200 text-xs font-mono">
              {enroll.base32Secret}
            </code>
          )}
        </div>
      </div>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="w-full text-center text-2xl tracking-[0.5em] font-bold px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
      />
      <div className="flex gap-3">
        <button
          onClick={confirm}
          disabled={loading || code.length !== 6}
          className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Confirm"}
        </button>
        <button
          onClick={() => {
            setEnroll(null);
            setCode("");
          }}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
