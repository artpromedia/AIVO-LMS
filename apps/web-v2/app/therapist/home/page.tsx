/**
 * Therapist home — placeholder dashboard for the therapist role.
 *
 * Therapists are added via the parent care-team invite flow
 * (`/parent/learners/[learnerId]/team`) and route here after accepting an
 * invite. Reports / sessions / settings surfaces are wired in subsequent
 * sprints; this lays down the role-gated shell.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TherapistHomePage() {
  const session = await requirePageRole(["therapist", "platform_admin"]);
  const learnerIds = listLearnersForMember(session.userId, session.email, "therapist");
  const learners = learnerIds
    .map((id) => getLearner(id, session.tenantId))
    .filter((l): l is NonNullable<ReturnType<typeof getLearner>> => Boolean(l));

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

      <SectionHeader title="Caseload" />
      {learners.length === 0 ? (
        <EmptyState
          title="No learners yet"
          description="Once a parent invites you and you accept, your assigned learners will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {learners.map((l) => (
            <li key={l.id}>
              <Card className="p-4">
                <p className="text-sm font-semibold">{l.displayName}</p>
                <p className="mt-0.5 text-xs text-aivo-ink-soft">
                  {l.gradeBand ? `Grade ${l.gradeBand}` : "Therapy caseload"}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
