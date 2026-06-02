import Link from "next/link";
import { CreditCard, User } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getBillingForTenant, getTenantById } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.settings");
  const billing = getBillingForTenant(session.tenantId);
  const tenant = getTenantById(session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/parent/settings/account" className="block">
          <Card className="p-[var(--aivo-density-card-pad)] hover:bg-aivo-surface-2">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-aivo-primary" />
              <h3 className="font-display text-lg font-semibold">{t("account_label")}</h3>
            </div>
            <p className="mt-2 text-sm text-aivo-ink-soft">
              {session.displayName} · {session.email}
            </p>
          </Card>
        </Link>
        <Link href="/parent/settings/billing" className="block">
          <Card className="p-[var(--aivo-density-card-pad)] hover:bg-aivo-surface-2">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-aivo-primary" />
              <h3 className="font-display text-lg font-semibold">{t("billing_label")}</h3>
            </div>
            <p className="mt-2 text-sm text-aivo-ink-soft">
              {tenant?.name ?? "Your family"} ·{" "}
              {billing ? `${billing.plan} (${billing.status})` : "no plan provisioned"}
            </p>
            {billing ? (
              <Badge tone={billing.status === "active" ? "success" : "warning"} className="mt-3">
                {billing.status}
              </Badge>
            ) : null}
          </Card>
        </Link>
      </div>
      <SectionHeader className="mt-10" title={t("privacy_label")} description={t("privacy_desc")} />
    </AppShell>
  );
}
