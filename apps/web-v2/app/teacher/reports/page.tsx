/**
 * Sprint 30: Teacher · Reports.
 * Classroom progress reports — mastery aggregates per learner, distribution
 * across mastery levels, and IEP/accommodation flags. Mirrors the legacy
 * `/dashboard/teacher/reports` page.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore as db } from "@/lib/db/store";
import { getIEPForLearner, getMasteryMap, listLearnersForTeacher } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherReportsPage() {
  const session = await requirePageRole(["teacher"]);
  const store = db();
  const learners = await listLearnersForTeacher(session.userId, session.tenantId);

  const rows = learners.map((learner) => {
    const { skillMasteries } = getMasteryMap(learner.id, session.tenantId);
    const skillsCount = skillMasteries.length;
    const total = skillMasteries.reduce((acc, s) => acc + s.score, 0);
    const avg = skillsCount > 0 ? total / skillsCount : 0;
    const onGrade = skillMasteries.filter(
      (s) => s.level === "on_grade_level" || s.level === "stretching",
    ).length;
    const emerging = skillMasteries.filter(
      (s) => s.level === "emerging" || s.level === "approaching",
    ).length;
    const iep = getIEPForLearner(learner.id, session.tenantId);
    return { learner, avg, skillsCount, onGrade, emerging, iep };
  });

  const classroomAvg = rows.length > 0 ? rows.reduce((acc, r) => acc + r.avg, 0) / rows.length : 0;
  const learnersWithIep = rows.filter((r) => r.iep).length;
  const learnersOnTrack = rows.filter((r) => r.avg >= 0.7 && r.skillsCount > 0).length;

  // Distribution across mastery buckets.
  const distribution: Array<{ label: string; count: number }> = [
    { label: "Stretching", count: 0 },
    { label: "On grade level", count: 0 },
    { label: "Approaching", count: 0 },
    { label: "Emerging", count: 0 },
    { label: "Not started", count: 0 },
  ];
  for (const learner of learners) {
    const { skillMasteries } = getMasteryMap(learner.id, session.tenantId);
    for (const sm of skillMasteries) {
      const idx =
        sm.level === "stretching"
          ? 0
          : sm.level === "on_grade_level"
            ? 1
            : sm.level === "approaching"
              ? 2
              : sm.level === "emerging"
                ? 3
                : 4;
      distribution[idx]!.count += 1;
    }
  }
  const distTotal = distribution.reduce((a, b) => a + b.count, 0);

  // Find classrooms this teacher leads for the header link.
  const classrooms = Array.from(store.classrooms.values()).filter(
    (c) => c.teacherUserId === session.userId,
  );

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Teacher"
        title="Classroom reports"
        description="Mastery aggregates and IEP flags across every learner you support."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">Learners</p>
          <p className="mt-1 font-display text-3xl font-semibold">{learners.length}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            Class mastery
          </p>
          <p className="mt-1 font-display text-3xl font-semibold">
            {Math.round(classroomAvg * 100)}%
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">On track</p>
          <p className="mt-1 font-display text-3xl font-semibold">{learnersOnTrack}</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">Avg ≥ 70% mastery</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            IEPs on file
          </p>
          <p className="mt-1 font-display text-3xl font-semibold">{learnersWithIep}</p>
        </Card>
      </div>

      <SectionHeader title="Mastery distribution" />
      {distTotal === 0 ? (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-sm text-aivo-ink-soft">
            No mastery data yet — once learners complete baselines, distribution will populate.
          </p>
        </Card>
      ) : (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <div className="space-y-2">
            {distribution.map((b) => {
              const pct = distTotal > 0 ? Math.round((b.count / distTotal) * 100) : 0;
              return (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-xs text-aivo-ink-soft">
                    <span>{b.label}</span>
                    <span>
                      {b.count} skill{b.count === 1 ? "" : "s"} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-aivo-border">
                    <div className="h-2 rounded-full bg-aivo-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <SectionHeader title="Learner roll-up" />
      {rows.length === 0 ? (
        <EmptyState
          title="No learners assigned"
          description={
            classrooms.length === 0
              ? "Once your school admin assigns you to a classroom, learners will appear here."
              : "Your classroom is empty — ask your admin to enroll learners."
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-soft text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-2 text-left">Learner</th>
                <th className="px-4 py-2 text-right">Skills</th>
                <th className="px-4 py-2 text-right">Avg mastery</th>
                <th className="px-4 py-2 text-right">On grade</th>
                <th className="px-4 py-2 text-right">Emerging</th>
                <th className="px-4 py-2 text-left">IEP</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => b.avg - a.avg)
                .map((r) => (
                  <tr key={r.learner.id} className="border-t border-aivo-border">
                    <td className="px-4 py-2 font-medium">{r.learner.displayName}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.skillsCount}</td>
                    <td className="px-4 py-2 text-right font-mono">{Math.round(r.avg * 100)}%</td>
                    <td className="px-4 py-2 text-right font-mono">{r.onGrade}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.emerging}</td>
                    <td className="px-4 py-2">
                      {r.iep ? (
                        <Badge tone="primary">On file</Badge>
                      ) : (
                        <Badge tone="neutral">—</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/teacher/learners/${r.learner.id}`}
                        className="text-aivo-accent underline underline-offset-4"
                      >
                        Open
                      </Link>
                      {r.iep ? (
                        <>
                          {" · "}
                          <Link
                            href={`/teacher/learners/${r.learner.id}/iep/draft`}
                            className="text-aivo-accent underline underline-offset-4"
                          >
                            Goals
                          </Link>
                        </>
                      ) : null}
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
