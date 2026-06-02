"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AuthInput } from "@aivo/ui/auth";
import { Button } from "@/components/ui/button";

/** Sanitize a return target to a same-origin path to prevent open redirects. */
function safeReturn(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function StepUpForm({ returnTo }: { returnTo?: string }) {
  const t = useTranslations("auth.mfa_step_up");
  const target = safeReturn(returnTo);
  const [factor, setFactor] = useState<"totp" | "none" | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // On mount, ask the backend what factor to present (and whether a recent
  // step-up already satisfies the requirement).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/bff/mfa/step-up", { method: "POST" });
        const json = await res.json();
        if (!active) return;
        if (json.ok && json.data.satisfied) {
          window.location.assign(target);
          return;
        }
        setFactor(json.ok ? json.data.factor : "none");
      } catch {
        if (active) setError(t("error_network"));
      }
    })();
    return () => {
      active = false;
    };
  }, [target, t]);

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/mfa/step-up", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        });
        const json = await res.json();
        if (!json.ok) return setError(json.error?.userMessage ?? t("error_invalid_code"));
        window.location.assign(target);
      } catch {
        setError(t("error_network"));
      }
    });
  }

  if (factor === null) {
    return <p className="text-sm text-iw-ink-muted">{t("checking")}</p>;
  }

  if (factor === "none") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-iw-ink-muted">{t("no_factor")}</p>
        <Button asChild size="lg">
          <a href={`/mfa/enroll?return=${encodeURIComponent(target)}`}>{t("enroll_cta")}</a>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <AuthInput
        id="stepup-code"
        name="code"
        label={t("code_label")}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        minLength={6}
        maxLength={8}
        autoFocus
      />
      {error ? (
        <p role="alert" className="text-sm text-iw-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || code.trim().length < 6}>
        {pending ? t("verifying") : t("verify")}
      </Button>
    </form>
  );
}
