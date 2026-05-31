import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listEvidenceForControl, listSecurityControls } from "@/lib/db/repos";

const STATUS_TONE = {
  implemented: "success",
  partial: "warning",
  not_started: "danger",
  not_applicable: "neutral",
} as const;

const CRITERION_LABEL = {
  security: "Security",
  availability: "Availability",
  processing_integrity: "Processing integrity",
  confidentiality: "Confidentiality",
  privacy: "Privacy",
} as const;

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_security_controls");
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
        title={t("title")}
        description="Trust Services Criteria coverage with evidence ready for the auditor."
      />
      <div className="space-y-3">
        {controls.map((c) => {
          const evidence = listEvidenceForControl(c.id);
          return (
            <Card key={c.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-aivo-ink-soft">{c.code}</span>
                  <span className="font-display text-base font-semibold">{c.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{CRITERION_LABEL[c.criterion]}</Badge>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status.replace("_", " ")}</Badge>
                </div>
              </div>
              <p className="mb-3 text-sm text-aivo-ink-soft">{c.description}</p>
              <p className="text-xs text-aivo-muted">
                {t("label_owner")} <span className="text-aivo-ink">{c.owner}</span> · Last reviewed{" "}
                {new Date(c.lastReviewedAt).toLocaleDateString()}
              </p>
              {evidence.length > 0 && (
                <div className="mt-3 rounded-lg border border-aivo-border bg-aivo-surface-soft p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-aivo-ink-soft">
                    Evidence ({evidence.length})
                  </p>
                  <ul className="space-y-1 text-sm">
                    {evidence.map((e) => (
                      <li key={e.id} className="flex items-center gap-2">
                        <Badge tone="neutral">{e.kind}</Badge>
                        <span>{e.summary}</span>
                        {e.uri && (
                          <span className="font-mono text-xs text-aivo-muted">· {e.uri}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
