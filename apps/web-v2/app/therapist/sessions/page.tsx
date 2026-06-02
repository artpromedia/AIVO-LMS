/**
 * Therapist sessions — chronological session log across the therapist's
 * caseload. Each LessonRun is treated as a session: which learner, which
 * subject/skill, status, duration, and timestamps. Pulled from the shared
 * LessonRun store that already records every tutor interaction.
 */
import * as React from "react";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner, listLessonRunsForLearner, listSubjects, listSkills } from "@/lib/db/repos";
import type { LearnerProfile, LessonRun } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const LOG_LIMIT = 40;

function statusTone(status: LessonRun["status"]) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "in_progress":
    case "ready":
    case "generating":
      return "primary" as const;
    case "failed":
      return "danger" as const;
    case "abandoned":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function formatStatus(status: LessonRun["status"]): string {
  return status.replaceAll("_", " ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function durationLabel(run: LessonRun): string {
  if (!run.startedAt) return "—";
  const end = run.completedAt ?? run.updatedAt;
  const ms = new Date(end).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const mins = Math.round(ms / 60_000);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

export default async function TherapistSessionsPage() {
  const t = await getTranslations("therapist.sessions");
  const session = await requirePageRole(["therapist", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "therapist");
  const maybeLearners = await Promise.all(learnerIds.map((id) => getLearner(id, session.tenantId)));
  const learners = maybeLearners.filter((l): l is LearnerProfile => Boolean(l));
  const learnerById = new Map(learners.map((l) => [l.id, l]));

  const subjectName = new Map((await listSubjects()).map((s) => [s.id, s.name]));
  const skillName = new Map((await listSkills()).map((s) => [s.id, s.name]));

  const runBatches = await Promise.all(
    learners.map((l) => listLessonRunsForLearner(l.id, session.tenantId, { limit: LOG_LIMIT })),
  );
  const log = runBatches
    .flat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, LOG_LIMIT);

  let emptyState: React.ReactNode = null;
  if (learners.length === 0) {
    emptyState = (
      <EmptyState
        title={t("empty_no_caseload")}
        description="Sessions appear here once a parent invites you to a learner's care team."
      />
    );
  } else if (log.length === 0) {
    emptyState = (
      <EmptyState
        title={t("empty_no_sessions")}
        description="When a learner on your caseload starts a lesson, the session lands here."
      />
    );
  }

  return (
    <AppShell
      role="therapist"
      roleLabel="Therapist"
      navItems={THERAPIST_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Therapist"
        title={t("title")}
        description="Session log across every learner on your caseload."
      />

      <SectionHeader title={`Recent sessions (${log.length})`} />
      {emptyState ?? (
        <ul className="flex flex-col gap-3">
          {log.map((run) => {
            const learner = learnerById.get(run.learnerId);
            return (
              <li key={run.id}>
                <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {learner?.displayName ?? "Learner"} ·{" "}
                      <span className="text-aivo-ink-soft">
                        {subjectName.get(run.subjectId) ?? "Subject"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-aivo-ink-soft">
                      {skillName.get(run.skillId) ?? "Skill"} · {formatDate(run.createdAt)} ·{" "}
                      {durationLabel(run)}
                    </p>
                  </div>
                  <Badge tone={statusTone(run.status)}>{formatStatus(run.status)}</Badge>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
