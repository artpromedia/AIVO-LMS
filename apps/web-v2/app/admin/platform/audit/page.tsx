import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { AuditConsole } from "@/components/admin/audit/AuditConsole";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.audit");
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="Security" title={t("platform_title")} description={t("platform_description")} />
      <AuditConsole scopeKey="platform" />
    </AppShell>
  );
}
