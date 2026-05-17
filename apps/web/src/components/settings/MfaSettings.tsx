"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { AuthenticatorTab } from "./mfa/AuthenticatorTab";
import { PasskeysTab } from "./mfa/PasskeysTab";
import { RecoveryCodesTab } from "./mfa/RecoveryCodesTab";

type Tab = "authenticator" | "passkeys" | "recovery";

type MfaStatus = {
  mfaEnabled: boolean;
  mfaForced: boolean;
  mfaMethod: "email" | "totp" | "webauthn" | null;
  webauthnCount: number;
  recoveryRemaining: number;
  strongMfaEnabled: boolean;
};

const TAB_LABELS: Record<Tab, string> = {
  authenticator: "Authenticator app",
  passkeys: "Passkeys",
  recovery: "Recovery codes",
};

export function MfaSettings(_props: { accentColor?: string } = {}) {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("authenticator");
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [pendingCodes, setPendingCodes] = useState<string[] | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const r = await fetch("/api/auth/mfa/status", { headers: { Authorization: `Bearer ${accessToken}` } });
      const d = await r.json();
      if (r.ok) {
        setStatus({
          mfaEnabled: !!d.mfaEnabled,
          mfaForced: !!d.mfaForced,
          mfaMethod: d.mfaMethod ?? null,
          webauthnCount: d.webauthnCount ?? 0,
          recoveryRemaining: d.recoveryRemaining ?? 0,
          strongMfaEnabled: !!d.strongMfaEnabled,
        });
      }
    } catch {}
  }, [accessToken]);

  useEffect(() => { refresh(); }, [refresh]);

  const onRecoveryCodes = (codes: string[]) => {
    setPendingCodes(codes);
    setTab("recovery");
  };

  const activeMethod = status?.mfaMethod ?? "email";
  const methodLabel =
    activeMethod === "webauthn" ? "Passkey" :
    activeMethod === "totp" ? "Authenticator app" :
    status?.mfaEnabled ? "Email code" : "Off";
  const methodTone =
    !status?.mfaEnabled ? "bg-slate-100 text-slate-500" :
    activeMethod === "webauthn" ? "bg-emerald-100 text-emerald-700" :
    activeMethod === "totp" ? "bg-violet-100 text-violet-700" :
    "bg-amber-100 text-amber-700";

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h2 className="font-heading font-bold text-lg text-slate-900">Two-factor authentication</h2>
          <p className="text-sm text-slate-500">Protect your account with a second factor at sign-in.</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${methodTone}`}>
          {methodLabel}
        </span>
      </div>

      {status?.mfaForced && (
        <div role="note" className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs font-semibold">Two-factor authentication is required for your role and cannot be turned off.</p>
        </div>
      )}

      <div role="tablist" aria-label="MFA settings" className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${
              tab === t
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {TAB_LABELS[t]}
            {t === "passkeys" && status && status.webauthnCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">{status.webauthnCount}</span>
            )}
            {t === "recovery" && status && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">{status.recoveryRemaining}</span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "authenticator" && (
          <AuthenticatorTab
            active={activeMethod === "totp"}
            onChanged={refresh}
            onRecoveryCodes={onRecoveryCodes}
          />
        )}
        {tab === "passkeys" && (
          <PasskeysTab
            strongMfaEnabled={!!status?.strongMfaEnabled}
            onChanged={refresh}
            onRecoveryCodes={onRecoveryCodes}
          />
        )}
        {tab === "recovery" && (
          <RecoveryCodesTab
            injectedCodes={pendingCodes}
            onCodesShown={() => setPendingCodes(null)}
          />
        )}
      </div>
    </div>
  );
}
