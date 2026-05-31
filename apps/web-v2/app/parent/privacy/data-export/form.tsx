"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LearnerOpt = { id: string; displayName: string };

export function ExportRequestForm({ learners }: { learners: LearnerOpt[] }) {
  const t = useTranslations("parent.privacy_export");
  const router = useRouter();
  const [learnerId, setLearnerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/privacy/export-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learnerId: learnerId || null,
          notes: notes || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Request failed.");
      setNotes("");
      setLearnerId("");
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
        <label className="block text-sm font-medium" htmlFor="learner">
          {t("form_scope_label")}
        </label>
        <select
          id="learner"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          value={learnerId}
          onChange={(e) => setLearnerId(e.target.value)}
        >
          <option value="">{t("form_all_my_data_full")}</option>
          {learners.map((l) => (
            <option key={l.id} value={l.id}>
              {t("form_just_learner", { name: l.displayName })}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="notes">
          {t("form_notes_label")}
        </label>
        <textarea
          id="notes"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("form_notes_placeholder")}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? t("form_submitting") : t("form_submit")}
      </Button>
      <p className="text-xs text-aivo-muted">
        {t("form_email_when_ready")}
      </p>
    </form>
  );
}
