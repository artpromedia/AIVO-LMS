"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";

export function BudgetEditor({
  tenantId,
  monthlyCapCents,
  warnAt,
  hardStop,
}: {
  tenantId: string;
  monthlyCapCents: number | null;
  warnAt: number;
  hardStop: boolean;
}) {
  const t = useTranslations("admin.platform_ai_costs");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cap, setCap] = useState(monthlyCapCents === null ? "" : String(monthlyCapCents / 100));
  const [warn, setWarn] = useState(String(warnAt));
  const [stop, setStop] = useState(hardStop);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const capCents = cap.trim() === "" ? null : Math.round(parseFloat(cap) * 100);
      const warnNum = parseFloat(warn);
      if (capCents !== null && (Number.isNaN(capCents) || capCents < 0)) {
        setError("Cap must be a non-negative number.");
        return;
      }
      if (Number.isNaN(warnNum) || warnNum < 0 || warnNum > 1) {
        setError("Warn-at must be between 0 and 1.");
        return;
      }
      const res = await fetch("/api/bff/admin/ai-budgets", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId,
          monthlyCapCents: capCents,
          warnAt: warnNum,
          hardStop: stop,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not save.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="w-24"
        value={cap}
        onChange={(e) => setCap(e.target.value)}
        placeholder="∞"
        aria-label={t("aria_monthly_cap")}
      />
      <span className="text-xs text-aivo-ink-soft">cap $</span>
      <Input
        className="w-20"
        value={warn}
        onChange={(e) => setWarn(e.target.value)}
        aria-label={t("aria_warn_at")}
      />
      <span className="text-xs text-aivo-ink-soft">warn @</span>
      <label className="flex items-center gap-1 text-xs">
        <Checkbox checked={stop} onCheckedChange={(v) => setStop(v === true)} /> hard stop
      </label>
      <Button size="sm" disabled={pending} onClick={save}>
        {pending ? "..." : "Save"}
      </Button>
      {error ? <span className="text-xs text-aivo-danger">{error}</span> : null}
    </div>
  );
}
