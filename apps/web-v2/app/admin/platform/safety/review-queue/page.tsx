import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listModerationEvents } from "@aivo/admin-api/moderation";
import { ReviewActions } from "./actions";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "PENDING" || status === "LOW_CONFIDENCE") return "warning" as const;
  if (status === "ESCALATED") return "danger" as const;
  if (status === "REJECTED") return "neutral" as const;
  return "success" as const;
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_safety_review_queue");
  const cases = await listModerationEvents(session, { perPage: 200 });
  const reviewCases = cases.filter(
    (event) => event.status === "PENDING" || event.status === "LOW_CONFIDENCE",
  );

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
        description="Moderation records that need a human decision."
      />
      <div className="space-y-3">
        {reviewCases.length === 0 ? (
          <Card className="p-[var(--aivo-density-card-pad)] text-sm text-aivo-muted">
            {t("empty_body")}
          </Card>
        ) : (
          reviewCases.map((event) => (
            <Card key={event.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(event.status)}>{event.status.toLowerCase()}</Badge>
                    <span className="text-xs text-aivo-muted">
                      {event.contentType.replace(/_/g, " ")} | {event.flagReason.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{event.content}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {event.tutorSku ? <Badge tone="neutral">{event.tutorSku}</Badge> : null}
                    {event.modelUsed ? <Badge tone="neutral">{event.modelUsed}</Badge> : null}
                    {event.flagConfidence !== null ? (
                      <Badge tone="neutral">confidence {event.flagConfidence.toFixed(3)}</Badge>
                    ) : null}
                  </div>
                  {event.reviewNotes ? (
                    <p className="mt-2 text-xs text-aivo-muted">Notes: {event.reviewNotes}</p>
                  ) : null}
                </div>
                <div className="whitespace-nowrap text-[11px] text-aivo-muted">
                  {new Date(event.createdAt).toLocaleString()}
                </div>
              </div>
              <ReviewActions caseId={event.id} />
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
