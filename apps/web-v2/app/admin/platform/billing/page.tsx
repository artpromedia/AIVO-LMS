import { getTranslations } from "next-intl/server";
import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { platformNavForSession } from "@/components/layout/role-shells";
import { listBillingAccounts } from "@/lib/admin-api/billing";
import { ROLE_LABEL } from "@/lib/auth/types";
import { billingTone } from "@/lib/admin-api/types";

export default async function Page() {
  const session = await requirePlatformPage(Permission.BillingRead);
  const t = await getTranslations("admin.platform_billing_overview");
  const accounts = await listBillingAccounts(session);
  const counts = accounts.reduce<Record<string, number>>((acc, account) => {
    acc[account.status] = (acc[account.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Billing"
        title={t("title")}
        description="Latest subscription row per tenant from admin-svc."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {["trialing", "active", "past_due", "canceled"].map((status) => (
          <Card key={status} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              {status}
            </p>
            <p className="mt-1 font-display text-3xl font-bold">
              {(counts[status] ?? 0).toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      {accounts.length === 0 ? (
        <EmptyState title={t("empty_title")} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">{t("col_tenant")}</th>
                <th className="p-3">Type</th>
                <th className="p-3">Plan</th>
                <th className="p-3">{t("col_status")}</th>
                <th className="p-3">Current period end</th>
                <th className="p-3">{t("col_created")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">{account.tenantName ?? account.tenantId}</td>
                  <td className="p-3 text-aivo-ink-soft">{account.tenantTypeLabel}</td>
                  <td className="p-3 text-aivo-ink-soft">{account.plan}</td>
                  <td className="p-3">
                    <Badge tone={billingTone(account.status)}>
                      {account.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {account.currentPeriodEnd
                      ? new Date(account.currentPeriodEnd).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
