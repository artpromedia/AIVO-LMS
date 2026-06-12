"use client";

import { useEffect } from "react";
import { StaticRoleShell } from "@/components/layout/static-role-shell";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ParentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("parent.error");
  useEffect(() => {
    console.error("[parent/error]", error);
  }, [error]);

  return (
    <StaticRoleShell role="parent">
    <div
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-danger">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold">{t("heading")}</h1>
      <p className="mt-3 text-aivo-ink-soft">{t("body")}</p>
      {error.digest ? (
        <p className="mt-2 text-xs text-aivo-muted">{t("reference", { digest: error.digest })}</p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>{t("retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/parent/home">{t("home_link")}</Link>
        </Button>
      </div>
    </div>
    </StaticRoleShell>
  );
}
