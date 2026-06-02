"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AuthInput } from "@aivo/ui/auth";
import { Button } from "@/components/ui/button";

function safeReturn(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Generic MFA re-verification surface (distinct from the login-time
 * challenge at /login/mfa). Verifies a TOTP code against the caller's
 * active factor, then returns to `returnTo`.
 */
export function MfaVerifyForm({ returnTo }: { returnTo?: string }) {
  const t = useTranslations("auth.mfa_verify");
  const target = safeReturn(returnTo);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/mfa/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        });
        const json = await res.json();
        if (!json.ok) return setError(json.error?.userMessage ?? t("error_invalid_code"));
        setDone(true);
        window.location.assign(target);
      } catch {
        setError(t("error_network"));
      }
    });
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <AuthInput
        id="verify-code"
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
      <Button type="submit" size="lg" disabled={pending || done || code.trim().length < 6}>
        {pending || done ? t("verifying") : t("verify")}
      </Button>
    </form>
  );
}
