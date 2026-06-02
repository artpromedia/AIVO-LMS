import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getStore } from "@/lib/db/store";
import {
  listDataInventory,
  listDisclosures,
  listAllDataExportRequests,
  listAllDataDeletionRequests,
  listPolicyVersions,
} from "@/lib/db/repos";
import { listDsars, computeKpis } from "@/lib/compliance/governance-store";
import { Database, ScrollText, Clock, ShieldCheck, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_compliance_overview");
  const store = getStore();
  const inventory = listDataInventory();
  const disclosures = listDisclosures(session.tenantId);
  const exports = listAllDataExportRequests();
  const deletes = listAllDataDeletionRequests();
  const policies = await listPolicyVersions();

  const dsars = listDsars();
  const kpis = computeKpis(dsars);

  const tiles: { href: string; label: string; v: number | string; icon: React.ReactNode }[] = [
    {
      href: "/admin/platform/compliance/data-inventory",
      label: "Data inventory",
      v: inventory.length,
      icon: <Database className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/compliance/disclosures",
      label: "Disclosures (this tenant)",
      v: disclosures.length,
      icon: <ScrollText className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/compliance/retention",
      label: "Retention policies",
      v: store.dataRetentionPolicies.size,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/compliance/dsar",
      label: "DSARs (open + closed)",
      v: exports.length + deletes.length + dsars.length,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  const pending =
    exports.filter((e) => e.status === "pending").length +
    deletes.filter((d) => d.status === "pending").length;

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title={t("title")}
        description="Data inventory, disclosure log, retention, and parent DSAR queue."
      />

      {/* DSAR KPI cards */}
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Open DSARs</p>
          <p className="mt-1 font-display text-3xl font-bold">{kpis.open}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Overdue</p>
          <p
            className={`mt-1 font-display text-3xl font-bold ${kpis.overdue > 0 ? "text-aivo-danger" : ""}`}
          >
            {kpis.overdue}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Avg fulfillment</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {kpis.avgFulfillmentHours !== null
              ? `${Math.round(kpis.avgFulfillmentHours / 24)}d`
              : "—"}
          </p>
        </Card>
      </div>

      {kpis.overdue > 0 && (
        <Card className="mb-4 p-[var(--aivo-density-card-pad)] border-l-4 border-l-aivo-danger bg-aivo-danger/5">
          <p className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-aivo-danger" />
            <strong>
              {kpis.overdue} overdue DSAR{kpis.overdue === 1 ? "" : "s"}
            </strong>{" "}
            — fulfillment deadline has passed.{" "}
            <Link className="underline font-semibold" href="/admin/platform/compliance/dsar">
              Review now
            </Link>
          </p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="block">
            <Card className="p-[var(--aivo-density-card-pad)] hover:bg-aivo-surface-2 transition">
              <div className="flex items-center gap-2 text-aivo-muted text-xs font-semibold uppercase">
                {tile.icon}
                {tile.label}
              </div>
              <p className="mt-1 font-display text-3xl font-bold">{tile.v.toLocaleString()}</p>
            </Card>
          </Link>
        ))}
      </div>

      {pending > 0 && (
        <Card className="mt-4 p-[var(--aivo-density-card-pad)] border-l-4 border-l-amber-500">
          <p className="text-sm">
            <strong>{pending} pending</strong> DSAR{pending === 1 ? "" : "s"} awaiting review.{" "}
            <Link className="underline" href="/admin/platform/compliance/dsar">
              {t("link_open_queue")}
            </Link>
          </p>
        </Card>
      )}

      <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display font-semibold">{t("active_policies_heading")}</h2>
        <ul className="mt-2 divide-y text-sm">
          {policies.map((p) => (
            <li key={p.id} className="py-2 flex items-center justify-between">
              <span>{p.kind.replace(/_/g, " ")}</span>
              <Badge tone="neutral">v{p.version}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
