/**
 * Caregiver observations — Sprint 10 expands the previous read-only
 * lesson-activity feed to also surface caregiver-AUTHORED observations
 * (ABC: antecedent / behaviour / consequence + duration + location)
 * and adds an authoring form that POSTs to
 * /api/bff/caregiver/observations.
 */
import * as React from "react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import {
  getLearner,
  listCaregiverObservations,
  listLessonRunsForLearner,
  listSkills,
  listSubjects,
} from "@/lib/db/repos";
import type { LearnerProfile, LessonRun } from "@/lib/db/types";
import { CaregiverObservationForm } from "./observation-form";

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
  const t = await getTranslations("caregiver.observations");
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "caregiver");
  const maybeLearners = await Promise.all(learnerIds.map((id) => getLearner(id, session.tenantId)));
  const learners = maybeLearners.filter((l): l is LearnerProfile => Boolean(l));
  const learnerById = new Map(learners.map((l) => [l.id, l]));

  const subjectName = new Map((await listSubjects()).map((s) => [s.id, s.name]));
  const skillName = new Map((await listSkills()).map((s) => [s.id, s.name]));

  // Sprint 10 — caregiver-authored observations across every learner
  // they support, newest-first. Joined with the lesson activity feed
  // below; the two surfaces stay distinct because they tell different
  // stories (behaviour vs. lesson completion).
  const authored = learners
    .flatMap((l) => listCaregiverObservations(l.id, session.tenantId, 20))
    .sort((a, b) => (a.observedAt < b.observedAt ? 1 : -1))
    .slice(0, 20);

  const runBatches = await Promise.all(
    learners.map((l) => listLessonRunsForLearner(l.id, session.tenantId, { limit: FEED_LIMIT })),
  );
  const feed = runBatches
    .flat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, FEED_LIMIT);

  const noLearners = learners.length === 0;

  return (
    <AppShell
      role="caregiver"
      roleLabel="Caregiver"
      navItems={CAREGIVER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Caregiver"
        title={t("page_title")}
        description="What you've noticed about the learners you support — plus their recent lesson activity."
      />

      <SectionHeader title={t("section_log")} />
      {noLearners ? (
        <EmptyState
          title={t("no_learners_yet")}
          description="Observations populate once a parent invites you to a learner's care team."
        />
      ) : (
        <CaregiverObservationForm
          learners={learners.map((l) => ({ id: l.id, name: l.displayName }))}
        />
      )}

      <SectionHeader title={`Your observations (${authored.length})`} />
      {authored.length === 0 ? (
        <p className="text-sm text-aivo-ink-soft">{t("no_observations_yet")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {authored.map((obs) => {
            const learner = learnerById.get(obs.learnerId);
            return (
              <li key={obs.id}>
                <Card className="flex flex-col gap-1 p-4">
                  <p className="text-sm font-semibold">
                    {learner?.displayName ?? "Learner"} ·{" "}
                    <span className="text-aivo-ink-soft">{obs.location}</span>
                  </p>
                  <p className="text-xs text-aivo-ink-soft">
                    {formatWhen(obs.observedAt)}
                    {obs.durationMinutes !== null ? ` · ${obs.durationMinutes} min` : ""}
                  </p>
                  <dl className="mt-2 grid grid-cols-1 gap-1 text-sm md:grid-cols-3">
                    <div>
                      <dt className="iw-label text-aivo-ink-soft">{t("label_antecedent")}</dt>
                      <dd>{obs.antecedent || "—"}</dd>
                    </div>
                    <div>
                      <dt className="iw-label text-aivo-ink-soft">{t("label_behaviour")}</dt>
                      <dd className="font-medium">{obs.behaviour}</dd>
                    </div>
                    <div>
                      <dt className="iw-label text-aivo-ink-soft">{t("label_consequence")}</dt>
                      <dd>{obs.consequence || "—"}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <SectionHeader title={`Lesson activity (${feed.length})`} />
      {feed.length === 0 ? (
        <EmptyState
          title={t("no_lesson_activity_yet")}
          description="Once a learner you support starts a lesson, it lands here."
        />
      ) : (
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
                  <Badge tone={statusTone(run.status)}>{run.status.replaceAll("_", " ")}</Badge>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
