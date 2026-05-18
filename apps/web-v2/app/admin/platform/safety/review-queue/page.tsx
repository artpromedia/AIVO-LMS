import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getModerationEvent, listHumanReviewCases } from "@/lib/db/repos";
import { ReviewActions } from "./actions";

export const dynamic = "force-dynamic";

function statusTone(s: string) {
  if (s === "open") return "warning" as const;
  if (s === "in_review") return "primary" as const;
  if (s === "escalated") return "danger" as const;
  return "success" as const;
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const cases = listHumanReviewCases({});
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Safety"
        title="Review queue"
        description="Moderation events that need a human decision. Resolving a case allows or blocks the original content and is auditable."
      />
      <div className="space-y-3">
        {cases.length === 0 ? (
          <Card className="p-[var(--aivo-density-card-pad)] text-aivo-muted text-sm">
            No review cases yet.
          </Card>
        ) : (
          cases.map((c) => {
            const event = getModerationEvent(c.eventId);
            return (
              <Card key={c.id} className="p-[var(--aivo-density-card-pad)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone(c.status)}>{c.status.replace(/_/g, " ")}</Badge>
                      {event && (
                        <span className="text-xs text-aivo-muted">
                          {event.subjectKind.replace(/_/g, " ")} · {event.classification.severity}
                        </span>
                      )}
                    </div>
                    {event && <p className="mt-2 text-sm">{event.excerpt}</p>}
                    {event && event.classification.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {event.classification.categories.map((cat) => (
                          <Badge key={cat} tone="neutral">
                            {cat.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {c.resolution && (
                      <p className="mt-2 text-xs text-aivo-muted">Resolution: {c.resolution}</p>
                    )}
                  </div>
                  <div className="text-[11px] text-aivo-muted whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
                {c.status === "open" || c.status === "in_review" ? (
                  <ReviewActions caseId={c.id} />
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
