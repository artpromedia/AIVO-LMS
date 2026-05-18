/**
 * Sprint 30: Teacher · AI lesson plans.
 * Lists every AI-generated lesson plan reachable from this teacher's tenants,
 * plus a recent activity feed from the AI generation telemetry. Mirrors the
 * legacy `/dashboard/teacher/lesson-plans` page.
 */
import Link from "next/link";
import { Sparkles, FileText } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { listLearnersForTeacher } from "@/lib/db/repos";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore as db } from "@/lib/db/store";
import { listAiGenerationJobs } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherLessonPlansPage() {
  const session = await requirePageRole(["teacher"]);
  const tenantId = session.tenantId;
  const store = db();

  // Scope to classroom learners only — a teacher should not see lesson plans
  // for learners in other classrooms within the same school tenant.
  const learnerIds = new Set(listLearnersForTeacher(session.userId, tenantId).map((l) => l.id));
  const allowedRunIds = new Set(
    Array.from(store.lessonRuns.values())
      .filter((r) => r.tenantId === tenantId && learnerIds.has(r.learnerId))
      .map((r) => r.id),
  );

  const plans = Array.from(store.generatedLessonPlans.values())
    .filter((p) => p.tenantId === tenantId && allowedRunIds.has(p.lessonRunId))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, 30);

  const jobs = listAiGenerationJobs([tenantId], 20).filter((j) => j.kind === "lesson_plan");

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
        title="AI lesson plans"
        description="Lesson plans generated from each learner's brain profile and current mastery. Differentiated by functioning level."
        actions={
          <Button asChild>
            <Link href="/teacher/assignments/new">
              <Sparkles className="mr-1 h-4 w-4" /> New assignment
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            Generated (recent)
          </p>
          <p className="mt-1 font-display text-3xl font-semibold">{plans.length}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">AI jobs</p>
          <p className="mt-1 font-display text-3xl font-semibold">{completeCount}</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">
            {runningCount} running · {failedCount} failed
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            Fallback chain
          </p>
          <p className="mt-1 text-sm font-medium">Claude Opus 4.7</p>
          <p className="text-xs text-aivo-ink-soft">→ Gemini 3.0 Pro → GPT-5.5</p>
        </Card>
      </div>

      <SectionHeader title="Latest lesson plans" />
      {plans.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No lesson plans yet"
          description="Lesson plans are generated automatically when a learner starts a session. Plans will appear here once your classroom is active."
        />
      ) : (
        <ul className="grid gap-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Card className="p-[var(--aivo-density-card-pad)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{plan.title}</p>
                    <p className="mt-0.5 text-sm text-aivo-ink-soft">{plan.objective}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge tone="neutral">{plan.estimatedMinutes} min</Badge>
                      <Badge tone="neutral">{plan.tutorPersona}</Badge>
                      <Badge tone="primary">
                        {plan.generation.provider} · {plan.generation.model}
                      </Badge>
                      {plan.accessibilitySupports.length > 0 ? (
                        <Badge tone="success">
                          {plan.accessibilitySupports.length} access supports
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-xs text-aivo-ink-soft">
                    {new Date(plan.generatedAt).toLocaleString()}
                  </div>
                </div>
                <p className="mt-3 text-sm text-aivo-ink-soft line-clamp-2">{plan.storyHook}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SectionHeader title="Generation activity" />
      {jobs.length === 0 ? (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-sm text-aivo-ink-soft">No AI generation jobs in this window.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-soft text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-2 text-left">Started</th>
                <th className="px-4 py-2 text-left">Input</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Completed</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-aivo-border">
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
                  <td className="px-4 py-2 font-mono text-xs text-aivo-ink-soft">
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
