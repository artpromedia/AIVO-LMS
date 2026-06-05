import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listComplianceControls, listEvidenceBundles } from "@/lib/admin-api/compliance";
import { Database, ScrollText, Clock, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "pass") return "success" as const;
  if (status === "fail") return "danger" as const;
  if (status === "warn") return "warning" as const;
  return "neutral" as const;
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_compliance_overview");
  const [controls, bundles] = await Promise.all([
    listComplianceControls(session),
    listEvidenceBundles(session).catch(() => []),
  ]);

  const failing = controls.filter((control) => control.status === "fail").length;
  const warning = controls.filter((control) => control.status === "warn").length;
  const passing = controls.filter((control) => control.status === "pass").length;

  const tiles = [
    {
      href: "/admin/platform/compliance/data-inventory",
      label: "Data inventory",
      v: controls.length,
      icon: <Database className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/compliance/disclosures",
      label: "Disclosures",
      v: bundles.length,
      icon: <ScrollText className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/compliance/retention",
      label: "Controls warning",
      v: warning,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/compliance/dsar",
      label: "Controls passing",
      v: passing,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

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
        description="Live compliance controls and SOC2 evidence bundles from admin-svc."
        actions={<Badge tone={failing > 0 ? "danger" : warning > 0 ? "warning" : "success"}>{failing} failing</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="block">
            <Card className="p-[var(--aivo-density-card-pad)] transition hover:bg-aivo-surface-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-aivo-muted">
                {tile.icon}
                {tile.label}
              </div>
              <p className="mt-1 font-display text-3xl font-bold">{tile.v.toLocaleString()}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-left text-xs uppercase tracking-wide text-aivo-muted">
            <tr>
              <th className="px-4 py-3">Control</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Evidence</th>
              <th className="px-4 py-3">Checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-aivo-border">
            {controls.map((control) => (
              <tr key={control.id}>
                <td className="px-4 py-3 font-medium">{control.label}</td>
                <td className="px-4 py-3 text-aivo-ink-soft">{control.category}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(control.status)}>{control.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-aivo-ink-soft">{control.evidence}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-aivo-ink-soft">
                  {new Date(control.lastCheckedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {bundles.length > 0 ? (
        <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
          <h2 className="font-display font-semibold">Recent evidence bundles</h2>
          <ul className="mt-2 divide-y text-sm">
            {bundles.slice(0, 5).map((bundle) => (
              <li key={bundle.id} className="flex items-center justify-between py-2">
                <span>{bundle.bundleDate}</span>
                <span className="font-mono text-[11px] text-aivo-muted">{bundle.sha256.slice(0, 12)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </AppShell>
  );
}
