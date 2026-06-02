import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { computeSystemHealth, scopeTenantsForSession } from "@/lib/db/repos";
import { REPORT_CATALOG } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const t = await getTranslations("admin.school_reports");
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const health = computeSystemHealth(tenants.map((t) => t.id));
  const stats = [
    { k: "Lessons completed", v: health.lessonRunsCompleted.toLocaleString() },
    { k: "Total lesson runs", v: health.lessonRunsTotal.toLocaleString() },
    { k: "AI generation success", v: `${Math.round(health.generationSuccessRate * 100)}%` },
    { k: "AI failures", v: health.generationFailureCount.toString() },
  ];

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title={t("title")}
        description="Aggregate activity across every family rostered under this school."
      />

      {/* Existing stats — unchanged */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{s.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.v}</p>
          </Card>
        ))}
      </div>

      {/* Report catalog — added in Sprint 6 */}
      <section className="mt-8" aria-labelledby="report-catalog-heading">
        <h2
          id="report-catalog-heading"
          className="font-iw-display text-xl font-semibold text-iw-ink mb-4"
        >
          Available reports
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_CATALOG.map((report) => (
            <Link
              key={report.id}
              href={`/admin/school/reports/${report.id}`}
              className="block rounded-iw-card border border-iw-border bg-iw-card p-5 transition-colors hover:border-iw-primary hover:bg-iw-raised"
            >
              <h3 className="font-semibold text-iw-ink">{report.name}</h3>
              <p className="mt-1 text-sm text-iw-ink-muted">{report.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
