/**
 * Sprint 30: Teacher · AI lesson plans.
 * Lists every AI-generated lesson plan reachable from this teacher's tenants,
 * plus a recent activity feed from the AI generation telemetry. Mirrors the
 * legacy `/dashboard/teacher/lesson-plans` page.
 */
import Link from "next/link";
import { Sparkles, FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { listLearnersForTeacher } from "@/lib/db/repos";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LessonPreviewCard } from "@aivo/ui";
import { getStore as db } from "@/lib/db/store";
import { listAiGenerationJobs } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherLessonPlansPage() {
  const session = await requirePageRole(["teacher"]);
  const t = await getTranslations("teacher.lesson_plans");
  const tenantId = session.tenantId;
  const store = db();

  // Scope to classroom learners only — a teacher should not see lesson plans
  // for learners in other classrooms within the same school tenant.
  const teacherLearners = await listLearnersForTeacher(session.userId, tenantId);
  const learnerIds = new Set(teacherLearners.map((l) => l.id));
  const allowedRunIds = new Set(
    Array.from(store.lessonRuns.values())
      .filter((r) => r.tenantId === tenantId && learnerIds.has(r.learnerId))
      .map((r) => r.id),
  );

  const plans = Array.from(store.generatedLessonPlans.values())
    .filter((p) => p.tenantId === tenantId && allowedRunIds.has(p.lessonRunId))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, 30);

  const jobs = (await listAiGenerationJobs([tenantId], 20)).filter((j) => j.kind === "lesson_plan");

  const completeCount = jobs.filter((j) => j.status === "complete").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const runningCount = jobs.filter((j) => j.status === "running" || j.status === "queued").length;

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Teacher"
        title={t("page_title")}
        description="Lesson plans generated from each learner's brain profile and current mastery. Differentiated by functioning level."
        actions={
          <Button asChild>
            <Link href="/teacher/assignments/new">
              <Sparkles className="mr-1 h-4 w-4" /> {t("new_assignment")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-ink-muted">
            {t("generated_recent")}
          </p>
          <p className="mt-1 font-display text-3xl font-semibold">{plans.length}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-ink-muted">
            {t("ai_jobs")}
          </p>
          <p className="mt-1 font-display text-3xl font-semibold">{completeCount}</p>
          <p className="mt-1 text-xs text-iw-ink-muted">
            {runningCount} running · {failedCount} failed
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-ink-muted">
            {t("fallback_chain")}
          </p>
          <p className="mt-1 text-sm font-medium">{t("fallback_primary_model")}</p>
          <p className="text-xs text-iw-ink-muted">→ Gemini 3.0 Pro → GPT-5.5</p>
        </Card>
      </div>

      <SectionHeader title={t("latest_lesson_plans")} />
      {plans.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t("no_lesson_plans_yet")}
          description="Lesson plans are generated automatically when a learner starts a session. Plans will appear here once your classroom is active."
        />
      ) : (
        <ul className="grid gap-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <LessonPreviewCard
                skillName={plan.title}
                summary={plan.storyHook ?? plan.objective}
                state="pending"
                estimateMinutes={plan.estimatedMinutes}
                sources={[
                  `${plan.generation.provider} · ${plan.generation.model}`,
                  plan.tutorPersona,
                ]}
                accommodations={
                  plan.accessibilitySupports.length > 0
                    ? plan.accessibilitySupports.slice(0, 4).map((a) => String(a))
                    : undefined
                }
                actions={
                  <span className="text-xs text-iw-text-muted">
                    Generated {new Date(plan.generatedAt).toLocaleString()}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <SectionHeader title={t("generation_activity")} />
      {jobs.length === 0 ? (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-sm text-iw-ink-muted">{t("no_ai_jobs")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-iw-raised text-xs uppercase tracking-wide text-iw-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left">{t("col_started")}</th>
                <th className="px-4 py-2 text-left">Input</th>
                <th className="px-4 py-2 text-left">{t("col_status")}</th>
                <th className="px-4 py-2 text-left">{t("col_completed")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-iw-border">
                  <td className="px-4 py-2 font-mono text-xs">
                    {new Date(job.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{job.inputRef}</td>
                  <td className="px-4 py-2">
                    <Badge
                      tone={
                        job.status === "complete"
                          ? "success"
                          : job.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-iw-ink-muted">
                    {job.completedAt ? new Date(job.completedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
