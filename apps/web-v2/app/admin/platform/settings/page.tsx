import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { AccountForm } from "@/app/parent/settings/account/account-form";
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("admin.platform_settings_overview");
  const session = await requirePageRole(["platform_admin"]);
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Settings"
        title={t("title")}
        description="Your admin profile."
      />
      <Card className="max-w-lg p-6">
        <p className="mb-4 text-sm text-aivo-ink-soft">
          {t("signed_in_as")} <span className="font-medium">{session.email}</span>.
        </p>
        <AccountForm initial={{ displayName: session.displayName }} />
      </Card>
    </AppShell>
  );
}
