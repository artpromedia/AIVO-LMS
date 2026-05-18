import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  listAuditLogsForTenants,
  listIncidents,
  listRisks,
  listSecurityControls,
  listStatePrivacyRequirements,
  listVendors,
  listVulnerabilities,
  scopeTenantsForSession,
} from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const recent = listAuditLogsForTenants(
    tenants.map((t) => t.id),
    10,
  );
  const controls = listSecurityControls();
  const incidents = listIncidents();
  const risks = listRisks();
  const vendors = listVendors();
  const reqs = listStatePrivacyRequirements();
  const vulns = listVulnerabilities();

  const implemented = controls.filter((c) => c.status === "implemented").length;
  const openIncidents = incidents.filter(
    (i) => i.status !== "resolved" && i.status !== "post_mortem",
  ).length;
  const openVulns = vulns.filter((v) => v.status === "open" || v.status === "triaged").length;
  const openHighRisks = risks.filter(
    (r) => r.open && (r.residualSeverity === "high" || r.residualSeverity === "critical"),
  ).length;

  const tiles = [
    {
      label: "Controls implemented",
      value: `${implemented}/${controls.length}`,
      href: "/admin/platform/security/controls",
      tone: implemented === controls.length ? "success" : "warning",
    },
    {
      label: "Open incidents",
      value: String(openIncidents),
      href: "/admin/platform/security/incidents",
      tone: openIncidents === 0 ? "success" : "danger",
    },
    {
      label: "Open vulnerabilities",
      value: String(openVulns),
      href: "/admin/platform/security/vulnerabilities",
      tone: openVulns === 0 ? "success" : "warning",
    },
    {
      label: "High/critical risks",
      value: String(openHighRisks),
      href: "/admin/platform/security/risks",
      tone: openHighRisks === 0 ? "success" : "warning",
    },
    {
      label: "Vendors on file",
      value: String(vendors.length),
      href: "/admin/platform/security/vendors",
      tone: "neutral",
    },
    {
      label: "Privacy laws tracked",
      value: String(reqs.length),
      href: "/admin/platform/security/state-privacy",
      tone: "neutral",
    },
  ] as const;

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Security"
        title="Security posture"
        description="SOC 2 controls, incidents, vendors, and the state-privacy matrix in one place."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group">
            <Card className="flex h-full flex-col justify-between gap-3 p-4 transition group-hover:border-aivo-primary">
              <p className="text-sm font-medium text-aivo-ink-soft">{t.label}</p>
              <p className="font-display text-2xl font-semibold">{t.value}</p>
              <Badge tone={t.tone}>
                {t.tone === "success"
                  ? "Healthy"
                  : t.tone === "danger"
                    ? "Needs attention"
                    : t.tone === "warning"
                      ? "Watch"
                      : "Tracked"}
              </Badge>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="mb-3 font-display text-lg font-semibold">Recent activity</p>
        {recent.length === 0 ? (
          <p className="text-sm text-aivo-ink-soft">No events yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recent.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="font-mono text-xs text-aivo-ink-soft">
                  {new Date(l.occurredAt).toLocaleString()}
                </span>
                <span className="flex-1 truncate">{l.action}</span>
                <span className="text-xs text-aivo-muted">{l.userId ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/admin/platform/audit-logs"
          className="mt-3 inline-block text-xs font-medium text-aivo-primary hover:underline"
        >
          See full audit log →
        </Link>
      </Card>
    </AppShell>
  );
}
