import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listDataDeletionRequestsForUser, listLearnersForParent } from "@/lib/db/repos";
import { DeleteRequestForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.privacy_delete");
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const requests = await listDataDeletionRequestsForUser(session.userId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <Card className="p-[var(--aivo-density-card-pad)] border-l-4 border-l-amber-500">
        <p className="text-sm">
          <strong>{t("warning_strong")}</strong> {t("warning_body")}
        </p>
      </Card>

      <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
        <DeleteRequestForm
          learners={learners.map((l) => ({ id: l.id, displayName: l.displayName }))}
        />
      </Card>

      <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display font-semibold">{t("past_requests")}</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-iw-ink-muted">{t("no_requests")}</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-iw-ink-muted">
              <tr>
                <th className="py-2">{t("th_requested")}</th>
                <th className="py-2">{t("th_scope")}</th>
                <th className="py-2">{t("th_target")}</th>
                <th className="py-2">{t("th_status")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-iw-border">
                  <td className="py-2">{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="py-2">{r.scope}</td>
                  <td className="py-2">
                    {r.learnerId
                      ? (learners.find((l) => l.id === r.learnerId)?.displayName ?? r.learnerId)
                      : t("whole_account")}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
