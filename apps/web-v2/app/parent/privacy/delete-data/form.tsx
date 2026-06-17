"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LearnerOpt = { id: string; displayName: string };
type Scope = "account" | "learner" | "iep_only";

export function DeleteRequestForm({ learners }: { learners: LearnerOpt[] }) {
  const t = useTranslations("parent.privacy_delete");
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
      setError(t("form_confirm_error"));
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
          {t("form_question")}
        </label>
        <select
          id="scope"
          className="mt-1 w-full rounded border border-iw-border bg-iw-card p-2"
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
        >
          <option value="account">{t("form_scope_account")}</option>
          <option value="learner">{t("form_scope_learner")}</option>
          <option value="iep_only">{t("form_scope_iep")}</option>
        </select>
      </div>

      {requiresLearner && (
        <div>
          <label className="block text-sm font-medium" htmlFor="learner">
            {t("form_learner_label")}
          </label>
          <select
            id="learner"
            className="mt-1 w-full rounded border border-iw-border bg-iw-card p-2"
            value={learnerId}
            onChange={(e) => setLearnerId(e.target.value)}
            required
          >
            {learners.length === 0 && <option value="">{t("form_no_learners")}</option>}
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
          {t("form_notes_label")}
        </label>
        <textarea
          id="notes"
          className="mt-1 w-full rounded border border-iw-border bg-iw-card p-2"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="confirm">
          {t.rich("form_confirm_label", {
            mono: (chunks) => <span className="font-mono">{chunks}</span>,
          })}
        </label>
        <input
          id="confirm"
          type="text"
          className="mt-1 w-full rounded border border-iw-border bg-iw-card p-2"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
      </div>

      {error && <p className="text-sm text-iw-error-strong">{error}</p>}
      <Button type="submit" disabled={busy || confirm !== "DELETE"}>
        {busy ? "Submitting…" : "Request deletion"}
      </Button>
    </form>
  );
}
