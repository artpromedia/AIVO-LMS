import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getTenantById } from "@/lib/db/repos";
import { getIdpConfigByTenant } from "@/lib/db/idp-store";
import { IdpForm } from "@/components/admin/identity/IdpForm";
import { ScimTokenCard } from "@/components/admin/identity/ScimTokenCard";

export default async function Page({ params }: { params: Promise<{ tenantId: string }> }) {
  const session = await requirePageRole(["platform_admin"]);
  const { tenantId } = await params;
  const t = await getTranslations("admin.identity");

  const tenant = getTenantById(tenantId);
  if (!tenant) notFound();

  const config = getIdpConfigByTenant(tenantId);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Enterprise identity"
        title={t("detail_title", { tenant: tenant.name })}
        description={t("detail_description")}
        actions={
          <Link
            href="/admin/platform/identity"
            className="text-sm text-aivo-ink-soft hover:underline"
          >
            ← {t("catalog_title")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <IdpForm tenantId={tenantId} initial={config} />
        </Card>

        <div className="space-y-4">
          <Card className="p-[var(--aivo-density-card-pad)]">
            {config ? (
              <ScimTokenCard idpId={config.id} tokens={config.scimTokens} />
            ) : (
              <div>
                <p className="font-display text-lg font-semibold">{t("scim_tokens")}</p>
                <p className="mt-2 text-sm text-aivo-ink-soft">{t("scim_after_save")}</p>
              </div>
            )}
          </Card>

          <Card className="p-[var(--aivo-density-card-pad)]">
            <p className="font-display text-lg font-semibold">{t("integration_urls")}</p>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-aivo-ink-soft">{t("acs_url")}</dt>
                <dd className="mt-1 break-all">
                  <code className="text-xs">/api/sso/saml/{tenantId}/acs</code>
                </dd>
              </div>
              <div>
                <dt className="text-aivo-ink-soft">{t("sp_metadata_url")}</dt>
                <dd className="mt-1 break-all">
                  <code className="text-xs">/api/sso/saml/{tenantId}/metadata</code>
                </dd>
              </div>
              <div>
                <dt className="text-aivo-ink-soft">{t("oidc_callback_url")}</dt>
                <dd className="mt-1 break-all">
                  <code className="text-xs">/api/sso/oidc/{tenantId}/callback</code>
                </dd>
              </div>
              <div>
                <dt className="text-aivo-ink-soft">{t("scim_base_url")}</dt>
                <dd className="mt-1 break-all">
                  <code className="text-xs">/scim/v2</code>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
