import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { platformNavForSession } from "@/components/layout/role-shells";
import { ROLE_LABEL } from "@/lib/auth/types";
import {
  ENTERPRISE_FLAG_META,
  resolveEnterpriseFlags,
  type EnterpriseFlagKey,
  type FlagMeta,
} from "@aivo/feature-flags";

export const dynamic = "force-dynamic";

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
        {flags.map((flag) => (
          <li key={flag.key}>
            <Card className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{flag.label}</p>
                <div className="flex gap-2">
                  <Badge tone={flag.active ? "success" : "neutral"}>
                    {flag.active ? "Active" : "Off"}
                  </Badge>
                  <Badge tone={riskTone(flag.riskBand)}>{flag.riskBand} risk</Badge>
                </div>
              </div>
              <p className="text-sm text-aivo-ink-soft">{flag.description}</p>
              <p className="text-xs font-mono text-aivo-ink-soft" data-testid="flag-envvar">
                {flag.envVar}
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
  const t = await getTranslations("admin.platform_feature_flags");

  const env = (process.env ?? {}) as Record<string, string | undefined>;
  const resolved = resolveEnterpriseFlags(env);
  const all: Array<FlagMeta & { active: boolean }> = Object.values(ENTERPRISE_FLAG_META).map(
    (meta) => ({ ...meta, active: resolved[meta.key as EnterpriseFlagKey] }),
  );
  const grouped = {
    ai: all.filter((meta) => meta.surface === "ai"),
    enterprise: all.filter((meta) => meta.surface === "enterprise"),
    integrations: all.filter((meta) => meta.surface === "integrations"),
    ux: all.filter((meta) => meta.surface === "ux"),
  };

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={platformNavForSession(session)}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title={t("title")}
        description="Source of truth remains env configuration. This inventory now shows both AIVO feature flags and the delegated-admin RBAC rollout toggle."
      />

      <SurfaceSection title={t("section_ai")} flags={grouped.ai} />
      <SurfaceSection title={t("section_enterprise")} flags={grouped.enterprise} />
      <SurfaceSection title={t("section_integrations")} flags={grouped.integrations} />
      <SurfaceSection title={t("section_ux")} flags={grouped.ux} />
    </AppShell>
  );
}
