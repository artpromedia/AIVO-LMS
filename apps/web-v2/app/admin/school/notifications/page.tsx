import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { NotificationMatrix } from "@/components/admin/notification-matrix";
import { getNotificationMatrix } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const schoolId = session.tenantId ?? "t_school_demo";
  const matrix = getNotificationMatrix(schoolId);

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title="Notification settings"
        description="Configure which staff roles receive email notifications for each event type."
      />
      <NotificationMatrix schoolId={schoolId} initialMatrix={matrix} />
    </AppShell>
  );
}
