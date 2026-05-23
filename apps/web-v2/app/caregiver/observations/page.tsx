/**
 * Caregiver observations — feed of recent lesson activity across every
 * learner whose care team has invited the signed-in caregiver. Each
 * LessonRun is a real observation: which learner, which subject/skill,
 * status, and when it happened. Pulled from the shared LessonRun store
 * already populated by parent/teacher activity.
 */
import * as React from "react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner, listLessonRunsForLearner, listSubjects, listSkills } from "@/lib/db/repos";
import type { LearnerProfile, LessonRun } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const FEED_LIMIT = 30;

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

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function CaregiverObservationsPage() {
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "caregiver");
  const learners = learnerIds
    .map((id) => getLearner(id, session.tenantId))
    .filter((l): l is LearnerProfile => Boolean(l));
  const learnerById = new Map(learners.map((l) => [l.id, l]));

  const subjectName = new Map(listSubjects().map((s) => [s.id, s.name]));
  const skillName = new Map(listSkills().map((s) => [s.id, s.name]));

  const feed = learners
    .flatMap((l) => listLessonRunsForLearner(l.id, session.tenantId, { limit: FEED_LIMIT }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, FEED_LIMIT);

  let emptyState: React.ReactNode = null;
  if (learners.length === 0) {
    emptyState = (
      <EmptyState
        title="No learners yet"
        description="Observations populate once a parent invites you to a learner's care team."
      />
    );
  } else if (feed.length === 0) {
    emptyState = (
      <EmptyState
        title="No lesson activity yet"
        description="Once a learner you support starts a lesson, the observation lands here."
      />
    );
  }

  return (
    <AppShell
      role="caregiver"
      roleLabel="Caregiver"
      navItems={CAREGIVER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Caregiver"
        title="Observations"
        description="Recent lesson activity across the learners you support."
      />

      <SectionHeader title={`Activity feed (${feed.length})`} />
      {emptyState ?? (
        <ul className="flex flex-col gap-3">
          {feed.map((run) => {
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
                      {skillName.get(run.skillId) ?? "Skill"} · {formatWhen(run.createdAt)}
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
