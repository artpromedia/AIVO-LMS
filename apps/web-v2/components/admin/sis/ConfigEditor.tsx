"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMappingEditor, type FieldMappingValue } from "./FieldMappingEditor";
import type { SisConnector } from "@/lib/db/sis-store";

/** Connector config editor: schedules, mutation cap, and field mapping. */
export function ConfigEditor({ connector }: { connector: SisConnector }) {
  const t = useTranslations("admin.sis");
  const router = useRouter();
  const [fullCron, setFullCron] = useState(connector.fullScheduleCron);
  const [deltaCron, setDeltaCron] = useState(connector.deltaScheduleCron);
  const [capPct, setCapPct] = useState(String(Math.round(connector.maxMutationRatio * 100)));
  const [mapping, setMapping] = useState<FieldMappingValue>(connector.mapping);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const ratio = Math.min(1, Math.max(0.01, (Number(capPct) || 10) / 100));
    startTransition(async () => {
      try {
        const res = await fetch(`/api/bff/admin/sis/${connector.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullScheduleCron: fullCron.trim(),
            deltaScheduleCron: deltaCron.trim(),
            maxMutationRatio: ratio,
            mapping,
          }),
        });
        const json = await res.json();
        if (!json.ok) return setStatus({ kind: "err", text: json.error?.userMessage ?? t("error_generic") });
        setStatus({ kind: "ok", text: t("config_saved") });
        router.refresh();
      } catch {
        setStatus({ kind: "err", text: t("error_network") });
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="cfg-full">{t("full_schedule")}</Label>
          <Input id="cfg-full" value={fullCron} onChange={(e) => setFullCron(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="cfg-delta">{t("delta_schedule")}</Label>
          <Input id="cfg-delta" value={deltaCron} onChange={(e) => setDeltaCron(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="cfg-cap">{t("mutation_cap")}</Label>
          <Input id="cfg-cap" type="number" min={1} max={100} value={capPct} onChange={(e) => setCapPct(e.target.value)} className="mt-1" />
          <p className="mt-1 text-xs text-aivo-ink-soft">{t("mutation_cap_help")}</p>
        </div>
      </div>
      <FieldMappingEditor value={mapping} onChange={setMapping} />
      <div className="flex items-center justify-end gap-3">
        {status?.kind === "ok" ? <p className="text-sm text-aivo-success">{status.text}</p> : null}
        {status?.kind === "err" ? <p className="text-sm text-aivo-danger">{status.text}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? t("saving") : t("save_config")}</Button>
      </div>
    </form>
  );
}
