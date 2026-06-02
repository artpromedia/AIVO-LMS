import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listDataExportRequestsForUser, listLearnersForParent } from "@/lib/db/repos";
import { ExportRequestForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.privacy_export");
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const requests = listDataExportRequestsForUser(session.userId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <ExportRequestForm
          learners={learners.map((l) => ({ id: l.id, displayName: l.displayName }))}
        />
      </Card>

      <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display font-semibold">{t("past_requests")}</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-aivo-ink-soft">{t("no_requests")}</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-aivo-muted">
              <tr>
                <th className="py-2">{t("th_requested")}</th>
                <th className="py-2">{t("th_scope")}</th>
                <th className="py-2">{t("th_status")}</th>
                <th className="py-2">{t("th_completed")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-aivo-border">
                  <td className="py-2">{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="py-2">
                    {r.learnerId
                      ? (learners.find((l) => l.id === r.learnerId)?.displayName ?? r.learnerId)
                      : t("all_my_data")}
                  </td>
                  <td className="py-2">
                    <Badge
                      tone={
                        r.status === "completed"
                          ? "success"
                          : r.status === "denied"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-aivo-ink-soft">
                    {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
