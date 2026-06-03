import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { listModels, listOptOuts } from "@/lib/services/responsible-ai-svc";
import { OptOutMatrix } from "@/components/admin/ai/OptOutMatrix";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const models = (await listModels()).filter((m) => m.status === "active");
  const optOuts = await listOptOuts(session.tenantId);

  return (
    <AppShell
      role={session.role}
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District · Responsible AI"
        title="AI model availability"
        description="Models enabled for your district. Toggle a model off to opt your district out of it."
      />

      <OptOutMatrix models={models} optOuts={optOuts} tenantId={session.tenantId} />
    </AppShell>
  );
}
