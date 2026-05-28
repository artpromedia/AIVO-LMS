import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { listSchools } from "@/lib/db/repos";
import { RosterImportForm } from "./roster-import-form";

type Params = { searchParams: Promise<{ schoolId?: string }> };

export default async function Page({ searchParams }: Params) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const params = await searchParams;
  const schools = await listSchools(session.role === "platform_admin" ? undefined : session.tenantId);
  if (schools.length === 0) redirect("/admin/school/rostering");
  const selectedSchool = schools.find((s) => s.id === params.schoolId) ?? schools[0]!;

  const sampleCsv = `role,first_name,last_name,email,external_id,classroom_name,grade_band
teacher,Maya,Vega,maya@maple.edu,u_teacher_1,Room 4A — Ms. Vega,3-5
learner,Sky,Doe,sky@family.example,lrn_demo_sky,Room 4A — Ms. Vega,3-5
# Add more rows below — empty lines and # comments are ignored.
`;

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Rostering"
        title={`Import CSV — ${selectedSchool.name}`}
        description="Paste your CSV below. Run a dry run first to preview the row counts before committing."
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="mb-3 text-sm text-aivo-ink-soft">
          Required columns:{" "}
          <code className="font-mono text-xs">
            role, first_name, last_name, email, external_id, classroom_name, grade_band
          </code>
          . Roles must be one of{" "}
          <code className="font-mono text-xs">learner | teacher | co_teacher</code>. Grade bands:{" "}
          <code className="font-mono text-xs">K-2, 3-5, 6-8, 9-12</code>.
        </p>
        <RosterImportForm schoolId={selectedSchool.id} sampleCsv={sampleCsv} />
      </Card>
    </AppShell>
  );
}
