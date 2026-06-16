"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * /parent/home-v2 — error boundary.
 *
 * Calm by default. Never blames the parent. Never says "exception"
 * or "stack trace". Offers one clear primary action (retry) and one
 * secondary (go to legacy home).
 */
export default function ParentHomeV2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("parent.home_v2");
  useEffect(() => {
    console.error("[parent/home-v2]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-iw-card-lg bg-white border border-iw-border shadow-soft-3 p-8 flex flex-col gap-4 text-center">
        <div className="self-center inline-flex items-center justify-center h-14 w-14 rounded-full bg-iw-warm-soft text-[var(--aivo-status-warning)]">
          <AivoIcon name="safetyFlag" size={28} />
        </div>
        <h1 className="text-xl font-semibold text-iw-text-strong">{t("error_heading")}</h1>
        <p className="text-sm text-iw-text-muted">
          Nothing has changed for your learner. Try again — and if it keeps happening, the legacy
          home is still available.
        </p>
        {error.digest ? (
          <p className="text-xs text-iw-text-muted">
            {t("error_reference")} <code className="px-1 rounded bg-iw-card">{error.digest}</code>
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button type="button" onClick={reset}>
            {t("error_retry")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/parent/home">{t("open_legacy_home")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
