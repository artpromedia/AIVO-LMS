"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SyncError } from "@/lib/db/sis-store";

/** Failed-row drill-down with per-row + batch retry and a CSV export. */
export function ErrorDrillDown({
  connectorId,
  errors,
  canRetry,
}: {
  connectorId: string;
  errors: SyncError[];
  canRetry: boolean;
}) {
  const t = useTranslations("admin.sis");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function retry(errorId?: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/bff/admin/sis/${connectorId}/errors`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(errorId ? { errorId } : {}),
        });
        const json = await res.json();
        if (!json.ok) return setMsg(json.error?.userMessage ?? t("error_generic"));
        router.refresh();
      } catch {
        setMsg(t("error_network"));
      }
    });
  }

  function downloadCsv() {
    const header = "id,runId,entity,sourcedId,message,retryable\n";
    const rows = errors
      .map((e) =>
        [
          e.id,
          e.runId,
          e.entity,
          e.sourcedId,
          `"${e.message.replace(/"/g, '""')}"`,
          e.retryable,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sis-errors-${connectorId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (errors.length === 0) {
    return <p className="text-sm text-aivo-ink-soft">{t("no_errors")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t("failed_rows", { count: errors.length })}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
            {t("download_csv")}
          </Button>
          {canRetry ? (
            <Button type="button" size="sm" onClick={() => retry()} disabled={pending}>
              {t("retry_all")}
            </Button>
          ) : null}
        </div>
      </div>
      {msg ? <p className="text-sm text-aivo-danger">{msg}</p> : null}
      <ul className="space-y-2">
        {errors.map((e) => (
          <li key={e.id} className="rounded-md border border-aivo-border p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Badge tone="danger">{e.entity}</Badge>{" "}
                <code className="text-xs">{e.sourcedId}</code>
                <p className="mt-1 text-xs text-iw-ink">{e.message}</p>
              </div>
              {canRetry && e.retryable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => retry(e.id)}
                  disabled={pending}
                >
                  {t("retry")}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
