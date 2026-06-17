import Link from "next/link";
import { CreditCard, ShieldCheck, User } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getBillingForTenant, getTenantById } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.settings");
  const billing = await getBillingForTenant(session.tenantId);
  const tenant = getTenantById(session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/parent/settings/account"
          className="flex items-start gap-3 rounded-iw-card-lg bg-white border border-iw-border p-5 shadow-soft-3 hover:border-[var(--aivo-sensory-primary)] transition-colors"
        >
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-iw-control bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)] shrink-0">
            <User className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-iw-text-strong">{t("account_label")}</span>
            <span className="mt-1 block text-sm text-iw-text-muted">
              {session.displayName} · {session.email}
            </span>
          </span>
        </Link>
        <Link
          href="/parent/settings/billing"
          className="flex items-start gap-3 rounded-iw-card-lg bg-white border border-iw-border p-5 shadow-soft-3 hover:border-[var(--aivo-sensory-primary)] transition-colors"
        >
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-iw-control bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)] shrink-0">
            <CreditCard className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-iw-text-strong">{t("billing_label")}</span>
            <span className="mt-1 block text-sm text-iw-text-muted">
              {tenant?.name ?? "Your family"} ·{" "}
              {billing ? `${billing.plan} (${billing.status})` : "no plan provisioned"}
            </span>
            {billing ? (
              <Badge tone={billing.status === "active" ? "success" : "warning"} className="mt-3">
                {billing.status}
              </Badge>
            ) : null}
          </span>
        </Link>
      </div>
      <SectionHeader className="mt-10" title={t("privacy_label")} description={t("privacy_desc")} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href="/parent/privacy"
          className="flex items-start gap-3 rounded-iw-card-lg bg-white border border-iw-border p-5 shadow-soft-3 hover:border-[var(--aivo-sensory-primary)] transition-colors"
        >
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-iw-control bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)] shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-iw-text-strong">{t("privacy_label")}</span>
            <span className="mt-1 block text-sm text-iw-text-muted">{t("privacy_desc")}</span>
          </span>
        </Link>
      </div>
    </AppShell>
  );
}
