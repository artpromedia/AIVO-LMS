/**
 * Therapist home — caseload dashboard for the therapist role.
 *
 * Therapists are added via the parent care-team invite flow
 * (`/parent/learners/[learnerId]/team`) and route here after accepting an
 * invite.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
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
  const session = await requirePageRole(["therapist", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "therapist");
  const maybeLearners = await Promise.all(
    learnerIds.map((id) => getLearner(id, session.tenantId)),
  );
  const learners = maybeLearners.filter((l): l is LearnerProfile => Boolean(l));
  for (const l of learners) await refreshLearnerReadiness(l.id, session.tenantId);
  const refreshed = await Promise.all(
    learners.map((l) => getLearner(l.id, session.tenantId)),
  );
  const fresh = refreshed
    .filter((l): l is LearnerProfile => Boolean(l))
    .map((l) => ({ ...l, iep: getIEPForLearner(l.id, session.tenantId) }));
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
            <p className="text-xs text-aivo-ink-soft">Caseload</p>
            <p className="font-display text-2xl font-semibold">{fresh.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-aivo-ink-soft">IEPs on file</p>
            <p className="font-display text-2xl font-semibold">{iepCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-aivo-ink-soft">Quick links</p>
            <div className="mt-1 flex flex-col gap-1 text-sm">
              <Link href="/therapist/sessions" className="text-aivo-accent hover:underline">
                Sessions →
              </Link>
              <Link href="/therapist/reports" className="text-aivo-accent hover:underline">
                Reports →
              </Link>
            </div>
          </Card>
        </div>
      ) : null}

      <SectionHeader title="Caseload" />
      {fresh.length === 0 ? (
        <EmptyState
          title="No learners yet"
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
