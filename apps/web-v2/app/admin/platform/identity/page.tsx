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
import { scopeTenantsForSession } from "@/lib/db/repos";
import { getIdpConfigByTenant } from "@/lib/db/idp-store";
import { enterpriseFlags } from "@/lib/bff/feature-flags";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.identity");
  const flagOn = enterpriseFlags.enterpriseIdentity();

  // IdP federation only applies to organizational tenants, not per-family ones.
  const tenants = scopeTenantsForSession(session.role, session.tenantId).filter(
    (tn) => tn.type === "district" || tn.type === "school" || tn.type === "platform",
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
          {tenants.map((tn) => {
            const cfg = getIdpConfigByTenant(tn.id);
            return (
              <Link key={tn.id} href={`/admin/platform/identity/${tn.id}`}>
                <Card className="h-full p-[var(--aivo-density-card-pad)] transition-colors hover:bg-aivo-surface-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-semibold">{tn.name}</p>
                      <p className="text-xs capitalize text-aivo-ink-soft">{tn.type}</p>
                    </div>
                    {cfg ? (
                      <Badge tone={cfg.enabled ? "success" : "neutral"}>
                        {cfg.enabled ? t("status_enabled") : t("status_configured")}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">{t("status_not_configured")}</Badge>
                    )}
                  </div>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-aivo-ink-soft">{t("protocol")}</dt>
                      <dd>{cfg ? cfg.protocol.toUpperCase() : "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-aivo-ink-soft">{t("scim")}</dt>
                      <dd>{cfg?.scimEnabled ? t("on") : t("off")}</dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
