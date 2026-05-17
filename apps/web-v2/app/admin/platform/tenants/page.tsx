import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  listUsersForTenants,
  listLearnersForTenants,
  listBillingForTenants,
} from "@/lib/db/repos";
import type { Role } from "@/lib/auth/types";

const TYPE_TONE: Record<string, "primary" | "success" | "neutral" | "warning"> = {
  district: "primary",
  school: "success",
  family: "neutral",
  platform: "warning",
};

const BILLING_TONE: Record<
  string,
  "success" | "neutral" | "warning" | "danger"
> = {
  active: "success",
  trialing: "warning",
  past_due: "danger",
  canceled: "neutral",
};

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);

  // Precompute counts so the table renders without per-row N+1 scans.
  const users = listUsersForTenants(tenantIds);
  const learners = listLearnersForTenants(tenantIds);
  const billingRows = listBillingForTenants(tenantIds);
  const billingByTenant = new Map(billingRows.map((b) => [b.tenantId, b]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const userCountByTenant = new Map<string, number>();
  const adminCountByTenant = new Map<string, number>();
  const adminRoles: Role[] = ["district_admin", "school_admin", "platform_admin"];
  for (const u of users) {
    userCountByTenant.set(
      u.tenantId,
      (userCountByTenant.get(u.tenantId) ?? 0) + 1,
    );
    if (adminRoles.includes(u.role)) {
      adminCountByTenant.set(
        u.tenantId,
        (adminCountByTenant.get(u.tenantId) ?? 0) + 1,
      );
    }
  }
  const learnerCountByTenant = new Map<string, number>();
  for (const l of learners) {
    learnerCountByTenant.set(
      l.tenantId,
      (learnerCountByTenant.get(l.tenantId) ?? 0) + 1,
    );
  }

  const byType = tenants.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] ?? 0) + 1;
    return acc;
  }, {});

  // Sort: districts → schools → families → platform, then alphabetical.
  const typeOrder: Record<string, number> = {
    district: 0,
    school: 1,
    family: 2,
    platform: 3,
  };
  const sorted = [...tenants].sort((a, b) => {
    const t = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
    return t !== 0 ? t : a.name.localeCompare(b.name);
  });

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title="Tenants"
        description="Every tenant currently provisioned in this environment."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { k: "Districts", v: byType.district ?? 0 },
          { k: "Schools", v: byType.school ?? 0 },
          { k: "Families", v: byType.family ?? 0 },
          { k: "Platform", v: byType.platform ?? 0 },
        ].map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              {s.k}
            </p>
            <p className="mt-1 font-display text-3xl font-bold">
              {s.v.toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      {tenants.length === 0 ? (
        <EmptyState title="No tenants" />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-aivo-border px-4 py-3 text-sm font-medium">
            {tenants.length.toLocaleString()}{" "}
            {tenants.length === 1 ? "tenant" : "tenants"}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Parent</th>
                  <th className="px-4 py-2 text-right">Users</th>
                  <th className="px-4 py-2 text-right">Admins</th>
                  <th className="px-4 py-2 text-right">Learners</th>
                  <th className="px-4 py-2">Billing</th>
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aivo-border">
                {sorted.map((t) => {
                  const billing = billingByTenant.get(t.id);
                  return (
                    <tr key={t.id} className="hover:bg-aivo-surface-2/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/platform/tenants/${t.id}`}
                          className="font-medium hover:text-aivo-primary"
                        >
                          {t.name}
                        </Link>
                        <p className="font-mono text-xs text-aivo-muted">
                          {t.id}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TYPE_TONE[t.type] ?? "neutral"}>
                          {t.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-aivo-ink-soft">
                        {t.parentTenantId
                          ? (tenantById.get(t.parentTenantId)?.name ??
                            t.parentTenantId)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(userCountByTenant.get(t.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(adminCountByTenant.get(t.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(learnerCountByTenant.get(t.id) ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {billing ? (
                          <span className="inline-flex items-center gap-2">
                            <Badge tone={BILLING_TONE[billing.status] ?? "neutral"}>
                              {billing.status.replace("_", " ")}
                            </Badge>
                            <span className="text-xs text-aivo-ink-soft">
                              {billing.plan}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-aivo-ink-soft">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs text-aivo-ink-soft">
        Looking for billing rollups?{" "}
        <Link
          href="/admin/platform/billing"
          className="font-medium text-aivo-primary hover:underline"
        >
          Open billing
        </Link>
        .
      </p>
    </AppShell>
  );
}
