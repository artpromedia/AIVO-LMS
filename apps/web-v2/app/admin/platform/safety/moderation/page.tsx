import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listModerationEvents } from "@aivo/admin-api/moderation";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "REJECTED") return "danger" as const;
  if (status === "PENDING" || status === "LOW_CONFIDENCE") return "warning" as const;
  if (status === "ESCALATED") return "primary" as const;
  return "success" as const;
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_safety_moderation");
  const events = await listModerationEvents(session, { perPage: 200 });

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Safety"
        title={t("title")}
        description="Recorded moderation decisions from admin-svc."
      />
      <Card className="overflow-hidden p-0">
        {events.length === 0 ? (
          <EmptyState title={t("empty_body")} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase text-aivo-muted">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">{t("col_subject")}</th>
                <th className="px-4 py-2 text-left">{t("col_decision")}</th>
                <th className="px-4 py-2 text-left">{t("col_categories")}</th>
                <th className="px-4 py-2 text-left">{t("col_severity")}</th>
                <th className="px-4 py-2 text-left">{t("col_excerpt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-[11px] text-aivo-muted">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{event.contentType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone(event.status)}>{event.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone="neutral">{event.flagReason.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {event.flagConfidence === null ? "unknown" : event.flagConfidence.toFixed(3)}
                  </td>
                  <td className="px-4 py-2 text-xs text-aivo-muted">
                    {event.content.slice(0, 120)}
                    {event.content.length > 120 ? "..." : ""}
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
