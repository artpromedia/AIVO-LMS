import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { AccountForm } from "@/app/parent/settings/account/account-form";
import { getTenantById } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["school_admin"]);
  const t = await getTranslations("admin.school_settings");
  const tenant = getTenantById(session.tenantId);
  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title={t("title")}
        description={`Profile and ${tenant?.name ?? "school"} defaults.`}
      />
      <Card className="max-w-lg p-6">
        <p className="mb-4 text-sm text-aivo-ink-soft">
          {t("signed_in_as")} <span className="font-medium">{session.email}</span> · admin of{" "}
          <span className="font-medium">{tenant?.name ?? session.tenantId}</span>.
        </p>
        <AccountForm initial={{ displayName: session.displayName }} />
      </Card>
    </AppShell>
  );
}
