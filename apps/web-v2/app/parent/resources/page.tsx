import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { SectionCard } from "../home-v2/_components/SectionCard";
import { AivoIcon, type AivoIconName } from "@aivo/ui/icon";

/**
 * Parent → Resources (Wave 2).
 *
 * There is no dedicated resource-svc / downloadable-library data model yet, so this
 * page is deliberately honest: it surfaces real in-app destinations a parent already
 * has (privacy centre, reports, messaging, account) and renders an explicit empty
 * state for the future curated library rather than fabricating articles or downloads.
 */

type QuickLink = {
  href: string;
  icon: AivoIconName;
  titleKey: string;
  descKey: string;
};

const QUICK_LINKS: QuickLink[] = [
  { href: "/parent/reports", icon: "mastery", titleKey: "reports_link", descKey: "reports_desc" },
  { href: "/messages", icon: "care", titleKey: "messages_link", descKey: "messages_desc" },
  { href: "/parent/privacy", icon: "consentLock", titleKey: "privacy_link", descKey: "privacy_desc" },
  { href: "/parent/settings", icon: "billingCard", titleKey: "settings_link", descKey: "settings_desc" },
];

export default async function Page() {
  const t = await getTranslations("parent.resources");
  const session = await requirePageRole(["parent"]);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="Parent" title={t("title")} description={t("subtitle")} />

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-iw-text-muted mb-3">
          {t("quick_links")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-start gap-3 rounded-iw-card-lg bg-white border border-iw-border p-4 shadow-soft-3 hover:border-[var(--aivo-sensory-primary)] transition-colors"
            >
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-iw-control bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)] shrink-0">
                <AivoIcon name={link.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-iw-text-strong">{t(link.titleKey)}</span>
                <span className="block text-sm text-iw-text-muted mt-0.5">{t(link.descKey)}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <SectionCard title={t("library_title")} iconName="library">
        <EmptyState title={t("library_empty_title")} description={t("library_empty_desc")} />
      </SectionCard>
    </AppShell>
  );
}
