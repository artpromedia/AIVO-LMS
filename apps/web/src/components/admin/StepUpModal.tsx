"use client";
/**
 * Step-up modal (Sprint 3).
 *
 * Renders an accessible dialog whenever `requireStepUp(scope)` is invoked
 * via the helper in `@/lib/step-up`. The user proves possession of their
 * strongest enrolled factor (passkey > TOTP > email OTP), and the modal
 * resolves the pending promise with the resulting `stepUpToken`.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { subscribeStepUp, completeStepUp, cancelStepUp, type StepUpScope } from "@/lib/step-up";
import { startAuthentication } from "@simplewebauthn/browser";

interface InitiateResp {
  factor: "webauthn" | "totp" | "email";
  challengeToken: string;
  webauthn?: { options: any; webauthnChallengeToken: string };
  email?: { sentTo: string };
}

const SCOPE_LABEL: Record<StepUpScope, string> = {
  "tenant:delete": "delete this tenant",
  "tenant:suspend": "suspend or modify this tenant",
  "user:delete": "deactivate this user",
  "user:impersonate": "impersonate this user",
  "role:change": "change this user's role",
  "brain:reset": "reset this learner's Brain Clone",
  "data:export": "export this data",
  "config:update": "update sensitive configuration",
  "district:admin-mgmt": "manage district administrators",
};

export function StepUpModal() {
  const [pending, setPending] = useState<{ scope: StepUpScope; accessToken: string } | null>(null);
  const [phase, setPhase] = useState<"init" | "ready" | "verifying" | "error">("init");
  const [challenge, setChallenge] = useState<InitiateResp | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(
    () =>
      subscribeStepUp((p) => {
        if (!p) {
          setPending(null);
          setPhase("init");
          setChallenge(null);
          setCode("");
          setRecovery("");
          setErr(null);
          return;
        }
        setPending({ scope: p.scope, accessToken: p.accessToken });
      }),
    [],
  );

  const initiate = useCallback(
    async (factor?: "webauthn" | "totp" | "email") => {
      if (!pending) return;
      setErr(null);
      setPhase("init");
      try {
        const r = await fetch("/api/auth/step-up/initiate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pending.accessToken}`,
          },
          body: JSON.stringify({ scope: pending.scope, ...(factor ? { factor } : {}) }),
        });
        const data = await r.json();
        if (!r.ok) {
          setErr(data.error || "Failed to start step-up");
          setPhase("error");
          return;
        }
        setChallenge(data);
        setPhase("ready");
      } catch (e: any) {
        setErr(e?.message || "Network error");
        setPhase("error");
      }
    },
    [pending],
  );

  useEffect(() => {
    if (pending && phase === "init") {
      initiate();
    }
  }, [pending, phase, initiate]);

  useEffect(() => {
    if (pending && phase === "ready") {
      firstFocusRef.current?.focus();
    }
  }, [pending, phase]);

  // Keyboard: Escape cancels
  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelStepUp("Cancelled by user");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending]);

  async function submit() {
    if (!pending || !challenge) return;
    setPhase("verifying");
    setErr(null);
    try {
      const body: any = { challengeToken: challenge.challengeToken };
      if (challenge.factor === "webauthn") {
        try {
          const assertion = await startAuthentication({ optionsJSON: challenge.webauthn!.options });
          body.webauthnResponse = assertion;
          body.webauthnChallengeToken = challenge.webauthn!.webauthnChallengeToken;
        } catch (e: any) {
          setErr(e?.message || "Passkey cancelled");
          setPhase("error");
          return;
        }
      } else if (challenge.factor === "totp") {
        if (recovery) body.recoveryCode = recovery;
        else body.totpCode = code;
      } else {
        if (recovery) body.recoveryCode = recovery;
        else body.emailCode = code;
      }
      const r = await fetch("/api/auth/step-up/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pending.accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Verification failed");
        setPhase("error");
        return;
      }
      completeStepUp(data.stepUpToken);
    } catch (e: any) {
      setErr(e?.message || "Network error");
      setPhase("error");
    }
  }

  if (!pending) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stepup-title"
      ref={dialogRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4"
      data-testid="step-up-modal"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="stepup-title" className="text-lg font-bold text-slate-900">
          Confirm it&apos;s you
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          You&apos;re about to {SCOPE_LABEL[pending.scope] ?? pending.scope}. Please re-verify with
          your strongest sign-in method.
        </p>

        {phase === "init" && <p className="mt-4 text-sm text-slate-500">Preparing challenge…</p>}

        {challenge && (phase === "ready" || phase === "verifying" || phase === "error") && (
          <div className="mt-4 space-y-3">
            {challenge.factor === "webauthn" && (
              <button
                ref={firstFocusRef}
                onClick={submit}
                disabled={phase === "verifying"}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                data-testid="stepup-passkey-btn"
              >
                {phase === "verifying" ? "Verifying…" : "Use security key / passkey"}
              </button>
            )}

            {challenge.factor === "totp" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  <span>Authenticator app code</span>
                  <input
                    ref={firstFocusRef as any}
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest font-mono"
                    data-testid="stepup-totp-input"
                  />
                </label>
              </div>
            )}

            {challenge.factor === "email" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Code sent to {challenge.email?.sentTo}</p>
                <label className="block text-sm font-medium text-slate-700">
                  <span>Email code</span>
                  <input
                    ref={firstFocusRef as any}
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest font-mono"
                    data-testid="stepup-email-input"
                  />
                </label>
              </div>
            )}

            {challenge.factor !== "webauthn" && (
              <details className="rounded-lg border border-slate-200 p-2 text-sm">
                <summary className="cursor-pointer text-slate-600">
                  Use a recovery code instead
                </summary>
                <input
                  type="text"
                  value={recovery}
                  onChange={(e) => setRecovery(e.target.value)}
                  placeholder="aivo-xxxxxx-xxxxxx"
                  className="mt-2 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                  data-testid="stepup-recovery-input"
                />
              </details>
            )}

            {err && (
              <p className="text-sm text-red-600" data-testid="stepup-error">
                {err}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => cancelStepUp("Cancelled by user")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                data-testid="stepup-cancel"
              >
                Cancel
              </button>
              {challenge.factor !== "webauthn" && (
                <button
                  onClick={submit}
                  disabled={phase === "verifying" || (!code && !recovery)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  data-testid="stepup-submit"
                >
                  {phase === "verifying" ? "Verifying…" : "Confirm"}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "error" && !challenge && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-600" data-testid="stepup-error">
              {err}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => cancelStepUp("Cancelled by user")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => initiate()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
