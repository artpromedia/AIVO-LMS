import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { ConsentSearch } from "@/components/admin/compliance/consent-search";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Compliance"
        title="Consent ledger"
        description="Search and review consent records across all tenants. Filter by subject ID and/or consent type."
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <ConsentSearch />
      </Card>
    </AppShell>
  );
}
