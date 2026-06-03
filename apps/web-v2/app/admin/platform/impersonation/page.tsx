import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { StartImpersonationModal } from "@/components/admin/impersonation/StartImpersonationModal";
import { ImpersonationHistoryTable } from "@/components/admin/impersonation/ImpersonationHistoryTable";
import { getImpersonationHistory } from "@/lib/services/impersonation-svc";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  // Platform admins see all history (no adminId scope).
  const sessions = await getImpersonationHistory();

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Security"
        title="View-As log"
        description="Secure impersonation sessions across the platform. Every session is MFA-gated and fully audited."
        actions={<StartImpersonationModal />}
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <ImpersonationHistoryTable sessions={sessions} />
      </Card>
    </AppShell>
  );
}
