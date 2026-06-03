import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { StartImpersonationModal } from "@/components/admin/impersonation/StartImpersonationModal";
import { ImpersonationHistoryTable } from "@/components/admin/impersonation/ImpersonationHistoryTable";
import { getImpersonationHistory } from "@/lib/services/impersonation-svc";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  // identity-svc scopes non-platform callers to their own history server-side.
  const sessions = await getImpersonationHistory({ adminId: session.userId });

  return (
    <AppShell
      role={session.role}
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District · Security"
        title="View-As log"
        description="Your secure impersonation sessions. Every session is MFA-gated and fully audited."
        actions={<StartImpersonationModal />}
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <ImpersonationHistoryTable sessions={sessions} />
      </Card>
    </AppShell>
  );
}
