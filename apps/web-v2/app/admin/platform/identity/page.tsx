import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listAdminTenants } from "@/lib/admin-api/platform";
import { enterpriseFlags } from "@/lib/bff/feature-flags";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.identity");
  const flagOn = enterpriseFlags.enterpriseIdentity();
  const tenants = (await listAdminTenants(session)).filter(
    (tenant) => tenant.tenantKind === "district" || tenant.tenantKind === "school",
  );

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Enterprise identity"
        title={t("catalog_title")}
        description={t("catalog_description")}
      />

      {!flagOn ? (
        <Banner tone="warning" className="mb-4">
          {t("flag_off_notice")}
        </Banner>
      ) : null}

      {tenants.length === 0 ? (
        <EmptyState title={t("no_tenants")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <Link key={tenant.id} href={`/admin/platform/identity/${tenant.id}`}>
              <Card className="h-full p-[var(--aivo-density-card-pad)] transition-colors hover:bg-aivo-surface-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display font-semibold">{tenant.name}</p>
                    <p className="text-xs text-aivo-ink-soft">{tenant.typeLabel}</p>
                  </div>
                  <Badge tone="neutral">SCIM</Badge>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-aivo-ink-soft">{t("protocol")}</dt>
                    <dd>OIDC/SAML</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-aivo-ink-soft">{t("scim")}</dt>
                    <dd>{t("on")}</dd>
                  </div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
