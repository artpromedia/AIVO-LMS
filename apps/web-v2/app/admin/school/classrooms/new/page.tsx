import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { ClassroomForm } from "@/components/admin/classroom-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const schoolId = session.tenantId ?? "t_school_demo";

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin · Classrooms"
        title="New classroom"
        description="Create a new classroom and assign a primary teacher."
      />
      <ClassroomForm schoolId={schoolId} />
    </AppShell>
  );
}
