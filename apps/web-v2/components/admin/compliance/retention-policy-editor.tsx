"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DataClass, RetentionPolicy } from "@/lib/compliance/governance-store";

interface PreviewData {
  totalCount: number;
  eligibleCount: number;
  disposition: string;
  legalHold: boolean;
  retentionDays: number | null;
}

export function RetentionPolicyEditor({
  dataClass,
  retention,
  preview,
}: {
  dataClass: DataClass;
  retention: RetentionPolicy;
  preview: PreviewData;
}) {
  const router = useRouter();
  const [retentionDays, setRetentionDays] = useState<number | null>(retention.retentionDays);
  const [disposition, setDisposition] = useState<"purge" | "anonymize">(retention.disposition);
  const [legalHold, setLegalHold] = useState(retention.legalHold);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    retentionDays !== retention.retentionDays ||
    disposition !== retention.disposition ||
    legalHold !== retention.legalHold;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/bff/admin/compliance/retention/governance", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataClass: dataClass.dataClass,
          retentionDays,
          disposition,
          legalHold,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Save failed.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const eligibleNow = legalHold || retentionDays === null ? 0 : preview.eligibleCount;

  return (
    <tr className="border-t border-aivo-border align-top">
      <td className="p-3 font-mono text-xs">
        <span className="font-semibold">{dataClass.dataClass}</span>
        <p className="text-aivo-ink-soft text-[11px] mt-0.5">{dataClass.owningService}</p>
      </td>
      <td className="p-3">
        <input
          type="number"
          min={0}
          className="w-24 rounded border border-iw-border bg-iw-raised p-1 text-sm"
          value={retentionDays ?? ""}
          placeholder="∞"
          onChange={(e) => {
            const v = e.target.value;
            setRetentionDays(v === "" ? null : Math.max(0, Number(v) || 0));
          }}
        />
      </td>
      <td className="p-3">
        <select
          className="rounded border border-iw-border bg-iw-raised p-1 text-sm"
          value={disposition}
          onChange={(e) => setDisposition(e.target.value as "purge" | "anonymize")}
        >
          <option value="purge">Purge</option>
          <option value="anonymize">Anonymize</option>
        </select>
      </td>
      <td className="p-3">
        <input
          type="checkbox"
          className="h-4 w-4 accent-iw-primary"
          checked={legalHold}
          onChange={(e) => setLegalHold(e.target.checked)}
          aria-label="Legal hold"
        />
      </td>
      <td className="p-3 text-xs text-aivo-ink-soft">
        <span className={eligibleNow > 0 ? "text-aivo-danger font-semibold" : "text-aivo-success"}>
          {eligibleNow} / {preview.totalCount}
        </span>{" "}
        <span className="text-[11px]">eligible</span>
      </td>
      <td className="p-3">
        <Button type="button" size="sm" variant="outline" disabled={!dirty || busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {saved && !dirty && <span className="ml-2 text-xs text-aivo-success">Saved</span>}
        {error && <p className="text-xs text-aivo-danger mt-1">{error}</p>}
      </td>
    </tr>
  );
}
