"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StaticRoleShell } from "@/components/layout/static-role-shell";

export default function CaregiverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("caregiver.error");
  useEffect(() => {
    console.error("[caregiver/error]", error);
  }, [error]);

  return (
    <StaticRoleShell role="caregiver">
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-iw-error">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-bold">{t("heading")}</h1>
        <p className="mt-3 text-iw-ink-muted">{t("body")}</p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => reset()}>{t("retry")}</Button>
          <Button variant="outline" asChild>
            <Link href="/caregiver/home">{t("home_link")}</Link>
          </Button>
        </div>
      </div>
    </StaticRoleShell>
  );
}
