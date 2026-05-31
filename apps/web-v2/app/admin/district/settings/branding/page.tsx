import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { getTenantById, getTenantSettings } from "@/lib/db/repos";
import { BrandingForm } from "./branding-form";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.district_settings_branding");
  const tenant = getTenantById(session.tenantId);
  const settings = getTenantSettings(session.tenantId);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District settings"
        title={t("title")}
        description={`How ${tenant?.name ?? "your district"} appears to learners, families, and staff.`}
      />
      <Card className="max-w-2xl p-[var(--aivo-density-card-pad)]">
        <BrandingForm initial={settings.branding} fallbackName={tenant?.name ?? ""} />
      </Card>
    </AppShell>
  );
}
