/**
 * Caregiver home — overview dashboard for the caregiver role.
 *
 * Caregivers are added via the parent care-team invite flow
 * (`/parent/learners/[learnerId]/team`) and route here after accepting an
 * invite.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner, refreshLearnerReadiness } from "@/lib/db/repos";
import { READINESS_LABEL, READINESS_TONE } from "@/lib/learner/readiness";

export const dynamic = "force-dynamic";

export default async function CaregiverHomePage() {
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "caregiver");
  const learners = learnerIds
    .map((id) => getLearner(id, session.tenantId))
    .filter((l): l is NonNullable<ReturnType<typeof getLearner>> => Boolean(l));
  for (const l of learners) refreshLearnerReadiness(l.id, session.tenantId);
  const fresh = learners.map((l) => getLearner(l.id, session.tenantId)!).filter(Boolean);
  const learningNow = fresh.filter(
    (l) =>
      l.readinessState === "active_learning" || l.readinessState === "ready_for_today_mission",
  ).length;

  return (
    <AppShell
      role="caregiver"
      roleLabel="Caregiver"
      navItems={CAREGIVER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        title={`Welcome, ${session.displayName.split(" ")[0]}`}
        description="You're on the care team for the learners listed below."
      />

      {fresh.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-aivo-ink-soft">On your care team</p>
            <p className="font-display text-2xl font-semibold">{fresh.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-aivo-ink-soft">Active or ready</p>
            <p className="font-display text-2xl font-semibold">{learningNow}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-aivo-ink-soft">Quick links</p>
            <div className="mt-1 flex flex-col gap-1 text-sm">
              <Link href="/caregiver/observations" className="text-aivo-accent hover:underline">
                Observations →
              </Link>
              <Link href="/caregiver/learners" className="text-aivo-accent hover:underline">
                Roster →
              </Link>
            </div>
          </Card>
        </div>
      ) : null}

      <SectionHeader title="Your learners" />
      {fresh.length === 0 ? (
        <EmptyState
          title="No learners yet"
          description="Once a parent invites you and you accept, the learners you support will appear here."
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
                      {l.gradeBand ? `Grade ${l.gradeBand}` : "Care-team member"}
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
