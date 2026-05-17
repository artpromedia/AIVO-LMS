"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DataRetentionPolicy } from "@/lib/db/types";

export function RetentionRow({ policy }: { policy: DataRetentionPolicy }) {
  const router = useRouter();
  const [retentionDays, setRetentionDays] = useState(policy.retentionDays);
  const [archiveDays, setArchiveDays] = useState(policy.archiveDays);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    retentionDays !== policy.retentionDays || archiveDays !== policy.archiveDays;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/admin/compliance/retention", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: policy.id,
          retentionDays,
          archiveDays,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Save failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-aivo-border align-top">
      <td className="p-3 font-mono text-xs">{policy.classification}</td>
      <td className="p-3">
        <input
          type="number"
          min={0}
          className="w-28 rounded border border-aivo-border bg-aivo-surface-1 p-1"
          value={retentionDays}
          onChange={(e) => setRetentionDays(Math.max(0, Number(e.target.value) || 0))}
        />
      </td>
      <td className="p-3">
        <input
          type="number"
          min={0}
          className="w-28 rounded border border-aivo-border bg-aivo-surface-1 p-1"
          value={archiveDays}
          onChange={(e) => setArchiveDays(Math.max(0, Number(e.target.value) || 0))}
        />
      </td>
      <td className="p-3 text-aivo-ink-soft">{policy.description}</td>
      <td className="p-3">
        <Button type="button" disabled={!dirty || busy} onClick={save} className="text-xs">
          {busy ? "Saving…" : "Save"}
        </Button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </td>
    </tr>
  );
}
