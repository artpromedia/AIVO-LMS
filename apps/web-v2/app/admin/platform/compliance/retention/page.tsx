import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listRetentionPolicies } from "@/lib/db/repos";
import { RetentionRow } from "./row";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const policies = listRetentionPolicies();

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Compliance"
        title="Retention policies"
        description="Retention and archive windows per data classification."
      />

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-left">
            <tr>
              <th className="p-3">Classification</th>
              <th className="p-3">Retention (days)</th>
              <th className="p-3">Archive (days)</th>
              <th className="p-3">Description</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <RetentionRow key={p.id} policy={p} />
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
