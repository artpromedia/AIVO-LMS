import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getAdminTenant } from "@/lib/admin-api/platform";
import { listScimTokens } from "@/lib/admin-api/scim";

export default async function Page({ params }: { params: Promise<{ tenantId: string }> }) {
  const session = await requirePageRole(["platform_admin"]);
  const { tenantId } = await params;
  const t = await getTranslations("admin.identity");

  let tenant;
  try {
    tenant = await getAdminTenant(session, tenantId);
  } catch {
    notFound();
  }
  const scimTokens = await listScimTokens(session, tenantId).catch(() => []);

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
            Back to {t("catalog_title")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <p className="font-display text-lg font-semibold">{tenant.name}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-aivo-ink-soft">Tenant type</dt>
              <dd className="mt-1 font-medium">{tenant.typeLabel}</dd>
            </div>
            <div>
              <dt className="text-aivo-ink-soft">Users</dt>
              <dd className="mt-1 font-medium">{tenant.userCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-aivo-ink-soft">Learners</dt>
              <dd className="mt-1 font-medium">{tenant.learnerCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-aivo-ink-soft">Created</dt>
              <dd className="mt-1 font-medium">{new Date(tenant.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="p-[var(--aivo-density-card-pad)]">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-semibold">{t("scim_tokens")}</p>
              <Badge tone="neutral">{scimTokens.length.toLocaleString()}</Badge>
            </div>
            {scimTokens.length === 0 ? (
              <EmptyState title={t("scim_after_save")} />
            ) : (
              <ul className="mt-3 divide-y text-sm">
                {scimTokens.map((token) => (
                  <li key={token.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{token.name}</span>
                      <Badge tone={token.revokedAt ? "neutral" : "success"}>
                        {token.revokedAt ? "revoked" : "active"}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-aivo-ink-soft">{token.prefix}****</p>
                  </li>
                ))}
              </ul>
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
