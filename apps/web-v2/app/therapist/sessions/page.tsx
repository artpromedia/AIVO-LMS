/**
 * Therapist sessions — placeholder route reserving the URL space for the
 * session-log feature wired in a follow-up sprint.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["therapist", "platform_admin"]);
  return (
    <AppShell
      role="therapist"
      roleLabel="Therapist"
      navItems={THERAPIST_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader title="Sessions" description="Coming soon." />
      <EmptyState
        title="Session logging lands soon"
        description="Schedule and log therapy sessions here."
      />
    </AppShell>
  );
}
