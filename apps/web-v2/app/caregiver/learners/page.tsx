/**
 * Caregiver learners — full roster for every learner whose care team has
 * invited the signed-in caregiver. Shows each learner's profile snapshot
 * (grade band, age range, language, comfort levels, strengths) and the
 * current readiness state.
 */
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner } from "@/lib/db/repos";
import type { LearnerProfile } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function readinessTone(state: LearnerProfile["readinessState"]) {
  switch (state) {
    case "active_learning":
    case "ready_for_today_mission":
      return "success" as const;
    case "assessment_needed":
    case "baseline_needed":
    case "iep_optional":
    case "brain_clone_review_needed":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function formatReadiness(state: LearnerProfile["readinessState"]): string {
  return state.replaceAll("_", " ");
}

export default async function CaregiverLearnersPage() {
  const t = await getTranslations("caregiver.learners");
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "caregiver");
  const maybeLearners = await Promise.all(
    learnerIds.map((id) => getLearner(id, session.tenantId)),
  );
  const learners = maybeLearners.filter((l): l is LearnerProfile => Boolean(l));

  return (
    <AppShell
      role="caregiver"
      roleLabel="Caregiver"
      navItems={CAREGIVER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Caregiver"
        title={t("title")}
        description="Every learner whose care team has invited you."
      />

      <SectionHeader title={`Your roster (${learners.length})`} />
      {learners.length === 0 ? (
        <EmptyState
          title={t("no_learners_yet")}
          description="When a parent invites you and you accept, the learners you support appear here."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {learners.map((l) => (
            <li key={l.id}>
              <Card className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{l.displayName}</p>
                    <p className="mt-0.5 text-xs text-aivo-ink-soft">
                      {l.gradeBand ? `Grade ${l.gradeBand}` : "Grade not set"}
                      {l.ageRange ? ` · ${l.ageRange}` : ""}
                    </p>
                  </div>
                  <Badge tone={readinessTone(l.readinessState)}>
                    {formatReadiness(l.readinessState)}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-y-1 text-xs text-aivo-ink-soft">
                  <dt>{t("primary_language")}</dt>
                  <dd className="text-right text-iw-ink">{l.primaryLanguage ?? "—"}</dd>
                  <dt>{t("reading_comfort")}</dt>
                  <dd className="text-right text-iw-ink">{l.readingComfort ?? "—"}</dd>
                  <dt>{t("math_comfort")}</dt>
                  <dd className="text-right text-iw-ink">{l.mathComfort ?? "—"}</dd>
                </dl>
                {l.knownStrengths.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {l.knownStrengths.slice(0, 3).map((s) => (
                      <Badge key={s} tone="primary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
