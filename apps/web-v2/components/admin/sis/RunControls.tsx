"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Manual sync triggers (full / delta / dry-run) for a connector. */
export function RunControls({ connectorId }: { connectorId: string }) {
  const t = useTranslations("admin.sis");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function run(type: "full" | "delta", dryRun: boolean) {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/bff/admin/sis/${connectorId}/runs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, dryRun }),
        });
        const json = await res.json();
        if (!json.ok)
          return setMsg({ kind: "err", text: json.error?.userMessage ?? t("error_generic") });
        const run = json.data.run;
        setMsg({
          kind: "ok",
          text:
            run.status === "paused" ? t("run_paused") : dryRun ? t("dry_run_done") : t("run_done"),
        });
        router.refresh();
      } catch {
        setMsg({ kind: "err", text: t("error_network") });
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => run("full", false)} disabled={pending}>
          {t("run_full")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => run("delta", false)}
          disabled={pending}
        >
          {t("run_delta")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => run("full", true)} disabled={pending}>
          {t("run_dry")}
        </Button>
      </div>
      {msg ? (
        <p className={`text-sm ${msg.kind === "ok" ? "text-aivo-success" : "text-aivo-danger"}`}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
