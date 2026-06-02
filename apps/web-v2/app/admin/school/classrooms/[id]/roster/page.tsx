import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { RosterEditor } from "@/components/admin/roster-editor";
import { getClassroom } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function Page({ params }: Params) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const { id } = await params;
  const classroom = getClassroom(id);
  if (!classroom) notFound();

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin · Classrooms"
        title="Manage roster"
        description={`Add or remove learners and co-teachers for ${classroom.name}.`}
      />
      <RosterEditor classroom={classroom} />
    </AppShell>
  );
}
