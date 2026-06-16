"use client";

/**
 * Sprint C-13 — the "what changed since you approved" timeline (client).
 *
 * Renders a single newest-first spine that interleaves brain-profile CHANGE
 * records (mastery + structural) with the C-06 APPROVAL records, plus a
 * parent-readable REGRESSION insights section. Pending structural deltas carry
 * an "acknowledge" button (optimistic; posts to the parent-scoped ack BFF) and
 * every entry links onward to the C-05 review screen so the parent can ADJUST
 * rather than merely acknowledge.
 *
 * Accessibility: the timeline is an ordered list; each ack control is a real
 * <button> with an accessible label; status changes are announced via an
 * aria-live region. No animation beyond a CSS opacity settle that is disabled
 * under reduced motion (see the page's <style>). Colour is never the only
 * signal — every badge pairs an icon-free word with its tone.
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  LearnerBrainProfileChange,
  BrainProfileApproval,
} from "@/lib/db/types";
import type { RegressionInsight } from "@/lib/services/brain-svc";

/** A unified timeline row — either a change record or an approval record. */
type TimelineEntry =
  | { kind: "change"; at: string; change: LearnerBrainProfileChange }
  | { kind: "approval"; at: string; approval: BrainProfileApproval };

export function BrainTimelineClient({
  learnerId,
  learnerName,
  changes: initialChanges,
  approvals,
  insights,
}: {
  learnerId: string;
  learnerName: string;
  changes: LearnerBrainProfileChange[];
  approvals: BrainProfileApproval[];
  insights: RegressionInsight[];
}) {
  const t = useTranslations("parent.learner_brain_timeline");
  const [changes, setChanges] = useState(initialChanges);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const entries: TimelineEntry[] = useMemo(() => {
    const merged: TimelineEntry[] = [
      ...changes.map((c) => ({ kind: "change" as const, at: c.createdAt, change: c })),
      ...approvals.map((a) => ({ kind: "approval" as const, at: a.createdAt, approval: a })),
    ];
    // Newest-first; stable tiebreak so equal timestamps don't reorder per render.
    merged.sort((x, y) => y.at.localeCompare(x.at));
    return merged;
  }, [changes, approvals]);

  const pendingCount = changes.filter((c) => c.requiresAck && !c.ackedAt).length;

  async function acknowledge(changeId: string) {
    setErrorId(null);
    setPendingId(changeId);
    try {
      const res = await fetch(
        `/api/bff/learners/${encodeURIComponent(learnerId)}/brain-changes/ack`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ changeId }),
        },
      );
      const body = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !body.ok) {
        setErrorId(changeId);
        return;
      }
      const now = new Date().toISOString();
      setChanges((prev) =>
        prev.map((c) => (c.id === changeId && !c.ackedAt ? { ...c, ackedAt: now } : c)),
      );
    } catch {
      setErrorId(changeId);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending summary + announce region. */}
      <p className="sr-only" role="status" aria-live="polite">
        {pendingCount === 0
          ? t("empty_title")
          : pendingCount === 1
            ? t("pending_summary_one")
            : t("pending_summary_other", { count: pendingCount })}
      </p>

      {/* Regression insights — gentle, paired with a next step. Only when present. */}
      {insights.length > 0 ? (
        <section aria-labelledby="bt-insights-title">
          <h2 id="bt-insights-title" className="text-sm font-semibold text-iw-ink">
            {t("insights_title")}
          </h2>
          <p className="mt-0.5 text-xs text-iw-ink-muted">{t("insights_hint")}</p>
          <div className="mt-3 space-y-3">
            {insights.map((ins) => (
              <Card key={ins.id} className="border-iw-primary/30 bg-iw-primary/5 p-4">
                <p className="font-medium text-iw-ink">{ins.headline}</p>
                <p className="mt-1 text-sm text-iw-ink-muted">{ins.body}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
                  {t("insight_next_step_label")}
                </p>
                <p className="mt-0.5 text-sm text-iw-ink-muted">{ins.nextStep}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="bt-changes-title">
        <h2 id="bt-changes-title" className="text-sm font-semibold text-iw-ink">
          {t("section_changes")}
        </h2>

        {entries.length === 0 ? (
          <Card className="mt-3 p-6 text-center">
            <p className="font-medium text-iw-ink">{t("empty_title")}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-iw-ink-muted">
              {t("empty_body", { name: learnerName })}
            </p>
          </Card>
        ) : (
          <ol className="mt-3 space-y-3">
            {entries.map((entry) =>
              entry.kind === "change" ? (
                <li key={entry.change.id}>
                  <ChangeRow
                    change={entry.change}
                    learnerId={learnerId}
                    learnerName={learnerName}
                    pending={pendingId === entry.change.id}
                    errored={errorId === entry.change.id}
                    onAck={() =>
                      startTransition(() => {
                        void acknowledge(entry.change.id);
                      })
                    }
                  />
                </li>
              ) : (
                <li key={entry.approval.id}>
                  <ApprovalRow approval={entry.approval} learnerName={learnerName} />
                </li>
              ),
            )}
          </ol>
        )}
      </section>
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function ChangeRow({
  change,
  learnerId,
  learnerName,
  pending,
  errored,
  onAck,
}: {
  change: LearnerBrainProfileChange;
  learnerId: string;
  learnerName: string;
  pending: boolean;
  errored: boolean;
  onAck: () => void;
}) {
  const t = useTranslations("parent.learner_brain_timeline");
  const isStructural = change.requiresAck;
  const isPending = isStructural && !change.ackedAt;

  const badge = !isStructural
    ? { tone: "neutral" as const, label: t("mastery_badge") }
    : isPending
      ? { tone: "primary" as const, label: t("pending_badge") }
      : { tone: "success" as const, label: t("acked_badge") };

  return (
    <Card className={`p-4 ${isPending ? "border-iw-primary/40" : ""}`} data-testid="bt-change-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            <span className="text-xs text-iw-ink-muted">
              {t("revision_label", { revision: change.revision })}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-iw-ink">{change.summary}</p>
          <p className="mt-1 text-xs text-iw-ink-muted">{formatWhen(change.createdAt)}</p>
          {isPending ? (
            <p className="mt-1 text-xs text-iw-ink-muted">
              {t("pending_window_note", { name: learnerName })}
            </p>
          ) : null}
          {errored ? (
            <p className="mt-1 text-xs text-iw-error" role="alert">
              {t("ack_error")}
            </p>
          ) : null}
        </div>
        {isStructural ? (
          isPending ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={onAck}
              aria-label={t("ack_cta")}
              data-testid="bt-ack-button"
            >
              {t("ack_cta")}
            </Button>
          ) : (
            <span className="shrink-0 text-xs font-medium text-iw-success">{t("ack_done")}</span>
          )
        ) : null}
      </div>
      {isStructural ? (
        <div className="mt-3 border-t border-iw-border pt-2">
          <Link
            href={`/parent/learners/${learnerId}/brain-review`}
            className="text-xs font-medium text-iw-primary underline-offset-2 hover:underline"
          >
            {t("adjust_cta")}
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

function ApprovalRow({
  approval,
  learnerName,
}: {
  approval: BrainProfileApproval;
  learnerName: string;
}) {
  const t = useTranslations("parent.learner_brain_timeline");
  const { tone, label, summary } =
    approval.action === "approved"
      ? {
          tone: "success" as const,
          label: t("approval_badge"),
          summary: t("approval_summary", { name: learnerName }),
        }
      : approval.action === "amended"
        ? {
            tone: "primary" as const,
            label: t("amended_badge"),
            summary: t("amended_summary", { name: learnerName }),
          }
        : {
            tone: "neutral" as const,
            label: t("declined_badge"),
            summary: t("declined_summary", { name: learnerName }),
          };
  return (
    <Card className="p-4" data-testid="bt-approval-row">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{label}</Badge>
        <span className="text-xs text-iw-ink-muted">
          {t("revision_label", { revision: approval.profileRevision })}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-iw-ink">{summary}</p>
      <p className="mt-1 text-xs text-iw-ink-muted">{formatWhen(approval.createdAt)}</p>
    </Card>
  );
}
