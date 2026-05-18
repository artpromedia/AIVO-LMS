import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listRisks } from "@/lib/db/repos";

const SEV_TONE = { critical: "danger", high: "danger", medium: "warning", low: "neutral" } as const;
const TREATMENT_LABEL = {
  accept: "Accept",
  mitigate: "Mitigate",
  transfer: "Transfer",
  avoid: "Avoid",
} as const;

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const risks = listRisks();

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Security"
        title="Risk register"
        description="Inherent vs residual severity per risk, with treatment and owner."
      />
      {risks.length === 0 ? (
        <Card className="p-6 text-sm text-aivo-ink-soft">No risks tracked yet.</Card>
      ) : (
        <div className="space-y-3">
          {risks.map((r) => (
            <Card key={r.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-base font-semibold">{r.title}</p>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{r.category.replace("_", " ")}</Badge>
                  <Badge tone={SEV_TONE[r.inherentSeverity]}>Inherent: {r.inherentSeverity}</Badge>
                  <Badge tone={SEV_TONE[r.residualSeverity]}>Residual: {r.residualSeverity}</Badge>
                  <Badge tone={r.open ? "warning" : "success"}>{r.open ? "Open" : "Closed"}</Badge>
                </div>
              </div>
              <p className="mb-2 text-sm text-aivo-ink-soft">{r.description}</p>
              <p className="text-xs text-aivo-muted">
                Treatment: <span className="text-aivo-ink">{TREATMENT_LABEL[r.treatment]}</span> ·
                Owner: <span className="text-aivo-ink">{r.owner}</span> · Updated{" "}
                {new Date(r.updatedAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
