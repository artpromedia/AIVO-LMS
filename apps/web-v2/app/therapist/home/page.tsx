/**
 * Therapist home — caseload dashboard for the therapist role.
 *
 * Therapists are added via the parent care-team invite flow
 * (`/parent/learners/[learnerId]/team`) and route here after accepting an
 * invite.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getIEPForLearner, getLearner, refreshLearnerReadiness } from "@/lib/db/repos";
import type { LearnerProfile } from "@/lib/db/types";
import { READINESS_LABEL, READINESS_TONE } from "@/lib/learner/readiness";

export const dynamic = "force-dynamic";

export default async function TherapistHomePage() {
  const t = await getTranslations("therapist.home");
  const session = await requirePageRole(["therapist", "platform_admin"]);
  const learnerIds = await listLearnersForMember(session.userId, session.email, "therapist", session.tenantId);
  const maybeLearners = await Promise.all(learnerIds.map((id) => getLearner(id, session.tenantId)));
  const learners = maybeLearners.filter((l): l is LearnerProfile => Boolean(l));
  for (const l of learners) await refreshLearnerReadiness(l.id, session.tenantId);
  const refreshed = await Promise.all(learners.map((l) => getLearner(l.id, session.tenantId)));
  const freshLearners = refreshed.filter((l): l is LearnerProfile => Boolean(l));
  const fresh = await Promise.all(
    freshLearners.map(async (l) => ({
      ...l,
      iep: await getIEPForLearner(l.id, session.tenantId),
    })),
  );
  const iepCount = fresh.filter((l) => l.iep !== null).length;

  return (
    <AppShell
      role="therapist"
      roleLabel="Therapist"
      navItems={THERAPIST_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        title={`Welcome, ${session.displayName.split(" ")[0]}`}
        description="Your caseload — every learner you're assigned to support."
      />

      {fresh.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-aivo-ink-soft">{t("stat_caseload")}</p>
            <p className="font-display text-2xl font-semibold">{fresh.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-aivo-ink-soft">{t("stat_ieps")}</p>
            <p className="font-display text-2xl font-semibold">{iepCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-aivo-ink-soft">{t("quick_links")}</p>
            <div className="mt-1 flex flex-col gap-1 text-sm">
              <Link href="/therapist/sessions" className="text-aivo-accent hover:underline">
                {t("link_sessions")}
              </Link>
              <Link href="/therapist/reports" className="text-aivo-accent hover:underline">
                {t("link_reports")}
              </Link>
            </div>
          </Card>
        </div>
      ) : null}

      <SectionHeader title={t("section_caseload")} />
      {fresh.length === 0 ? (
        <EmptyState
          title={t("empty_title")}
          description="Once a parent invites you and you accept, your assigned learners will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {fresh.map((l) => (
            <li key={l.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{l.displayName}</p>
                    <p className="mt-0.5 text-xs text-aivo-ink-soft">
                      {l.gradeBand ? `Grade ${l.gradeBand}` : "Therapy caseload"}
                      {l.iep ? " · IEP on file" : ""}
                    </p>
                  </div>
                  <Badge tone={READINESS_TONE[l.readinessState]}>
                    {READINESS_LABEL[l.readinessState]}
                  </Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
