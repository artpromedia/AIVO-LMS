import Link from "next/link";
import { Permission } from "@aivo/security";
import { requirePlatformPage } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { platformNavForSession } from "@/components/layout/role-shells";
import { getTranslations } from "next-intl/server";
import { listBillingAccounts } from "@aivo/admin-api/billing";
import { getPlatformSystemHealth, listRecentAiActivity } from "@aivo/admin-api/platform";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { ROLE_LABEL } from "@/lib/auth/types";
import {
  Building2,
  Users,
  GraduationCap,
  Activity,
  Cpu,
  DollarSign,
  ArrowRight,
} from "lucide-react";

type OperationsCard = {
  href: string;
  title: string;
  description: string;
  badge: string;
  permission: Permission;
};

export default async function PlatformAdminHome() {
  const t = await getTranslations("admin.platform_overview");
  const session = await requirePlatformPage(Permission.PlatformRead);
  const [health, billingAccounts, aiActivity] = await Promise.all([
    getPlatformSystemHealth(session),
    listBillingAccounts(session).catch(() => []),
    listRecentAiActivity(session, 8).catch(() => []),
  ]);

  const billingByStatus = billingAccounts.reduce<Record<string, number>>((acc, account) => {
    acc[account.status] = (acc[account.status] ?? 0) + 1;
    return acc;
  }, {});

  const kpis: Array<{
    k: string;
    v: number;
    helper: string;
    Icon: typeof Building2;
    href: string;
    suffix?: string;
  }> = [
    {
      k: "Tenants",
      v: health.tenantsTotal,
      helper: `${health.tenantCounts.district} districts | ${health.tenantCounts.school} schools | ${health.tenantCounts.family} families`,
      Icon: Building2,
      href: sessionHasPermission(session, Permission.TenantRead)
        ? "/admin/platform/tenants"
        : "/admin/platform",
    },
    {
      k: "Users",
      v: health.usersTotal,
      helper: `${health.learnersTotal.toLocaleString()} learners enrolled`,
      Icon: Users,
      href: sessionHasPermission(session, Permission.UserRead)
        ? "/admin/platform/users"
        : "/admin/platform",
    },
    {
      k: "Lessons completed",
      v: health.lessonRunsCompleted,
      helper: `${health.lessonRunsTotal.toLocaleString()} attempted total`,
      Icon: GraduationCap,
      href: "/admin/platform/system-health",
    },
    {
      k: "AI requests (24h)",
      v: health.aiRequests24h,
      helper: `${health.aiModelsActive24h} models | $${health.aiEstimatedCostUsd24h.toFixed(2)} est.`,
      Icon: Cpu,
      href: sessionHasPermission(session, Permission.AiRead)
        ? "/admin/platform/ai"
        : "/admin/platform",
    },
  ];

  const operationsCards: OperationsCard[] = [
    {
      href: "/admin/platform/billing",
      title: "Billing",
      description: "Real subscription status across every tenant.",
      badge: `${(billingByStatus.active ?? 0).toLocaleString()} active`,
      permission: Permission.BillingRead,
    },
    {
      href: "/admin/platform/security",
      title: "Security & risk",
      description: "Vulnerability tracker, incidents, vendor reviews, risk register.",
      badge: "Monitoring",
      permission: Permission.SecurityRead,
    },
    {
      href: "/admin/platform/compliance",
      title: "Compliance",
      description: "Data inventory, retention policies, DSARs, disclosures.",
      badge: "COPPA | FERPA",
      permission: Permission.SecurityRead,
    },
    {
      href: "/admin/platform/curriculum",
      title: "Curriculum",
      description: "Frameworks, subjects, skills, and versioning.",
      badge: "Library",
      permission: Permission.CurriculumRead,
    },
    {
      href: "/admin/platform/safety",
      title: "Safety",
      description: "Moderation, review queue, red-team runs, policies.",
      badge: "AI safety",
      permission: Permission.SecurityRead,
    },
    {
      href: "/admin/platform/audit-logs",
      title: "Audit logs",
      description: "Every privileged action recorded across the platform.",
      badge: "Append-only",
      permission: Permission.AuditRead,
    },
  ];
  const visibleOperationsCards = operationsCards.filter((card) =>
    sessionHasPermission(session, card.permission),
  );

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title={t("title")}
        description="Operations and observability across every tenant on AIVO."
        actions={<Badge tone="neutral">Live service data</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ k, v, helper, Icon, href, suffix }) => (
          <Link
            key={k}
            href={href}
            className="group rounded-iw-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aivo-primary"
          >
            <Card className="h-full p-[var(--aivo-density-card-pad)] transition-shadow group-hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                    {k}
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold">
                    {v.toLocaleString()}
                    {suffix ?? ""}
                  </p>
                  <p className="mt-2 text-xs text-aivo-ink-soft">{helper}</p>
                </div>
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-aivo-primary-soft text-aivo-primary"
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold">{t("tenant_footprint")}</p>
              <p className="text-xs text-aivo-ink-soft">{t("tenant_footprint_desc")}</p>
            </div>
            <Badge tone="neutral">{health.tenantsTotal.toLocaleString()} tenants</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "Districts", v: health.tenantCounts.district },
              { k: "Schools", v: health.tenantCounts.school },
              { k: "Families", v: health.tenantCounts.family },
              { k: "Unknown", v: health.tenantCounts.unknown },
            ].map((row) => (
              <div key={row.k} className="rounded-md bg-aivo-surface-2 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
                  {row.k}
                </dt>
                <dd className="mt-1 font-display text-2xl font-bold">{row.v.toLocaleString()}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <p className="text-sm font-semibold">{t("billing_status")}</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["trialing", "active", "past_due", "canceled"].map((status) => {
                const count = billingByStatus[status] ?? 0;
                const tone: "success" | "neutral" | "warning" | "danger" =
                  status === "active"
                    ? "success"
                    : status === "past_due"
                      ? "danger"
                      : status === "trialing"
                        ? "warning"
                        : "neutral";
                return (
                  <li
                    key={status}
                    className="flex items-center justify-between rounded-md border border-aivo-border px-3 py-2 text-sm"
                  >
                    <Badge tone={tone}>{status.replace("_", " ")}</Badge>
                    <span className="font-semibold">{count.toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-aivo-primary" />
            <p className="font-display text-lg font-semibold">Recent AI activity</p>
          </div>
          {aiActivity.length === 0 ? (
            <p className="text-sm text-aivo-ink-soft">{t("no_ai_activity_yet")}</p>
          ) : (
            <ul className="space-y-2">
              {aiActivity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.model}</p>
                    <p className="text-xs text-aivo-ink-soft">
                      {entry.provider} · {entry.latencyMs} ms · {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone="neutral">${entry.estimatedCostUsd.toFixed(2)}</Badge>
                </li>
              ))}
            </ul>
          )}
          {sessionHasPermission(session, Permission.AiRead) ? (
            <Link
              href="/admin/platform/ai"
              className="mt-4 inline-flex items-center text-sm font-medium text-aivo-primary"
            >
              {t("view_all")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          ) : null}
        </Card>
      </div>

      <section className="mt-6">
        <p className="mb-3 font-display text-lg font-semibold">{t("operations_centres")}</p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visibleOperationsCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-iw-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aivo-primary"
            >
              <Card className="h-full p-[var(--aivo-density-card-pad)] transition-shadow group-hover:shadow-md">
                <div className="flex items-center justify-between">
                  <p className="font-display text-base font-semibold">{card.title}</p>
                  <Badge tone="neutral">{card.badge}</Badge>
                </div>
                <p className="mt-1 text-sm text-aivo-ink-soft">{card.description}</p>
                <p className="mt-3 inline-flex items-center text-sm font-medium text-aivo-primary">
                  Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between rounded-iw-card border border-aivo-border bg-aivo-surface-2 p-4 text-sm">
        <div className="flex items-center gap-2 text-aivo-ink-soft">
          <DollarSign className="h-4 w-4" />
          <span>
            {t("signed_in_as")} <strong>{session.email}</strong> | {ROLE_LABEL[session.role]}
          </span>
        </div>
        <Link href="/admin/platform/settings" className="font-medium text-aivo-primary hover:underline">
          {t("platform_settings")}
        </Link>
      </div>
    </AppShell>
  );
}
