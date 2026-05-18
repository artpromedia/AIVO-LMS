import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listVendors } from "@/lib/db/repos";

const TIER_TONE = { tier1: "danger", tier2: "warning", tier3: "neutral" } as const;

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const vendors = listVendors();
  const subprocessors = vendors.filter((v) => v.processesLearnerData);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Security"
        title="Vendor & subprocessor inventory"
        description="Anyone processing learner data appears in the public subprocessor list."
      />
      <Card className="mb-6 p-[var(--aivo-density-card-pad)]">
        <p className="mb-1 font-display text-base font-semibold">
          Subprocessors (process learner data)
        </p>
        <p className="mb-3 text-xs text-aivo-muted">
          {subprocessors.length} on file · IL SOPPA + NY 2-d compliant disclosure.
        </p>
        <ul className="space-y-1 text-sm">
          {subprocessors.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{v.name}</span>
              <span className="text-xs text-aivo-ink-soft">
                {v.category.replace("_", " ")} · {v.dataResidency}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-3">
        {vendors.map((v) => (
          <Card key={v.id} className="p-[var(--aivo-density-card-pad)]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-base font-semibold">{v.name}</p>
                <p className="text-xs text-aivo-muted">
                  {v.category.replace("_", " ")} · {v.dataResidency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={TIER_TONE[v.riskTier]}>{v.riskTier}</Badge>
                <Badge tone={v.dpaSigned ? "success" : "danger"}>
                  {v.dpaSigned ? "DPA signed" : "No DPA"}
                </Badge>
                <Badge tone={v.approved ? "success" : "warning"}>
                  {v.approved ? "Approved" : "Pending"}
                </Badge>
                {v.processesLearnerData && <Badge tone="warning">Learner data</Badge>}
              </div>
            </div>
            {v.notes && <p className="mb-2 text-sm text-aivo-ink-soft">{v.notes}</p>}
            <p className="text-xs text-aivo-muted">
              Last reviewed {new Date(v.lastReviewedAt).toLocaleDateString()}
            </p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
