"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ReviewActions({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resolve(status: "resolved_allow" | "resolved_block" | "escalated") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bff/admin/safety/review-cases/${caseId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, resolution: note || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Failed.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Reviewer note (optional)"
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => resolve("resolved_allow")}
          disabled={busy}
        >
          Allow
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          onClick={() => resolve("resolved_block")}
          disabled={busy}
        >
          Block
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => resolve("escalated")}
          disabled={busy}
        >
          Escalate
        </Button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
