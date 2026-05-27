import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  scopeTenantsForSession,
  getTenantById,
  listUsersForTenants,
  listLearnersForTenants,
  getBillingForTenant,
  listAiGenerationJobs,
  listAuditLogsForTenants,
  listInvoicesForTenants,
} from "@/lib/db/repos";
import { ArrowLeft } from "lucide-react";

const TYPE_TONE: Record<string, "primary" | "success" | "neutral" | "warning"> = {
  district: "primary",
  school: "success",
  family: "neutral",
  platform: "warning",
};

const BILLING_TONE: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  active: "success",
  trialing: "warning",
  past_due: "danger",
  canceled: "neutral",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageRole(["platform_admin"]);
  const visibleTenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenant = visibleTenants.find((t) => t.id === id) ?? null;
  if (!tenant) notFound();

  // Transitive descendants: schools, families, and every nested tenant under
  // this one (e.g. district → school → family). One-level filtering would miss
  // grandchildren and undercount roll-ups for higher-level tenants.
  const childrenByParent = new Map<string, typeof visibleTenants>();
  for (const t of visibleTenants) {
    if (!t.parentTenantId) continue;
    const arr = childrenByParent.get(t.parentTenantId) ?? [];
    arr.push(t);
    childrenByParent.set(t.parentTenantId, arr);
  }
  const descendants: typeof visibleTenants = [];
  const stack = [tenant.id];
  while (stack.length > 0) {
    const next = stack.pop()!;
    for (const child of childrenByParent.get(next) ?? []) {
      descendants.push(child);
      stack.push(child.id);
    }
  }
  const directChildren = descendants.filter((t) => t.parentTenantId === tenant.id);
  const allScopeIds = [tenant.id, ...descendants.map((t) => t.id)];

  const users = listUsersForTenants(allScopeIds);
  const learners = listLearnersForTenants(allScopeIds);
  const billing = getBillingForTenant(tenant.id);
  const jobs = listAiGenerationJobs(allScopeIds, 5);
  const auditLogs = await listAuditLogsForTenants(allScopeIds, 8);
  const invoices = listInvoicesForTenants([tenant.id]).slice(0, 5);
  const parent = tenant.parentTenantId ? getTenantById(tenant.parentTenantId) : null;

  const usersByRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <Link
        href="/admin/platform/tenants"
        className="mb-3 inline-flex items-center text-sm text-aivo-ink-soft hover:text-aivo-ink"
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> All tenants
      </Link>
      <PageHeader
        eyebrow={`Platform · ${tenant.type}`}
        title={tenant.name}
        description={
          parent ? `Nested under ${parent.name}.` : "Top-level tenant in this environment."
        }
        actions={
          <span className="inline-flex items-center gap-2">
            <Badge tone={TYPE_TONE[tenant.type] ?? "neutral"}>{tenant.type}</Badge>
            {billing ? (
              <Badge tone={BILLING_TONE[billing.status] ?? "neutral"}>
                {billing.plan} · {billing.status.replace("_", " ")}
              </Badge>
            ) : (
              <Badge tone="neutral">no billing</Badge>
            )}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Users</p>
          <p className="mt-1 font-display text-3xl font-bold">{users.length.toLocaleString()}</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">across this scope</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Learners</p>
          <p className="mt-1 font-display text-3xl font-bold">{learners.length.toLocaleString()}</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">enrolled profiles</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Sub-tenants
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {descendants.length.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-aivo-ink-soft">schools / families nested</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Created</p>
          <p className="mt-1 font-display text-xl font-semibold">
            {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
          <p className="mt-1 font-mono text-xs text-aivo-muted">{tenant.id}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">User mix</p>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(usersByRole)
              .sort((a, b) => b[1] - a[1])
              .map(([role, n]) => (
                <li key={role} className="flex items-center justify-between">
                  <span className="capitalize text-aivo-ink-soft">{role.replace("_", " ")}</span>
                  <span className="font-semibold tabular-nums">{n.toLocaleString()}</span>
                </li>
              ))}
            {users.length === 0 ? (
              <li className="text-xs text-aivo-ink-soft">No users yet.</li>
            ) : null}
          </ul>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Direct children</p>
            {descendants.length > directChildren.length ? (
              <Badge tone="neutral">{descendants.length.toLocaleString()} total nested</Badge>
            ) : null}
          </div>
          {directChildren.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-ink-soft">
              No tenants nested directly under this one.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-aivo-border">
              {directChildren.slice(0, 10).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <Link
                    href={`/admin/platform/tenants/${t.id}`}
                    className="font-medium hover:text-aivo-primary"
                  >
                    {t.name}
                  </Link>
                  <Badge tone={TYPE_TONE[t.type] ?? "neutral"}>{t.type}</Badge>
                </li>
              ))}
              {directChildren.length > 10 ? (
                <li className="py-2 text-xs text-aivo-ink-soft">
                  + {directChildren.length - 10} more
                </li>
              ) : null}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Recent AI jobs</p>
            <Link href="/admin/platform/jobs" className="text-sm text-aivo-primary hover:underline">
              View all
            </Link>
          </div>
          {jobs.length === 0 ? (
            <EmptyState title="No AI generation activity" />
          ) : (
            <ul className="space-y-2 text-sm">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{j.kind.replace("_", " ")}</span>
                  <Badge
                    tone={
                      j.status === "complete"
                        ? "success"
                        : j.status === "failed"
                          ? "danger"
                          : j.status === "running"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {j.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Recent invoices</p>
            <Link
              href="/admin/platform/billing/invoices"
              className="text-sm text-aivo-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <ul className="space-y-2 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{inv.number}</span>
                  <span className="tabular-nums">${(inv.amountCents / 100).toFixed(2)}</span>
                  <Badge
                    tone={
                      inv.status === "paid"
                        ? "success"
                        : inv.status === "open"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {inv.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-[var(--aivo-density-card-pad)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-semibold">Audit trail</p>
          <Link
            href="/admin/platform/audit-logs"
            className="text-sm text-aivo-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {auditLogs.length === 0 ? (
          <EmptyState title="No audited activity" />
        ) : (
          <ul className="divide-y divide-aivo-border text-sm">
            {auditLogs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{log.action}</p>
                  <p className="text-xs text-aivo-ink-soft">{log.userId ?? "system"}</p>
                </div>
                <span className="text-xs text-aivo-ink-soft">
                  {new Date(log.occurredAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
