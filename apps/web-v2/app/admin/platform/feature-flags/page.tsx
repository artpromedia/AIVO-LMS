/**
 * Sprint 12 — feature-flag inventory for platform admins.
 *
 * Read-only listing of every enterprise + sprint-pipeline flag with
 * its env var, description, risk band, and current active state.
 * Editing is gated by ops on purpose — env vars stay the source of
 * truth so the production runbook and the UI never disagree.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ENTERPRISE_FLAG_META,
  resolveEnterpriseFlags,
  type EnterpriseFlagKey,
  type FlagMeta,
} from "@aivo/feature-flags";
import { Flag, FileText, Building2, Settings as SettingsIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin/platform", label: "Overview", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/platform/feature-flags", label: "Feature flags", icon: <Flag className="h-4 w-4" /> },
  { href: "/admin/platform/audit-logs", label: "Audit logs", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/platform/settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" /> },
];

function riskTone(band: FlagMeta["riskBand"]): "success" | "warning" | "danger" {
  if (band === "low") return "success";
  if (band === "medium") return "warning";
  return "danger";
}

function SurfaceSection({
  title,
  flags,
}: {
  title: string;
  flags: Array<FlagMeta & { active: boolean }>;
}) {
  if (flags.length === 0) return null;
  return (
    <>
      <SectionHeader title={title} />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {flags.map((f) => (
          <li key={f.key}>
            <Card className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{f.label}</p>
                <div className="flex gap-2">
                  <Badge tone={f.active ? "success" : "neutral"}>
                    {f.active ? "Active" : "Off"}
                  </Badge>
                  <Badge tone={riskTone(f.riskBand)}>{f.riskBand} risk</Badge>
                </div>
              </div>
              <p className="text-sm text-aivo-ink-soft">{f.description}</p>
              <p className="text-xs font-mono text-aivo-ink-soft" data-testid="flag-envvar">
                {f.envVar}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function PlatformFeatureFlagsPage() {
  const session = await requirePageRole(["platform_admin"]);

  const env = (process.env ?? {}) as Record<string, string | undefined>;
  const resolved = resolveEnterpriseFlags(env);
  const all: Array<FlagMeta & { active: boolean }> = Object.values(
    ENTERPRISE_FLAG_META,
  ).map((m) => ({ ...m, active: resolved[m.key as EnterpriseFlagKey] }));
  const grouped = {
    ai: all.filter((m) => m.surface === "ai"),
    enterprise: all.filter((m) => m.surface === "enterprise"),
    integrations: all.filter((m) => m.surface === "integrations"),
    ux: all.filter((m) => m.surface === "ux"),
  };

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title="Feature flags"
        description="Source of truth is the AIVO_FEATURE_* env vars. This page surfaces what's live so the runbook and the runtime can never drift."
      />

      <SurfaceSection title="AI & content" flags={grouped.ai} />
      <SurfaceSection title="Enterprise" flags={grouped.enterprise} />
      <SurfaceSection title="Integrations" flags={grouped.integrations} />
      <SurfaceSection title="Learner experience" flags={grouped.ux} />
    </AppShell>
  );
}
