import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { scopeTenantsForSession, listDistrictSchools } from "@/lib/db/repos";
import { Building2, Users, GraduationCap } from "lucide-react";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const schools = listDistrictSchools(tenants.map((t) => t.id));

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title="Schools"
        description="Every school operating under this district, with staff and learner counts."
      />

      {schools.length === 0 ? (
        <EmptyState title="No schools in this district yet" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {schools.map((row) => (
            <Card key={row.school.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{row.school.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-aivo-muted">{row.school.id}</p>
                </div>
                <Badge tone="primary">School</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="flex items-center gap-1 text-xs text-aivo-ink-soft">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Learners
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-semibold">
                    {row.learnerCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-aivo-ink-soft">
                    <Users className="h-3.5 w-3.5" />
                    Staff
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-semibold">
                    {row.staffCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-aivo-ink-soft">
                    <Building2 className="h-3.5 w-3.5" />
                    Families
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-semibold">
                    {row.familyCount.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between text-xs text-aivo-ink-soft">
                <span>Onboarded {new Date(row.school.createdAt).toLocaleDateString()}</span>
                <Link
                  href={`/admin/district/staff`}
                  className="font-medium text-aivo-primary hover:underline"
                >
                  View staff
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
