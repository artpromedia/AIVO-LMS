import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { getIdpConfigByTenant } from "@/lib/db/idp-store";
import { enterpriseFlags } from "@/lib/bff/feature-flags";
import { RequestChangesForm } from "@/components/admin/identity/RequestChangesForm";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.identity");
  const flagOn = enterpriseFlags.enterpriseIdentity();
  const config = getIdpConfigByTenant(session.tenantId);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Enterprise identity"
        title={t("district_title")}
        description={t("district_description")}
      />

      {!flagOn ? (
        <Banner tone="warning" className="mb-4">
          {t("flag_off_notice")}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <p className="font-display text-lg font-semibold">{t("current_config")}</p>
          {config ? (
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-aivo-ink-soft">{t("status")}</dt>
                <dd>
                  <Badge tone={config.enabled ? "success" : "neutral"}>
                    {config.enabled ? t("status_enabled") : t("status_configured")}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-aivo-ink-soft">{t("protocol")}</dt>
                <dd>{config.protocol.toUpperCase()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-aivo-ink-soft">{t("idp_label")}</dt>
                <dd>{config.idpLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-aivo-ink-soft">{t("jit_provisioning")}</dt>
                <dd>{config.jitProvisioning ? t("on") : t("off")}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-aivo-ink-soft">{t("scim")}</dt>
                <dd>{config.scimEnabled ? t("on") : t("off")}</dd>
              </div>
              <div>
                <dt className="text-aivo-ink-soft">{t("email_domains")}</dt>
                <dd className="mt-1">
                  {config.emailDomains.length ? config.emailDomains.join(", ") : "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-aivo-ink-soft">{t("no_config_district")}</p>
          )}
          <p className="mt-4 text-xs text-aivo-ink-soft">{t("read_only_note")}</p>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <RequestChangesForm />
        </Card>
      </div>
    </AppShell>
  );
}
