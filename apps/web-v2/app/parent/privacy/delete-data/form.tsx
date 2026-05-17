"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LearnerOpt = { id: string; displayName: string };
type Scope = "account" | "learner" | "iep_only";

export function DeleteRequestForm({ learners }: { learners: LearnerOpt[] }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("account");
  const [learnerId, setLearnerId] = useState<string>(learners[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresLearner = scope === "learner" || scope === "iep_only";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== "DELETE") {
      setError('Type DELETE to confirm.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/privacy/delete-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          learnerId: requiresLearner ? learnerId : null,
          notes: notes || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Request failed.");
      setNotes("");
      setConfirm("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="scope">
          What do you want to delete?
        </label>
        <select
          id="scope"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
        >
          <option value="account">My whole account (every learner, all history)</option>
          <option value="learner">A single learner (all of their data)</option>
          <option value="iep_only">Just an uploaded IEP document</option>
        </select>
      </div>

      {requiresLearner && (
        <div>
          <label className="block text-sm font-medium" htmlFor="learner">
            Learner
          </label>
          <select
            id="learner"
            className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
            value={learnerId}
            onChange={(e) => setLearnerId(e.target.value)}
            required
          >
            {learners.length === 0 && <option value="">No learners</option>}
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium" htmlFor="notes">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="confirm">
          Type <span className="font-mono">DELETE</span> to confirm
        </label>
        <input
          id="confirm"
          type="text"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || confirm !== "DELETE"}>
        {busy ? "Submitting…" : "Request deletion"}
      </Button>
    </form>
  );
}
