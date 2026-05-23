/**
 * Caregiver home — placeholder dashboard for the caregiver role.
 *
 * Caregivers are added via the parent care-team invite flow
 * (`/parent/learners/[learnerId]/team`) and route here after accepting an
 * invite. The full caregiver workspace (observations, sessions, settings)
 * is wired in subsequent sprints; this lays down the role-gated shell.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function CaregiverHomePage() {
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "caregiver");
  const learners = learnerIds
    .map((id) => getLearner(id, session.tenantId))
    .filter((l): l is NonNullable<ReturnType<typeof getLearner>> => Boolean(l));

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

      <SectionHeader title="Your learners" />
      {learners.length === 0 ? (
        <EmptyState
          title="No learners yet"
          description="Once a parent invites you and you accept, the learners you support will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {learners.map((l) => (
            <li key={l.id}>
              <Card className="p-4">
                <p className="text-sm font-semibold">{l.displayName}</p>
                <p className="mt-0.5 text-xs text-aivo-ink-soft">
                  {l.gradeBand ? `Grade ${l.gradeBand}` : "Care-team member"}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
