import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  listSecurityControls,
  listStatePrivacyMappingsFor,
  listStatePrivacyRequirements,
} from "@/lib/db/repos";

const STATUS_TONE = {
  covered: "success",
  partial: "warning",
  gap: "danger",
  not_applicable: "neutral",
} as const;

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const reqs = listStatePrivacyRequirements();
  const controls = listSecurityControls();

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Security"
        title="State privacy law matrix"
        description="FERPA, COPPA, SOPIPA, NY 2-d, IL SOPPA, Colorado, Connecticut, and the Student Privacy Pledge — mapped to our controls."
      />
      <div className="space-y-3">
        {reqs.map((r) => {
          const mappings = listStatePrivacyMappingsFor(r.id);
          return (
            <Card key={r.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-base font-semibold">{r.label}</p>
                  <p className="text-xs text-aivo-muted">{r.jurisdiction}</p>
                </div>
                <Badge tone="neutral">{r.code}</Badge>
              </div>
              <p className="mb-2 text-sm text-aivo-ink-soft">{r.summary}</p>
              <p className="mb-3 text-sm">
                <span className="font-semibold">Obligation: </span>
                {r.obligation}
              </p>
              <div className="rounded-lg border border-aivo-border bg-aivo-surface-soft p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-aivo-ink-soft">
                  Mapped controls ({mappings.length})
                </p>
                {mappings.length === 0 ? (
                  <p className="text-sm text-aivo-danger">No control mapped yet — this is a gap.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {mappings.map((m) => {
                      const c = controls.find((c) => c.id === m.controlId);
                      return (
                        <li key={m.id} className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs">{c?.code ?? "—"}</span>
                            <span>{c?.title ?? "Unknown control"}</span>
                            <Badge tone={STATUS_TONE[m.status]}>{m.status.replace("_", " ")}</Badge>
                          </div>
                          <p className="text-xs text-aivo-ink-soft">{m.evidence}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
