import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { listComponents } from "@/lib/services/status-page-svc";
import { NewIncidentForm } from "./new-incident-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const components = await listComponents();

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Reliability"
        title="Report an incident"
        description="Open a new incident. Affected components will be flagged on the public status page."
      />
      <Card className="max-w-2xl p-[var(--aivo-density-card-pad)]">
        <NewIncidentForm
          components={components.map((c: any) => ({ id: c.id, name: c.name }))}
        />
      </Card>
    </AppShell>
  );
}
