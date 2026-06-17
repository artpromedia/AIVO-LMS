/**
 * Sprint 18: Teacher learner detail. Shows recent lessons, skill mastery,
 * accommodations (teacher-safe summary only — raw IEP text is NEVER rendered
 * here), and active assignments. Tenant-scoped: a teacher visiting a learner
 * from another tenant gets a 404.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PendingRecommendationsPanel } from "@/components/parent/pending-recommendations-panel";
import {
  ContributorContributionsCard,
  buildContributorCardCopy,
} from "@/components/collaboration/contributor-contributions-card";
import { getContributorLearnerSummaries } from "@/lib/collaboration/contributor-summary";
import {
  getIEPForLearner,
  getLearner,
  getMasteryMap,
  listActiveAssignmentsForLearner,
  listLessonRunsForLearner,
  listSkills,
  listSubjects,
  findTeacherAssessmentDraft,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherLearnerDetailPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const t = await getTranslations("teacher.learner_overview");
  const ta = await getTranslations("teacher.learner_assessment");
  const tTeam = await getTranslations("teacher.learner_team");
  const tContrib = await getTranslations("contributor");
  const { learnerId } = await params;
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  // C-16 — this teacher's own "Your contributions" summary, scoped to the
  // learner being viewed (own items only; derived server-side).
  const contributorSummaries = (
    await getContributorLearnerSummaries({
      role: "teacher",
      tenantId: session.tenantId,
      contributorUserId: session.userId,
      contributorEmail: session.email,
    })
  ).filter((s) => s.learnerId === learnerId);

  // C-07 entry point: surface the teacher assessment CTA with resume/done
  // state from the teacher's own draft.
  const taDraft = await findTeacherAssessmentDraft(learnerId, session.tenantId, session.userId);
  const taSubmitted = Boolean(taDraft?.submittedAt);
  const taInProgress =
    !taSubmitted &&
    Boolean(taDraft && Object.values(taDraft.answers ?? {}).some((v) => v && Object.keys(v).length > 0));
  const taHref = taInProgress
    ? `/teacher/learners/${learner.id}/assessment?step=1`
    : `/teacher/learners/${learner.id}/assessment/intro`;

  const recent = await listLessonRunsForLearner(learnerId, session.tenantId, { limit: 10 });
  const { skillMasteries } = await getMasteryMap(learnerId, session.tenantId);
  const iep = await getIEPForLearner(learnerId, session.tenantId);
  const assignments = await listActiveAssignmentsForLearner(learnerId, session.tenantId);
  const subjectsById = new Map((await listSubjects()).map((s) => [s.id, s]));
  const skillsById = new Map((await listSkills()).map((s) => [s.id, s]));

  // Skill gaps = lowest mastery (≤ 0.5).
  const gaps = skillMasteries
    .filter((s) => s.score <= 0.5)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Learner"
        title={learner.displayName}
        description={`Functioning level ${learner.functioningLevel} · ${learner.readinessState}`}
      />

      <Card
        className={`p-4 ${taSubmitted ? "border-iw-success bg-iw-success-subtle/40" : "border-iw-warm/40 bg-iw-warm/5"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold">
                {taSubmitted
                  ? ta("cta_done")
                  : ta("cta_title", { name: learner.displayName })}
              </p>
              {taSubmitted ? <Badge tone="success">{ta("cta_done")}</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {taSubmitted ? ta("cta_done_body") : ta("cta_body", { name: learner.displayName })}
            </p>
          </div>
          <Link
            href={taHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-iw-warm px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {taSubmitted ? ta("entry_update") : taInProgress ? ta("cta_resume") : ta("cta_action")}
          </Link>
        </div>
      </Card>

      {/* C-16 — the teacher learns whether their input is now in use. */}
      <ContributorContributionsCard
        summaries={contributorSummaries}
        copy={buildContributorCardCopy(tContrib)}
      />

      <Link href={`/teacher/learners/${learner.id}/curriculum`}>
        <Card className="p-4 transition hover:border-iw-warm">
          <p className="font-medium">{t("this_week_at_school")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add the week&apos;s scope so AIVO&apos;s tutor teaches the same topics, fitted to this
            learner&apos;s profile.
          </p>
        </Card>
      </Link>

      {/* Build the team: invite the child's caregivers and related-service
          therapists so their read shapes the learning profile too. */}
      <Link href={`/teacher/learners/${learner.id}/team`}>
        <Card className="p-4 transition hover:border-iw-warm">
          <p className="font-medium">{tTeam("card_title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tTeam("card_body", { name: learner.displayName })}
          </p>
        </Card>
      </Link>

      <section className="grid gap-3">
        <SectionHeader title={t("active_assignments")} />
        {assignments.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">{t("no_active_assignments")}</Card>
        ) : (
          <ul className="grid gap-2">
            {assignments.map((a) => (
              <li key={a.id}>
                <Card className="p-4">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(a.createdAt).toLocaleDateString()}
                    {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 mt-6">
        <SectionHeader title={t("recent_lessons")} />
        {recent.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">{t("no_lessons_started")}</Card>
        ) : (
          <ul className="grid gap-2">
            {recent.map((r) => {
              const subj = subjectsById.get(r.subjectId);
              const skill = skillsById.get(r.skillId);
              return (
                <li key={r.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {subj?.name ?? r.subjectId} · {skill?.name ?? r.skillId}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {r.source} · started{" "}
                          {r.startedAt ? new Date(r.startedAt).toLocaleString() : "not yet"}
                        </p>
                      </div>
                      <Badge tone={r.status === "completed" ? "success" : "neutral"}>
                        {r.status}
                      </Badge>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-3 mt-6">
        <SectionHeader title={t("skill_gaps")} />
        {gaps.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">{t("no_notable_gaps")}</Card>
        ) : (
          <ul className="grid gap-2">
            {gaps.map((m) => {
              const skill = skillsById.get(m.skillId);
              return (
                <li key={m.skillId}>
                  <Card className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">{skill?.name ?? m.skillId}</p>
                      <Badge tone="warning">{Math.round(m.score * 100)}%</Badge>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {iep?.extraction && (
        <section className="grid gap-3 mt-6">
          <SectionHeader title={t("accommodations_teacher_summary")} />
          <Card className="p-4">
            {/*
              SAFETY: We render only `teacherSummary` + the structured
              accommodations list. The raw IEP text and parent/learner
              summaries are intentionally NOT shown to teachers.
            */}
            <p className="text-sm">{iep.extraction.teacherSummary}</p>
            {iep.extraction.accommodations.length > 0 && (
              <ul className="mt-3 grid gap-1 text-sm list-disc pl-5">
                {iep.extraction.accommodations.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}

      {/* Wave C (G5): teacher approval surface. recommendation-svc enforces
          the district's delegation policy — decisions outside it 403 with a
          clear message, so this panel is safe to show unconditionally. */}
      <section className="grid gap-3 mt-6">
        <SectionHeader title={t("pending_recommendations")} />
        <PendingRecommendationsPanel
          learnerId={learner.id}
          apiBase={`/api/bff/teacher/learners/${learner.id}/recommendations`}
        />
      </section>
    </AppShell>
  );
}
