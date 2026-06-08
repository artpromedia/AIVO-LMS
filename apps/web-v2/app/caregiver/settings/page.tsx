/**
 * Caregiver settings — profile + notification preferences summary.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getNotificationPreference } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("caregiver.settings");
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  const prefs = await getNotificationPreference(session.userId, session.tenantId);
  const channelCount = (channel: "in_app" | "email" | "push") =>
    Object.entries(prefs.preferences).filter(
      ([key, enabled]) => key.endsWith(`:${channel}`) && enabled,
    ).length;

  return (
    <AppShell
      role="caregiver"
      roleLabel="Caregiver"
      navItems={CAREGIVER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader title={t("page_title")} description="Your profile and preferences." />

      <SectionHeader title={t("section_profile")} />
      <Card className="p-4">
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="font-medium text-aivo-muted">Name</dt>
          <dd>{session.displayName}</dd>
          <dt className="font-medium text-aivo-muted">Email</dt>
          <dd>{session.email}</dd>
          <dt className="font-medium text-aivo-muted">Role</dt>
          <dd>{t("role_label")}</dd>
        </dl>
      </Card>

      <SectionHeader title={t("section_notifications")} />
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="primary">In-app · {channelCount("in_app")}</Badge>
          <Badge tone="neutral">Email · {channelCount("email")}</Badge>
          <Badge tone="neutral">Push · {channelCount("push")}</Badge>
          <span className="text-aivo-ink-soft">
            Digest cadence: {prefs.digestCadence}
            {prefs.quietHours ? ` · quiet ${prefs.quietHours}` : ""}
          </span>
        </div>
        <p className="mt-3 text-xs text-aivo-ink-soft">
          Edit channels and quiet hours from the{" "}
          <Link href="/notifications" className="text-aivo-accent hover:underline">
            notifications surface
          </Link>
          .
        </p>
      </Card>
    </AppShell>
  );
}
