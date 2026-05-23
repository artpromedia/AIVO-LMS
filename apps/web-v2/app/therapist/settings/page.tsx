/**
 * Therapist settings — placeholder route. Profile + notification preferences
 * land in a follow-up sprint.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";

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
      <PageHeader title="Settings" description="Your profile and preferences." />
      <Card className="p-4">
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="font-medium text-aivo-muted">Name</dt>
          <dd>{session.displayName}</dd>
          <dt className="font-medium text-aivo-muted">Email</dt>
          <dd>{session.email}</dd>
          <dt className="font-medium text-aivo-muted">Role</dt>
          <dd>Therapist</dd>
        </dl>
      </Card>
    </AppShell>
  );
}
