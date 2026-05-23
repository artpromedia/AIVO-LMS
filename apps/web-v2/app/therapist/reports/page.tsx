/**
 * Therapist reports — placeholder route reserving the URL space for the
 * caseload reporting feature wired in a follow-up sprint.
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
      <PageHeader title="Reports" description="Caseload reporting lands in a follow-up sprint." />
      <EmptyState
        title="Caseload reporting lands soon"
        description="Progress notes and outcome dashboards will appear here."
      />
    </AppShell>
  );
}
