import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import {
  getTenantById,
  getTenantSettings,
  getDistrictStats,
  scopeTenantsForSession,
} from "@/lib/db/repos";
import { Sparkles, ShieldCheck, Users, ArrowRight } from "lucide-react";
import { SettingsTogglesForm } from "./toggles-form";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.district_settings");
  const tenant = getTenantById(session.tenantId);
  const settings = getTenantSettings(session.tenantId);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const stats = getDistrictStats(tenants.map((t) => t.id));
  const districtName = settings.branding.displayName ?? tenant?.name ?? "District";

  const subPages: Array<{
    href: string;
    title: string;
    description: string;
    badge: string;
    Icon: typeof Sparkles;
  }> = [
    {
      href: "/admin/district/settings/branding",
      title: "Branding",
      description:
        "Display name, support email, and the primary brand colour learners and families see.",
      badge: settings.branding.primaryColor ? "Configured" : "Defaults",
      Icon: Sparkles,
    },
    {
      href: "/admin/district/settings/sso",
      title: "SSO & SCIM",
      description: "SAML/OIDC sign-in and SCIM provisioning for staff and learner directory sync.",
      badge: settings.sso.mode === "off" ? "Not configured" : settings.sso.mode.toUpperCase(),
      Icon: ShieldCheck,
    },
    {
      href: "/admin/district/settings/admins",
      title: "Admins",
      description:
        "District administrators with cross-school access to rostering, reports, and billing.",
      badge: `${stats.districtAdmins} ${stats.districtAdmins === 1 ? "admin" : "admins"}`,
      Icon: Users,
    },
  ];

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title={t("title")}
        description={`Org defaults and product controls for ${districtName}.`}
      />

      <div className="space-y-6">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">{t("org_section")}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt className="text-aivo-ink-soft">{t("tenant_name")}</dt>
              <dd className="font-medium">{tenant?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-aivo-ink-soft">{t("tenant_id")}</dt>
              <dd className="font-mono text-xs">{session.tenantId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-aivo-ink-soft">{t("schools")}</dt>
              <dd className="font-medium">{stats.schools.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-aivo-ink-soft">{t("learners")}</dt>
              <dd className="font-medium">{stats.learners.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-aivo-ink-soft">{t("support_email")}</dt>
              <dd className="font-medium">{settings.branding.supportEmail ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-aivo-ink-soft">{t("last_update")}</dt>
              <dd className="text-xs text-aivo-ink-soft">
                {new Date(settings.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          {subPages.map(({ href, title, description, badge, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aivo-primary rounded-iw-card"
            >
              <Card className="h-full p-[var(--aivo-density-card-pad)] transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 items-center justify-center rounded-md bg-aivo-primary-soft text-aivo-primary"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <Badge tone="neutral">{badge}</Badge>
                </div>
                <p className="mt-3 font-display text-lg font-semibold">{title}</p>
                <p className="mt-1 text-sm text-aivo-ink-soft">{description}</p>
                <p className="mt-3 inline-flex items-center text-sm font-medium text-aivo-primary">
                  {t("manage")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </p>
              </Card>
            </Link>
          ))}
        </div>

        <SettingsTogglesForm
          initial={{
            notifications: settings.notifications,
            features: settings.features,
          }}
        />
      </div>
    </AppShell>
  );
}
