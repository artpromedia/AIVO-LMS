/**
 * Sprint 10: Learner progress redesign — calm soft chart panels.
 *
 * Reuses @aivo/ui/chart primitives (SoftLine, DotChart,
 * MasteryHeatStrip, ProgressCurve) so the analytics feel premium,
 * accessible, and consistent with the reference's dashboard
 * language. No dense spreadsheet rows.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  FloatingMetricCard,
  GlassCard,
  InsightChip,
  EmptyState,
  SoftLine,
  DotChart,
  MasteryHeatStrip,
  ProgressCurve,
  type MasteryCell,
} from "@aivo/ui";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  getLearner,
  getMasteryMap,
  listLessonRunsForLearner,
  listSkills,
  listSubjects,
} from "@/lib/db/repos";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";

function levelToMasteryCell(level: string): MasteryCell["level"] {
  switch (level) {
    case "stretching":
      return "mastered";
    case "on_grade_level":
      return "proficient";
    case "approaching":
      return "developing";
    case "emerging":
      return "emerging";
    default:
      return "emerging";
  }
}

function masteryLabel(score: number, t: (key: string) => string): string {
  if (score >= 0.85) return t("mastery_strong");
  if (score >= 0.65) return t("mastery_on_grade");
  if (score >= 0.4) return t("mastery_building");
  if (score > 0) return t("mastery_just_starting");
  return t("mastery_not_started");
}

export default async function LearnerProgressPage() {
  const session = await requirePageRole(["learner", "parent"]);
  const t = await getTranslations("learner.progress");
  const learnerId =
    session.role === "learner"
      ? (session.learnerId ?? null)
      : await readActiveLearnerFromCookies(session);
  if (!learnerId) redirect(session.role === "parent" ? "/learner/select" : "/login");
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) redirect("/login");

  const { map, skillMasteries } = await getMasteryMap(learnerId, session.tenantId);
  const allSubjects = await listSubjects();
  const subjects = await Promise.all(
    allSubjects.map(async (s) => ({
      ...s,
      skills: await listSkills(s.id),
    })),
  );
  const recentRuns = await listLessonRunsForLearner(learnerId, session.tenantId, {
    limit: 14,
  });

  const skillNames = new Map<string, string>();
  for (const subj of subjects) {
    for (const sk of subj.skills) skillNames.set(sk.id, sk.name);
  }

  const bySubject = new Map<string, typeof skillMasteries>();
  for (const m of skillMasteries) {
    const arr = bySubject.get(m.subjectId) ?? [];
    arr.push(m);
    bySubject.set(m.subjectId, arr);
  }

  // Aggregate metrics for the floating chips.
  const overallAvg =
    skillMasteries.length === 0
      ? 0
      : skillMasteries.reduce((a, m) => a + m.score, 0) / skillMasteries.length;
  const masteredCount = skillMasteries.filter((m) => m.score >= 0.85).length;
  const needsSupportCount = skillMasteries.filter((m) => m.score < 0.4 && m.score > 0).length;

  // Lesson-completion trend by day (last 14 entries).
  const runsByDate = new Map<string, number>();
  for (const r of recentRuns) {
    const d = new Date(r.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    runsByDate.set(d, (runsByDate.get(d) ?? 0) + 1);
  }
  const trendPoints = Array.from(runsByDate.entries())
    .reverse()
    .map(([label, value]) => ({ label, value }));

  // Per-subject mastery dots.
  const subjectDots = subjects.map((s) => {
    const masteries = bySubject.get(s.id) ?? [];
    const avg =
      masteries.length === 0 ? 0 : masteries.reduce((a, m) => a + m.score, 0) / masteries.length;
    return {
      label: s.name.slice(0, 8),
      value: Math.round(avg * 100),
    };
  });

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">{t("eyebrow")}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          {t("title", { name: learner.preferredName || learner.firstName })}
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          {t("description")}
        </p>
      </header>

      {!map ? (
        <div className="rounded-iw-card-lg border border-iw-border bg-white p-6">
          <EmptyState
            title={t("empty_title")}
            body={t("empty_body")}
            action={
              <Link
                href={session.role === "parent" ? `/parent/learners/${learnerId}` : "/learner/baseline"}
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                {session.role === "parent" ? t("empty_cta_parent") : t("empty_cta_learner")}
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FloatingMetricCard
              label={t("metric_overall")}
              value={`${Math.round(overallAvg * 100)}%`}
              description={masteryLabel(overallAvg, t)}
              tone="success"
            />
            <FloatingMetricCard
              label={t("metric_mastered")}
              value={`${masteredCount}`}
              description={t("metric_of", { count: skillMasteries.length })}
              tone="info"
            />
            <FloatingMetricCard
              label={t("metric_needs")}
              value={`${needsSupportCount}`}
              description={needsSupportCount === 0 ? t("needs_zero") : t("needs_some")}
              tone={needsSupportCount === 0 ? "success" : "warning"}
            />
            <FloatingMetricCard
              label={t("metric_recent")}
              value={`${recentRuns.length}`}
              description={t("recent_desc")}
              tone="neutral"
            />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr,1fr]">
            <GlassCard
              elevation="raised"
              density="comfortable"
              title={t("lessons_completed")}
              description={t("last_14")}
            >
              {trendPoints.length > 0 ? (
                <SoftLine data={trendPoints} ariaLabel={t("lessons_aria")} filled />
              ) : (
                <p className="text-sm text-iw-text-muted">
                  {t("no_lessons_waiting")}
                </p>
              )}
            </GlassCard>
            <GlassCard
              elevation="raised"
              density="comfortable"
              title={t("mastery_by_subject")}
              description={t("dot_view_desc")}
            >
              <DotChart data={subjectDots} ariaLabel={t("mastery_by_subject")} />
            </GlassCard>
          </section>

          <section className="mt-6 flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-iw-text-strong">{t("skill_map")}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {subjects.map((subj) => {
                const masteries = bySubject.get(subj.id) ?? [];
                const avg =
                  masteries.length === 0
                    ? 0
                    : masteries.reduce((a, m) => a + m.score, 0) / masteries.length;
                const cells: MasteryCell[] = masteries.slice(0, 16).map((m) => ({
                  code: skillNames.get(m.skillId)?.slice(0, 12) ?? m.skillId.slice(0, 12),
                  level: levelToMasteryCell(m.level),
                }));
                return (
                  <GlassCard
                    key={subj.id}
                    elevation="raised"
                    density="comfortable"
                  >
                    <header className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-base font-semibold text-iw-text-strong">{subj.name}</h3>
                      <InsightChip
                        tone={avg >= 0.65 ? "success" : avg >= 0.4 ? "primary" : "warning"}
                        size="md"
                      >
                        {Math.round(avg * 100)}% · {masteryLabel(avg, t)}
                      </InsightChip>
                    </header>
                    {cells.length === 0 ? (
                      <p className="text-sm text-iw-text-muted">{t("no_mastery_data")}</p>
                    ) : (
                      <>
                        <MasteryHeatStrip cells={cells} ariaLabel={t("heat_aria", { name: subj.name })} />
                        <ProgressCurve value={avg} className="mt-3" />
                      </>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          </section>

          <section className="mt-6 flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-iw-text-strong">{t("recent_lessons")}</h2>
            {recentRuns.length === 0 ? (
              <p className="rounded-iw-card-lg bg-white border border-iw-border p-5 text-sm text-iw-text-muted">
                {t("no_lessons_home")}
              </p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {recentRuns.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-iw-card-lg bg-white border border-iw-border p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-iw-text-strong truncate">
                        {skillNames.get(r.skillId) ?? r.skillId}
                      </p>
                      <p className="text-xs text-iw-text-muted">
                        {r.source.replace(/_/g, " ")} ·{" "}
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <InsightChip
                      tone={
                        r.status === "completed"
                          ? "success"
                          : r.status === "in_progress"
                            ? "primary"
                            : r.status === "failed"
                              ? "warning"
                              : "neutral"
                      }
                      size="sm"
                    >
                      {r.status.replace(/_/g, " ")}
                    </InsightChip>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
