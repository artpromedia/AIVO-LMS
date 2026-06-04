import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { LtiPlatformsCard } from "./lti-platforms-card";

/**
 * LTI 1.3 platform registration (Sprint 6C). Lets a platform/district/school
 * admin register an LMS (issuer, client_id, JWKS + OAuth URLs, deployments)
 * without a manual DB insert. The persisted rows gate launch validation and
 * AGS score write-back in integration-svc.
 */
export default async function LtiPlatformsPage() {
  const session = await requirePageRole(["platform_admin", "district_admin", "school_admin"]);
  const t = await getTranslations("lti_admin");

  return (
    <AppShell
      role={session.role}
      roleLabel="Admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={t("page.eyebrow")}
        title={t("page.title")}
        description={t("page.description")}
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <LtiPlatformsCard />
      </Card>
    </AppShell>
  );
}
