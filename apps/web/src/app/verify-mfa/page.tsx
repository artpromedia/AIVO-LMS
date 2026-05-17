"use client";
import { Suspense, useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";

type MfaMethod = "email" | "totp" | "webauthn";

function decodeMethodFromJwt(token: string): MfaMethod | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = JSON.parse(atob(b64));
    const m = json.mfaMethod;
    if (m === "totp" || m === "webauthn" || m === "email") return m;
    return null;
  } catch { return null; }
}

export default function VerifyMfaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50">
        <div className="animate-spin w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full" />
      </div>
    }>
      <VerifyMfaContent />
    </Suspense>
  );
}

function VerifyMfaContent() {
  const { applySession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("mfa");

  const mfaToken = searchParams.get("token") || "";
  const returnTo = searchParams.get("returnTo") || "/";
  const urlMethod = searchParams.get("method");
  const initialMethod = useMemo<MfaMethod>(() => {
    // Trust the URL hint first (set by the login page from the API response).
    // Fall back to a robust JWT decode. Only default to "email" when both are
    // missing AND no method was hinted — this avoids stranding WebAuthn / TOTP
    // users on an email-OTP screen when the JWT decode happens to fail.
    if (urlMethod === "totp" || urlMethod === "webauthn" || urlMethod === "email") return urlMethod;
    const fromJwt = decodeMethodFromJwt(mfaToken);
    return fromJwt ?? "email";
  }, [mfaToken, urlMethod]);

  const [mode, setMode] = useState<MfaMethod | "recovery">(initialMethod);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [mode]);

  const submitCode = async (raw: string) => {
    if (!raw) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code: raw }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("verification_failed"));
        if (mode === "recovery") setRecovery("");
        else setCode("");
      } else {
        if (data.user && data.accessToken) {
          applySession({ user: data.user, accessToken: data.accessToken });
        }
        router.push(returnTo);
      }
    } catch {
      setError(t("verification_failed"));
    }
    setLoading(false);
  };

  // Auto-submit when a 6-digit code is complete (TOTP / email). We track the
  // last code we already submitted so re-renders that re-create submitCode
  // don't cause duplicate POSTs, and we don't need to memoize submitCode.
  const lastSubmittedRef = useRef<string>("");
  useEffect(() => {
    if (
      (mode === "email" || mode === "totp") &&
      code.length === 6 &&
      !loading &&
      lastSubmittedRef.current !== code
    ) {
      lastSubmittedRef.current = code;
      submitCode(code);
    }
  }, [code, mode, loading, submitCode]);

  const runWebAuthn = async () => {
    setError(""); setInfo(""); setLoading(true);
    try {
      const optsRes = await fetch("/api/auth/mfa/webauthn/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken }),
      });
      const opts = await optsRes.json();
      if (!optsRes.ok) throw new Error(opts.error || "Could not start passkey sign-in");
      const assertion = await startAuthentication(opts.options);
      const verifyRes = await fetch("/api/auth/mfa/webauthn/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, challengeToken: opts.challengeToken, response: assertion }),
        credentials: "include",
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error || "Passkey verification failed");
      if (data.user && data.accessToken) {
        applySession({ user: data.user, accessToken: data.accessToken });
      }
      router.push(returnTo);
    } catch (e: any) {
      setError(e.message || "Passkey sign-in failed");
    }
    setLoading(false);
  };

  // Auto-prompt the platform passkey UI when user lands on a webauthn challenge.
  const triedAutoRef = useRef(false);
  useEffect(() => {
    if (mode === "webauthn" && !triedAutoRef.current) {
      triedAutoRef.current = true;
      runWebAuthn();
    }
  }, [mode, runWebAuthn]);

  const handleResend = async () => {
    if (resendCooldown > 0 || mode !== "email") return;
    setResending(true); setInfo(""); setError("");
    try {
      const res = await fetch("/api/auth/mfa/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setInfo(t("code_resent"));
        setCode("");
        setResendCooldown(30);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => setResendCooldown(v => { if (v <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); cooldownRef.current = null; return 0; } return v - 1; }), 1000);
      } else {
        setError(data.error || t("resend_failed"));
      }
    } catch { setError(t("resend_failed")); }
    setResending(false);
  };

  if (!mfaToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-gray-600">{t("session_expired")}</p>
          <Link href="/login" className="text-violet-600 font-bold hover:underline">{t("back_to_login")}</Link>
        </div>
      </div>
    );
  }

  const heading =
    mode === "webauthn" ? "Use your passkey" :
    mode === "totp" ? "Enter authenticator code" :
    mode === "recovery" ? "Enter a recovery code" :
    t("check_email");
  const subtitle =
    mode === "webauthn" ? "Confirm the prompt on your device to finish signing in." :
    mode === "totp" ? "Open your authenticator app and enter the 6-digit code." :
    mode === "recovery" ? "Use one of the single-use codes saved when you set up MFA." :
    t("code_sent_desc");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={120} height={38} className="mx-auto" style={{ width: "auto", height: "auto" }} />
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-100 flex items-center justify-center">
              {mode === "webauthn" ? (
                <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0-1.1.9-2 2-2s2 .9 2 2v2h-4v-2zM6 11c0-3.31 2.69-6 6-6s6 2.69 6 6v2h2v8H4v-8h2v-2z"/></svg>
              ) : mode === "totp" ? (
                <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              ) : mode === "recovery" ? (
                <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 12c0-3-2-5-5-5H8c-3 0-5 2-5 5"/></svg>
              ) : (
                <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              )}
            </div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">{heading}</h1>
            <p className="text-gray-500 text-sm mt-2 font-body">{subtitle}</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium mb-4">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01"/></svg>
              {error}
            </div>
          )}
          {info && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm font-medium mb-4">{info}</div>
          )}

          {mode === "webauthn" && (
            <button
              type="button" onClick={runWebAuthn} disabled={loading}
              className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition disabled:opacity-50">
              {loading ? "Waiting for device…" : "Use passkey"}
            </button>
          )}

          {(mode === "email" || mode === "totp") && (
            <form onSubmit={(e) => { e.preventDefault(); submitCode(code); }}>
              <input
                ref={inputRef}
                type="text" inputMode="numeric" maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-3xl tracking-[0.5em] font-bold px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none mb-4"
                aria-label="6-digit code"
              />
              <button
                type="submit" disabled={loading || code.length !== 6}
                className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition disabled:opacity-50">
                {loading ? t("verifying") : t("verify_code")}
              </button>
            </form>
          )}

          {mode === "recovery" && (
            <form onSubmit={(e) => { e.preventDefault(); submitCode(recovery.trim()); }}>
              <input
                ref={inputRef}
                type="text"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
                placeholder="xxxx-xxxx-xxxx"
                className="w-full text-center text-lg tracking-widest font-mono font-semibold px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none mb-4"
                aria-label="Recovery code"
              />
              <button
                type="submit" disabled={loading || recovery.trim().length < 8}
                className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition disabled:opacity-50">
                {loading ? t("verifying") : "Use recovery code"}
              </button>
            </form>
          )}

          <div className="mt-6 flex flex-col items-center gap-2 text-sm">
            {mode === "email" && (
              <button
                data-testid="resend-email-code"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                className="text-violet-600 font-semibold hover:text-violet-800 disabled:opacity-50"
              >
                {resending ? t("resending") : resendCooldown > 0 ? `${t("resend_code")} (${resendCooldown}s)` : t("resend_code")}
              </button>
            )}
            {mode !== "recovery" && (
              <button onClick={() => { setMode("recovery"); setError(""); setInfo(""); }} className="text-slate-600 hover:text-violet-700 font-semibold">
                Use a recovery code instead
              </button>
            )}
            {mode === "recovery" && (
              <button onClick={() => { setMode(initialMethod); setRecovery(""); setError(""); setInfo(""); }} className="text-slate-600 hover:text-violet-700 font-semibold">
                Back to {initialMethod === "webauthn" ? "passkey" : initialMethod === "totp" ? "authenticator" : "email code"}
              </button>
            )}
            <Link href="/login" className="text-gray-500 hover:text-gray-700">{t("back_to_login")}</Link>
          </div>
        </div>

        {mode === "email" && <p className="text-center text-xs text-gray-400 mt-6 font-body">{t("code_expires")}</p>}
      </div>
    </div>
  );
}
