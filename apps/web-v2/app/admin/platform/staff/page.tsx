import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { platformNavForSession } from "@/components/layout/role-shells";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { ROLE_LABEL } from "@/lib/auth/types";
import { PlatformStaffConsole } from "./staff-console";

export const dynamic = "force-dynamic";

export default async function PlatformStaffPage() {
  const session = await requirePlatformPage(Permission.UserRead);
  const canProvision = sessionHasPermission(session, Permission.StaffProvision);

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title="Staff"
        description="Provision and review internal platform accounts with capability-aware access."
      />
      <PlatformStaffConsole canProvision={canProvision} />
    </AppShell>
  );
}
