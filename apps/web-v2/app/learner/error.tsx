"use client";

import { useEffect } from "react";
import { StaticRoleShell } from "@/components/layout/static-role-shell";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AivoMascot } from "@/components/learner/art/aivo-mascot";

export default function LearnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("learner.errors");

  useEffect(() => {
    console.error("[learner/error]", error);
  }, [error]);

  return (
    <StaticRoleShell role="learner">
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <AivoMascot expression="thinking" size={104} className="mb-1" />
        <p className="text-sm font-medium uppercase tracking-wide text-iw-error">{t("title")}</p>
        <h1 className="mt-2 font-display text-4xl font-bold">{t("body")}</h1>
        <p className="mt-3 text-iw-ink-muted">
          Your progress is saved. Tap "Try again" to come right back, or visit home for your next
          mission.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-iw-ink-muted">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <Button onClick={() => reset()}>{t("retry")}</Button>
          <Button variant="outline" asChild>
            <Link href="/learner/home">{t("back_home")}</Link>
          </Button>
        </div>
      </div>
    </StaticRoleShell>
  );
}
