import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listVulnerabilities } from "@/lib/db/repos";

const SEV_TONE = { critical: "danger", high: "danger", medium: "warning", low: "neutral" } as const;
const STATUS_TONE = { open: "danger", triaged: "warning", fixed: "success", wontfix: "neutral" } as const;

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const vulns = listVulnerabilities();

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Security"
        title="Vulnerability management"
        description="Dependency, container, IaC, and pen-test findings — triaged centrally."
      />
      {vulns.length === 0 ? (
        <Card className="p-6 text-sm text-aivo-ink-soft">No vulnerabilities currently tracked.</Card>
      ) : (
        <div className="space-y-3">
          {vulns.map((v) => (
            <Card key={v.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-sm font-semibold">{v.title}</p>
                <div className="flex items-center gap-2">
                  <Badge tone={SEV_TONE[v.severity]}>{v.severity}</Badge>
                  <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
                  <Badge tone="neutral">{v.source.replace("_", " ")}</Badge>
                </div>
              </div>
              <p className="text-xs text-aivo-muted">
                {v.cveId && <span className="font-mono">{v.cveId} · </span>}
                Component: <span className="text-aivo-ink">{v.affectedComponent}</span>
                {v.fixedIn && <> · Fixed in {v.fixedIn}</>} · Discovered{" "}
                {new Date(v.discoveredAt).toLocaleDateString()}
                {v.resolvedAt && <> · Resolved {new Date(v.resolvedAt).toLocaleDateString()}</>}
              </p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
