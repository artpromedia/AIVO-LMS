/**
 * Therapist home — caseload dashboard for the therapist role.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { RoleHomeScaffold } from "@/components/layout/RoleHomeScaffold";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, FloatingMetricCard } from "@aivo/ui";
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
      <RoleHomeScaffold
        hero={{
          title: `Welcome, ${session.displayName.split(" ")[0]}`,
          subheading: "Your caseload — every learner you're assigned to support.",
          tone: "calm",
        }}
        kpiStrip={
          <>
            <FloatingMetricCard label={t("stat_caseload")} value={String(fresh.length)} tone="info" />
            <FloatingMetricCard label={t("stat_ieps")} value={String(iepCount)} tone="success" />
            <FloatingMetricCard
              label={t("quick_links")}
              value={
                <div className="mt-1 flex flex-col gap-1 text-sm text-left">
                  <Link href="/therapist/sessions" className="text-iw-text-strong hover:underline">
                    {t("link_sessions")}
                  </Link>
                  <Link href="/therapist/reports" className="text-iw-text-strong hover:underline">
                    {t("link_reports")}
                  </Link>
                </div>
              }
              tone="neutral"
            />
          </>
        }
        sections={[
          {
            title: t("section_caseload"),
            cards:
              fresh.length === 0 ? undefined : (
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
              ),
            emptyState: (
              <EmptyState
                title={t("empty_title")}
                body="Once a parent invites you and you accept, your assigned learners will appear here."
              />
            ),
          },
        ]}
      />
    </AppShell>
  );
}
