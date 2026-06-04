import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { ConnectorWizard } from "@/components/admin/sis/ConnectorWizard";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.sis");

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Rostering"
        title={t("wizard_title")}
        description={t("wizard_description")}
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <ConnectorWizard tenantId={session.tenantId} />
      </Card>
    </AppShell>
  );
}
