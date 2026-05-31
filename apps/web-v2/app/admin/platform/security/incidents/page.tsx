import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listIncidents, listIncidentTimeline } from "@/lib/db/repos";
import { OpenIncidentForm } from "@/components/admin/security/open-incident-form";

const SEVERITY_TONE = {
  sev1: "danger",
  sev2: "warning",
  sev3: "warning",
  sev4: "neutral",
} as const;
const STATUS_TONE = {
  open: "danger",
  investigating: "warning",
  mitigating: "warning",
  resolved: "success",
  post_mortem: "neutral",
} as const;

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_security_incidents");
  const incidents = listIncidents();

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
        description="Open, investigate, mitigate, resolve. Timeline is preserved for the post-mortem."
      />
      <Card className="mb-6 p-[var(--aivo-density-card-pad)]">
        <p className="mb-3 font-display text-lg font-semibold">{t("open_incident_heading")}</p>
        <OpenIncidentForm />
      </Card>
      {incidents.length === 0 ? (
        <Card className="p-6 text-sm text-aivo-ink-soft">{t("empty_body")}</Card>
      ) : (
        <div className="space-y-3">
          {incidents.map((i) => {
            const timeline = listIncidentTimeline(i.id);
            return (
              <Card key={i.id} className="p-[var(--aivo-density-card-pad)]">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-base font-semibold">{i.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={SEVERITY_TONE[i.severity]}>{i.severity.toUpperCase()}</Badge>
                    <Badge tone={STATUS_TONE[i.status]}>{i.status.replace("_", " ")}</Badge>
                    {i.customerImpact && <Badge tone="warning">{t("badge_customer_impact")}</Badge>}
                    {i.regulatorNotificationRequired && (
                      <Badge tone="danger">{t("badge_regulator_notify")}</Badge>
                    )}
                  </div>
                </div>
                <p className="mb-3 text-sm text-aivo-ink-soft">{i.summary}</p>
                <p className="mb-3 text-xs text-aivo-muted">
                  Detected {new Date(i.detectedAt).toLocaleString()}
                  {i.resolvedAt && <> · Resolved {new Date(i.resolvedAt).toLocaleString()}</>}
                </p>
                {timeline.length > 0 && (
                  <div className="rounded-lg border border-aivo-border bg-aivo-surface-soft p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-aivo-ink-soft">
                      Timeline ({timeline.length})
                    </p>
                    <ul className="space-y-1 text-sm">
                      {timeline.map((t) => (
                        <li key={t.id} className="flex items-start gap-2">
                          <span className="font-mono text-xs text-aivo-muted">
                            {new Date(t.occurredAt).toLocaleTimeString()}
                          </span>
                          <Badge tone="neutral">{t.kind}</Badge>
                          <span className="flex-1">{t.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
