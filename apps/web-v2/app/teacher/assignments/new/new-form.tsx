"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SubjectOption = {
  id: string;
  name: string;
  skills: { id: string; name: string }[];
};
type LearnerOption = { id: string; displayName: string };

const TITLE_LABEL = "Title";

export function NewAssignmentForm({
  subjects,
  learners,
}: {
  subjects: SubjectOption[];
  learners: LearnerOption[];
}) {
  const t = useTranslations("teacher.assignments_new");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [learnerIds, setLearnerIds] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSkills = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.skills ?? [],
    [subjects, subjectId],
  );

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !subjectId || skillIds.length === 0 || learnerIds.length === 0) {
      setError("Title, subject, at least one skill, and at least one learner are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/teacher/assignments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          instructions: instructions.trim(),
          subjectId,
          skillIds,
          learnerIds,
          dueAt: dueAt || null,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!res.ok || !body.ok) {
        setError(body.error?.message ?? "Couldn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push("/teacher/assignments");
    } catch {
      setError("Network problem. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <Card className="p-[var(--aivo-density-card-pad)] grid gap-4">
        <div className="grid gap-2">
          <label htmlFor="a-title" className="text-sm font-medium">
            {TITLE_LABEL}
          </label>
          <input
            id="a-title"
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            required
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="a-instr" className="text-sm font-medium">
            {t("instructions_label")}
          </label>
          <textarea
            id="a-instr"
            rows={3}
            maxLength={1000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="a-subj" className="text-sm font-medium">
            {t("subject_label")}
          </label>
          <select
            id="a-subj"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setSkillIds([]);
            }}
            className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{t("skills_label")}</legend>
          <ul className="grid gap-1 sm:grid-cols-2">
            {currentSkills.map((sk) => (
              <li key={sk.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skillIds.includes(sk.id)}
                    onChange={() => setSkillIds((l) => toggle(l, sk.id))}
                  />
                  {sk.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">{t("assign_label")}</legend>
          {learners.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_learners")}</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {learners.map((l) => (
                <li key={l.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={learnerIds.includes(l.id)}
                      onChange={() => setLearnerIds((x) => toggle(x, l.id))}
                    />
                    {l.displayName}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div className="grid gap-2">
          <label htmlFor="a-due" className="text-sm font-medium">
            {t("due_date_label")}
          </label>
          <input
            id="a-due"
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="rounded-md border border-input bg-background p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Create assignment"}
        </Button>
      </div>
    </form>
  );
}
