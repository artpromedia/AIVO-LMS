/**
 * Sprint 3 (learner roadmap): a top-level Settings hub for the learner
 * dashboard. Today it surfaces the existing language switcher and links
 * to the deeper accessibility + audio screens; future preferences (e.g.
 * notification quiet hours, parental linking) attach here without
 * touching the AppShell.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";

export const dynamic = "force-dynamic";

export default async function LearnerSettingsPage() {
  const session = await requirePageRole(["learner"]);
  if (session.role !== "learner") redirect("/learner/select");
  const t = await getTranslations("learner.settings");

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      <div className="mt-6 grid gap-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-prose">
              <h2 className="text-base font-semibold text-iw-ink">{t("language_title")}</h2>
              <p className="mt-1 text-sm text-iw-ink-muted">
                {t("language_desc")}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-iw-ink">{t("a11y_title")}</h2>
          <p className="mt-1 text-sm text-iw-ink-muted">
            {t("a11y_desc")}
          </p>
          <Link
            href="/learner/settings/accessibility"
            className="mt-3 inline-flex items-center text-sm font-semibold text-iw-primary hover:underline"
          >
            {t("a11y_link")}
          </Link>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-iw-ink">{t("sound_title")}</h2>
          <p className="mt-1 text-sm text-iw-ink-muted">
            {t("sound_desc")}
          </p>
          <Link
            href="/learner/settings/audio"
            className="mt-3 inline-flex items-center text-sm font-semibold text-iw-primary hover:underline"
          >
            {t("sound_link")}
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
