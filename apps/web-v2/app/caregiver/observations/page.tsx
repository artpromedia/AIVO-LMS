/**
 * Caregiver observations — placeholder route reserving the URL space for
 * the observation-journal feature wired in a follow-up sprint.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  return (
    <AppShell
      role="caregiver"
      roleLabel="Caregiver"
      navItems={CAREGIVER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader title="Observations" description="Coming soon." />
      <EmptyState
        title="Observation journal lands soon"
        description="You'll be able to log daily notes and share them with the care team."
      />
    </AppShell>
  );
}
