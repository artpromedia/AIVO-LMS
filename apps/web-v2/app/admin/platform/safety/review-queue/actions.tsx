"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        <button
          onClick={() => resolve("resolved_allow")}
          disabled={busy}
          className="rounded bg-aivo-success/20 px-3 py-1 text-xs font-medium text-aivo-success disabled:opacity-50"
        >
          Allow
        </button>
        <button
          onClick={() => resolve("resolved_block")}
          disabled={busy}
          className="rounded bg-aivo-danger/20 px-3 py-1 text-xs font-medium text-aivo-danger disabled:opacity-50"
        >
          Block
        </button>
        <button
          onClick={() => resolve("escalated")}
          disabled={busy}
          className="rounded border px-3 py-1 text-xs font-medium disabled:opacity-50"
        >
          Escalate
        </button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
