import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { CsvImportWizard } from "@/components/admin/import/csv-import-wizard";
import { JobTray } from "@/components/admin/job-tray";

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
      jobTray={<JobTray schoolId={schoolId} />}
    >
      <PageHeader
        eyebrow="School admin · Learners"
        title="Import learners"
        description="Upload a CSV to bulk-import or update learner records. Download the template to get started."
      />
      <CsvImportWizard schoolId={schoolId} />
    </AppShell>
  );
}
