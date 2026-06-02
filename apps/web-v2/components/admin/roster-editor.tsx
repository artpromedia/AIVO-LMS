"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Classroom } from "@/lib/admin/school-ops";

interface RosterEditorProps {
  classroom: Classroom;
}

// Synthetic learner / teacher pools for demo
const ALL_LEARNERS = [
  { id: "lrn_demo_sky", name: "Skyler Nguyen", grade: "4" },
  { id: "lrn_demo_rio", name: "Rio Martinez", grade: "K" },
  { id: "lrn_demo_ada", name: "Ada Chen", grade: "7" },
  { id: "lrn_demo_kai", name: "Kai Brooks", grade: "4" },
  { id: "lrn_demo_zoe", name: "Zoe Patel", grade: "K" },
  { id: "lrn_demo_max", name: "Max Rivera", grade: "3" },
];

const ALL_TEACHERS = [
  { id: "u_teacher_1", name: "Ms. Rivera" },
  { id: "u_teacher_2", name: "Mr. Patel" },
  { id: "u_teacher_3", name: "Ms. Chen" },
  { id: "u_teacher_4", name: "Mr. Johnson" },
];

export function RosterEditor({ classroom }: RosterEditorProps) {
  const router = useRouter();
  const [learnerIds, setLearnerIds] = React.useState<Set<string>>(new Set(classroom.learnerIds));
  const [coTeacherIds, setCoTeacherIds] = React.useState<Set<string>>(
    new Set(classroom.coTeacherIds),
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const enrolledLearners = ALL_LEARNERS.filter((l) => learnerIds.has(l.id));
  const availableLearners = ALL_LEARNERS.filter((l) => !learnerIds.has(l.id));
  const enrolledCoTeachers = ALL_TEACHERS.filter(
    (t) => coTeacherIds.has(t.id) && t.id !== classroom.teacherId,
  );
  const availableCoTeachers = ALL_TEACHERS.filter(
    (t) => !coTeacherIds.has(t.id) && t.id !== classroom.teacherId,
  );

  const addLearner = (id: string) => {
    setLearnerIds((prev) => new Set([...prev, id]));
    setSaved(false);
  };
  const removeLearner = (id: string) => {
    setLearnerIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSaved(false);
  };
  const addCoTeacher = (id: string) => {
    setCoTeacherIds((prev) => new Set([...prev, id]));
    setSaved(false);
  };
  const removeCoTeacher = (id: string) => {
    setCoTeacherIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    // Compute diffs from original
    const origLearners = new Set(classroom.learnerIds);
    const origCoTeachers = new Set(classroom.coTeacherIds);

    const addLearnerIds = [...learnerIds].filter((id) => !origLearners.has(id));
    const removeLearnerIds = [...origLearners].filter((id) => !learnerIds.has(id));
    const addCoTeacherIds = [...coTeacherIds].filter((id) => !origCoTeachers.has(id));
    const removeCoTeacherIds = [...origCoTeachers].filter((id) => !coTeacherIds.has(id));

    try {
      const res = await fetch(`/api/bff/admin/school/classrooms/${classroom.id}/roster`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          addLearnerIds,
          removeLearnerIds,
          addCoTeacherIds,
          removeCoTeacherIds,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Failed to update roster.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Learners */}
      <section aria-labelledby="learners-heading">
        <h3 id="learners-heading" className="font-iw-display text-lg font-semibold mb-3">
          Learners <Badge tone="neutral">{learnerIds.size}</Badge>
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-iw-card border border-iw-border bg-iw-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
              Enrolled
            </p>
            {enrolledLearners.length === 0 && (
              <p className="text-sm text-iw-ink-muted">No learners enrolled.</p>
            )}
            {enrolledLearners.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  {l.name} <span className="text-iw-ink-muted">· Grade {l.grade}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeLearner(l.id)}
                  type="button"
                  aria-label={`Remove ${l.name} from classroom`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-iw-card border border-iw-border bg-iw-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
              Available
            </p>
            {availableLearners.length === 0 && (
              <p className="text-sm text-iw-ink-muted">All learners are enrolled.</p>
            )}
            {availableLearners.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  {l.name} <span className="text-iw-ink-muted">· Grade {l.grade}</span>
                </span>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => addLearner(l.id)}
                  type="button"
                  aria-label={`Add ${l.name} to classroom`}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Co-teachers */}
      <section aria-labelledby="coteachers-heading">
        <h3 id="coteachers-heading" className="font-iw-display text-lg font-semibold mb-3">
          Co-teachers <Badge tone="neutral">{coTeacherIds.size}</Badge>
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-iw-card border border-iw-border bg-iw-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
              Assigned
            </p>
            {enrolledCoTeachers.length === 0 && (
              <p className="text-sm text-iw-ink-muted">No co-teachers assigned.</p>
            )}
            {enrolledCoTeachers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{t.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeCoTeacher(t.id)}
                  type="button"
                  aria-label={`Remove ${t.name} as co-teacher`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-iw-card border border-iw-border bg-iw-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
              Available
            </p>
            {availableCoTeachers.length === 0 && (
              <p className="text-sm text-iw-ink-muted">No available teachers.</p>
            )}
            {availableCoTeachers.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{t.name}</span>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => addCoTeacher(t.id)}
                  type="button"
                  aria-label={`Add ${t.name} as co-teacher`}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-aivo-success">Roster saved successfully.</p>}

      <Button onClick={handleSave} disabled={isSaving} type="button">
        {isSaving ? "Saving…" : "Save roster"}
      </Button>
    </div>
  );
}
