import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listCurriculumImportJobs } from "@/lib/db/repos";
import { ImportForm } from "./form";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("admin.platform_curriculum_import");
  const session = await requirePageRole(["platform_admin"]);
  const jobs = listCurriculumImportJobs();
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Curriculum"
        title={t("title")}
        description="Trigger a curriculum import job. Each job records what was added so admins can audit catalog changes over time."
      />
      <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <h2 className="font-display font-semibold mb-3">{t("start_an_import")}</h2>
          <ImportForm />
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <h2 className="font-display font-semibold mb-3">{t("recent_jobs")}</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-aivo-muted">{t("no_import_jobs_yet")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {jobs.slice(0, 20).map((j) => (
                <li key={j.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{j.frameworkSlug}</div>
                    <div className="text-[11px] text-aivo-muted">
                      {j.source} · {new Date(j.startedAt).toLocaleString()}
                    </div>
                    {j.error && <div className="text-[11px] text-red-600 mt-1">{j.error}</div>}
                  </div>
                  <div className="text-right">
                    <Badge
                      tone={
                        j.status === "succeeded"
                          ? "success"
                          : j.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {j.status}
                    </Badge>
                    <div className="text-[11px] text-aivo-muted mt-1">
                      {j.imported.standards} standards
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
