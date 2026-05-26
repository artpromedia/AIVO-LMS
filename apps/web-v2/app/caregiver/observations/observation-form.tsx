"use client";

/**
 * Sprint 10 — caregiver observation authoring form.
 *
 * Posts to /api/bff/caregiver/observations and refreshes the page so
 * the new row appears at the top of the authored-observations list.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";

type LearnerOption = { id: string; name: string };

export function CaregiverObservationForm({ learners }: { learners: LearnerOption[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const body = {
        learnerId: String(formData.get("learnerId") ?? ""),
        behaviour: String(formData.get("behaviour") ?? "").trim(),
        antecedent: String(formData.get("antecedent") ?? "").trim(),
        consequence: String(formData.get("consequence") ?? "").trim(),
        durationMinutes: formData.get("durationMinutes")
          ? Number(formData.get("durationMinutes"))
          : null,
        location: String(formData.get("location") ?? "home"),
      };
      if (!body.learnerId || !body.behaviour) {
        setError("Pick a learner and describe what you noticed.");
        return;
      }
      const res = await fetch("/api/bff/caregiver/observations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(`Save failed: ${text.slice(0, 200)}`);
        return;
      }
      // Reset form + refresh server-rendered list.
      (document.getElementById("caregiver-observation-form") as HTMLFormElement | null)?.reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4">
      <form
        id="caregiver-observation-form"
        action={onSubmit}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">Learner</span>
          <select
            name="learnerId"
            required
            className="rounded border border-aivo-border px-2 py-1.5"
          >
            <option value="">Choose a learner…</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">Location</span>
          <select
            name="location"
            defaultValue="home"
            className="rounded border border-aivo-border px-2 py-1.5"
          >
            <option value="home">Home</option>
            <option value="school">School</option>
            <option value="community">Community</option>
            <option value="therapy">Therapy</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span className="iw-label text-aivo-ink-soft">Behaviour (what did you see?)</span>
          <textarea
            name="behaviour"
            required
            rows={2}
            placeholder="Describe the behaviour briefly."
            className="rounded border border-aivo-border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">Antecedent (what came before?)</span>
          <textarea
            name="antecedent"
            rows={2}
            className="rounded border border-aivo-border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">Consequence (what came after?)</span>
          <textarea
            name="consequence"
            rows={2}
            className="rounded border border-aivo-border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">Duration (minutes, optional)</span>
          <input
            type="number"
            name="durationMinutes"
            min={0}
            max={600}
            className="rounded border border-aivo-border px-2 py-1.5"
          />
        </label>
        <div className="md:col-span-2 flex items-center justify-between">
          {error && (
            <p className="text-sm text-red-600" data-testid="observation-form-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded bg-[var(--aivo-sensory-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="observation-form-submit"
          >
            {pending ? "Saving…" : "Save observation"}
          </button>
        </div>
      </form>
    </Card>
  );
}
