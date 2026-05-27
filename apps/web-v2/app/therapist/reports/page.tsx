/**
 * Therapist reports — caseload mastery snapshot. For every learner the
 * therapist supports, summarises skill coverage (skills tracked, average
 * score, highest level reached, top focus area). Built from MasteryMap
 * data already maintained by the lesson pipeline.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner, getMasteryMap, listSkills } from "@/lib/db/repos";
import type { LearnerProfile, SkillMastery } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const LEVEL_ORDER: SkillMastery["level"][] = [
  "not_started",
  "emerging",
  "approaching",
  "on_grade_level",
  "stretching",
];

function highestLevel(masteries: SkillMastery[]): SkillMastery["level"] {
  let best: SkillMastery["level"] = "not_started";
  for (const m of masteries) {
    if (LEVEL_ORDER.indexOf(m.level) > LEVEL_ORDER.indexOf(best)) best = m.level;
  }
  return best;
}

function levelTone(level: SkillMastery["level"]) {
  switch (level) {
    case "stretching":
    case "on_grade_level":
      return "success" as const;
    case "approaching":
      return "primary" as const;
    case "emerging":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function formatLevel(level: SkillMastery["level"]): string {
  return level.replaceAll("_", " ");
}

export default async function TherapistReportsPage() {
  const session = await requirePageRole(["therapist", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "therapist");
  const maybeLearners = await Promise.all(
    learnerIds.map((id) => getLearner(id, session.tenantId)),
  );
  const learners = maybeLearners.filter((l): l is LearnerProfile => Boolean(l));

  const skillNameById = new Map((await listSkills()).map((s) => [s.id, s.name]));

  const rows = await Promise.all(
    learners.map(async (l) => {
      const { skillMasteries } = await getMasteryMap(l.id, session.tenantId);
      const tracked = skillMasteries.length;
      const avg =
        tracked > 0
          ? skillMasteries.reduce((sum, m) => sum + m.score, 0) / tracked
          : 0;
      const focus = skillMasteries.slice().sort((a, b) => a.score - b.score)[0] ?? null;
      return {
        learner: l,
        tracked,
        avg,
        level: highestLevel(skillMasteries),
        focusSkillName: focus ? (skillNameById.get(focus.skillId) ?? null) : null,
        focusScore: focus?.score ?? null,
      };
    }),
  );

  return (
    <AppShell
      role="therapist"
      roleLabel="Therapist"
      navItems={THERAPIST_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Therapist"
        title="Reports"
        description="Mastery snapshot for every learner on your caseload."
      />

      <SectionHeader title={`Caseload (${rows.length})`} />
      {rows.length === 0 ? (
        <EmptyState
          title="No caseload yet"
          description="Once a parent invites you to a learner's care team, that learner's report appears here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.learner.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold">{r.learner.displayName}</p>
                  <p className="mt-0.5 text-xs text-aivo-ink-soft">
                    {r.learner.gradeBand ? `Grade ${r.learner.gradeBand}` : "Grade not set"}
                  </p>
                  {r.focusSkillName ? (
                    <p className="mt-1 text-xs text-aivo-ink-soft">
                      Focus: <span className="text-iw-ink">{r.focusSkillName}</span>
                      {r.focusScore === null ? "" : ` (${Math.round(r.focusScore * 100)}%)`}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <div className="text-right">
                    <p className="text-xs text-aivo-ink-soft">Skills tracked</p>
                    <p className="text-base font-semibold">{r.tracked}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-aivo-ink-soft">Avg score</p>
                    <p className="text-base font-semibold">
                      {r.tracked > 0 ? `${Math.round(r.avg * 100)}%` : "—"}
                    </p>
                  </div>
                  <Badge tone={levelTone(r.level)}>{formatLevel(r.level)}</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
