import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { getTenantSettings } from "@/lib/db/repos";
import { SSOForm } from "./sso-form";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const settings = getTenantSettings(session.tenantId);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District settings"
        title="SSO & SCIM"
        description="Single sign-on and automated user provisioning from your identity provider."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <SSOForm initial={settings.sso} />
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">Status</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-aivo-ink-soft">Mode</dt>
              <dd>
                <Badge
                  tone={settings.sso.mode === "off" ? "neutral" : "success"}
                >
                  {settings.sso.mode.toUpperCase()}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-aivo-ink-soft">SCIM</dt>
              <dd>
                <Badge tone={settings.sso.scimEnabled ? "success" : "neutral"}>
                  {settings.sso.scimEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-aivo-ink-soft">Last SCIM rotation</dt>
              <dd className="mt-1 text-xs">
                {settings.sso.lastScimRotationAt
                  ? new Date(settings.sso.lastScimRotationAt).toLocaleString()
                  : "Never rotated"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-aivo-ink-soft">
            ACS URL and entity ID for your IdP setup are in the configuration
            guide. After saving below, send the new metadata URL to your
            identity team.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
