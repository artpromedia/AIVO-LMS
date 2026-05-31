import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { scopeTenantsForSession } from "@/lib/db/repos";
import { getStore } from "@/lib/db/store";

export default async function Page() {
  const session = await requirePageRole(["school_admin"]);
  const t = await getTranslations("admin.school_learners");
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const ids = new Set(tenants.map((t) => t.id));
  const learners = Array.from(getStore().learnerProfiles.values()).filter((l) =>
    ids.has(l.tenantId),
  );

  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title={t("title")}
        description="Every learner whose family is rostered under this school."
      />
      {learners.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">{t("col_learner")}</th>
                <th className="p-3">Grade</th>
                <th className="p-3">{t("col_readiness")}</th>
                <th className="p-3">{t("col_fl")}</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.id} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">{l.displayName}</td>
                  <td className="p-3 text-aivo-ink-soft">{l.gradeBand}</td>
                  <td className="p-3">
                    <Badge tone="primary">{l.readinessState}</Badge>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">{l.functioningLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
