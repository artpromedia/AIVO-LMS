"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthInput } from "@aivo/ui/auth";
import { Button } from "@/components/ui/button";

type Started = { secret: string; otpauthUrl: string };

export function TotpEnrollForm({ alreadyEnrolled }: { alreadyEnrolled: boolean }) {
  const t = useTranslations("auth.mfa_enroll");
  const router = useRouter();
  const [started, setStarted] = useState<Started | null>(null);
  const [code, setCode] = useState("");
  const [done, setDone] = useState(alreadyEnrolled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function begin() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/mfa/enroll", { method: "POST" });
        const json = await res.json();
        if (!json.ok) return setError(json.error?.userMessage ?? t("error_generic"));
        setStarted({ secret: json.data.secret, otpauthUrl: json.data.otpauthUrl });
      } catch {
        setError(t("error_network"));
      }
    });
  }

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/mfa/enroll", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        });
        const json = await res.json();
        if (!json.ok) return setError(json.error?.userMessage ?? t("error_invalid_code"));
        setDone(true);
        router.refresh();
      } catch {
        setError(t("error_network"));
      }
    });
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-iw-card border border-iw-success/40 bg-iw-success/10 px-4 py-3 text-sm text-iw-success"
      >
        {t("enrolled")}
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-iw-ink-muted">{t("intro")}</p>
        <Button type="button" size="lg" onClick={begin} disabled={pending}>
          {pending ? t("starting") : t("start")}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-iw-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{t("scan_instructions")}</p>
        <p className="mt-1 break-all text-xs text-iw-ink-muted">
          <a href={started.otpauthUrl} className="text-iw-primary hover:underline">
            {t("open_in_app")}
          </a>
        </p>
        <p className="mt-2 text-sm">{t("manual_key")}</p>
        <code className="mt-1 block break-all rounded bg-iw-card px-2 py-1 text-xs">
          {started.secret}
        </code>
      </div>
      <AuthInput
        id="totp-code"
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
        {pending ? t("confirming") : t("confirm")}
      </Button>
    </form>
  );
}
