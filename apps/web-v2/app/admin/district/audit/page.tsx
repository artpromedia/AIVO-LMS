import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { AuditConsole } from "@/components/admin/audit/AuditConsole";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.audit");
  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Security"
        title={t("district_title")}
        description={t("district_description")}
      />
      <AuditConsole scopeKey="district" />
    </AppShell>
  );
}
