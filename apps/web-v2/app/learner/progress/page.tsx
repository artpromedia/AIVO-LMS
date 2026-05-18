/**
 * Sprint 12: Learner progress — mastery per subject and recent lesson runs.
 * Shared by learner role (self-scope) and parent role (active-learner cookie).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  getLearner,
  getMasteryMap,
  listLessonRunsForLearner,
  listSkills,
  listSubjects,
} from "@/lib/db/repos";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";

function levelTone(level: string): "primary" | "success" | "neutral" | "warning" {
  if (level === "stretching" || level === "on_grade_level") return "success";
  if (level === "approaching") return "primary";
  if (level === "emerging") return "warning";
  return "neutral";
}

export default async function LearnerProgressPage() {
  const session = await requirePageRole(["learner", "parent"]);
  const learnerId =
    session.role === "learner"
      ? (session.learnerId ?? null)
      : await readActiveLearnerFromCookies(session);
  if (!learnerId) redirect(session.role === "parent" ? "/learner/select" : "/login");
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) redirect("/login");

  const { map, skillMasteries } = getMasteryMap(learnerId, session.tenantId);
  const subjects = listSubjects().map((s) => ({
    ...s,
    skills: listSkills(s.id),
  }));
  const recentRuns = listLessonRunsForLearner(learnerId, session.tenantId, {
    limit: 10,
  });
  // Skill-id → name lookup for recent runs.
  const skillNames = new Map<string, string>();
  for (const subj of subjects) {
    for (const sk of subj.skills) skillNames.set(sk.id, sk.name);
  }

  // Group masteries by subject for display.
  const bySubject = new Map<string, typeof skillMasteries>();
  for (const m of skillMasteries) {
    const arr = bySubject.get(m.subjectId) ?? [];
    arr.push(m);
    bySubject.set(m.subjectId, arr);
  }

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Progress"
        title={`How ${learner.displayName} is growing`}
        description="A snapshot of mastery across subjects and recent lessons."
      />

      {!map ? (
        <EmptyState
          title="No mastery yet"
          description="Finish a baseline assessment so we can start tracking growth."
          action={
            session.role === "parent" ? (
              <Button asChild>
                <Link href={`/parent/learners/${learnerId}`}>Open setup</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/learner/home">Go to today</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <SectionHeader title="Mastery by subject" />
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {subjects.map((subj) => {
              const masteries = bySubject.get(subj.id) ?? [];
              const avg =
                masteries.length === 0
                  ? 0
                  : masteries.reduce((a, m) => a + m.score, 0) / masteries.length;
              return (
                <Card key={subj.id} className="p-[var(--aivo-density-card-pad)]">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-lg font-semibold">{subj.name}</p>
                    <Badge tone="neutral">{Math.round(avg * 100)}% avg</Badge>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {masteries.length === 0 && (
                      <li className="text-aivo-ink-soft">Not started yet.</li>
                    )}
                    {masteries.slice(0, 5).map((m) => {
                      const skill = subj.skills.find((s) => s.id === m.skillId);
                      return (
                        <li key={m.skillId} className="flex items-center justify-between">
                          <span>{skill?.name ?? m.skillId}</span>
                          <Badge tone={levelTone(m.level)}>{m.level.replace(/_/g, " ")}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>

          <SectionHeader title="Recent lessons" />
          {recentRuns.length === 0 ? (
            <Card className="p-[var(--aivo-density-card-pad)] text-sm text-aivo-ink-soft">
              No lessons yet. Today's mission is on your home page.
            </Card>
          ) : (
            <ul className="space-y-2">
              {recentRuns.map((r) => (
                <li key={r.id}>
                  <Card className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-display text-base font-semibold">
                        {skillNames.get(r.skillId) ?? r.skillId}
                      </p>
                      <p className="text-xs text-aivo-ink-soft">
                        {r.source.replace(/_/g, " ")} · {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      tone={
                        r.status === "completed"
                          ? "success"
                          : r.status === "in_progress"
                            ? "primary"
                            : r.status === "failed"
                              ? "warning"
                              : "neutral"
                      }
                    >
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
