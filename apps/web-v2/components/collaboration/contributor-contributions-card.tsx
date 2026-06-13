/**
 * Sprint C-16 — the contributor "Your contributions" card.
 *
 * Renders, per learner the contributor is on, the three designed states:
 *   - never_contributed    → a gentle invite linking to their input flow.
 *   - contributed_pending  → "shared — the family is reviewing".
 *   - acknowledged         → the warm, dated confirmation + their OWN folded
 *                            items (label + their reasoning snippet).
 *
 * PRIVACY: `foldedItems` are the contributor's OWN only (the server-side
 * derivation is scoped by their account/email). This component renders nothing
 * about the learner beyond the first name, no other contributor's content, and
 * no levels/diagnoses.
 *
 * UX: WCAG AA tones (Badge `success`/`warning`/`neutral` pull AA-contrast
 * tokens); no animation (so nothing to reduce-motion-gate); every state
 * designed. Pure presentational server component — the data + i18n are passed
 * in by the role-home page.
 */
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { contributorInputFlowPath } from "@/lib/collaboration/contributor-summary";
import type { ContributorLearnerSummary } from "@/lib/collaboration/contribution-status";

/** The subset of next-intl translations this card needs (passed from the page
 *  so the component stays server/client-agnostic). */
export type ContributorCardCopy = {
  cardTitle: string;
  /** `(name) => string` */
  neverTitle: (vars: { name: string }) => string;
  neverBody: (vars: { name: string }) => string;
  neverCta: string;
  pendingTitle: string;
  pendingBody: (vars: { name: string }) => string;
  pendingSharedOn: (vars: { date: string }) => string;
  ackTitle: (vars: { name: string }) => string;
  ackBody: (vars: { name: string }) => string;
  ackOn: (vars: { date: string }) => string;
  ackItemsLabel: string;
  addAnotherCta: string;
};

/** Build the card copy from a next-intl `contributor` namespace translator.
 *  Centralised so each role home wires the card identically. `t` is the
 *  getTranslations("contributor") function. */
export function buildContributorCardCopy(
  t: (key: string, vars?: Record<string, string>) => string,
): ContributorCardCopy {
  return {
    cardTitle: t("card_title"),
    neverTitle: ({ name }) => t("never_title", { name }),
    neverBody: ({ name }) => t("never_body", { name }),
    neverCta: t("never_cta"),
    pendingTitle: t("pending_title"),
    pendingBody: ({ name }) => t("pending_body", { name }),
    pendingSharedOn: ({ date }) => t("pending_shared_on", { date }),
    ackTitle: ({ name }) => t("ack_title", { name }),
    ackBody: ({ name }) => t("ack_body", { name }),
    ackOn: ({ date }) => t("ack_on", { date }),
    ackItemsLabel: t("ack_items_label"),
    addAnotherCta: t("add_another_cta"),
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StateBadge({
  state,
  pendingLabel,
  ackLabel,
}: {
  state: ContributorLearnerSummary["state"];
  pendingLabel: string;
  ackLabel: string;
}) {
  if (state === "acknowledged") return <Badge tone="success">{ackLabel}</Badge>;
  if (state === "contributed_pending") return <Badge tone="warning">{pendingLabel}</Badge>;
  return null;
}

function LearnerRow({
  summary,
  copy,
}: {
  summary: ContributorLearnerSummary;
  copy: ContributorCardCopy;
}) {
  const name = summary.learnerFirstName;
  if (summary.state === "acknowledged") {
    return (
      <li>
        <Card variant="accent" className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-iw-ink">{copy.ackTitle({ name })}</p>
              <p className="mt-0.5 text-sm text-iw-ink-muted">{copy.ackBody({ name })}</p>
            </div>
            <StateBadge state={summary.state} pendingLabel={copy.pendingTitle} ackLabel={copy.cardTitle} />
          </div>
          {summary.foldedItems.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-iw-ink-soft">{copy.ackItemsLabel}</p>
              <ul className="mt-1 grid gap-1 text-sm list-disc pl-5 text-iw-ink">
                {summary.foldedItems.map((item, i) => (
                  <li key={`${item.kind}:${item.key}:${i}`}>
                    <span className="font-medium">{item.label}</span>
                    {item.reasoning ? (
                      <span className="text-iw-ink-muted"> — {item.reasoning}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {summary.acknowledgedAt ? (
              <p className="text-xs text-iw-ink-soft">
                {copy.ackOn({ date: formatDate(summary.acknowledgedAt) })}
              </p>
            ) : (
              <span />
            )}
            <Link
              href={contributorInputFlowPath(summary.role, summary.learnerId)}
              className="text-sm font-medium text-aivo-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {copy.addAnotherCta}
            </Link>
          </div>
        </Card>
      </li>
    );
  }

  if (summary.state === "contributed_pending") {
    return (
      <li>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-iw-ink">{copy.pendingTitle}</p>
              <p className="mt-0.5 text-sm text-iw-ink-muted">{copy.pendingBody({ name })}</p>
            </div>
            <StateBadge state={summary.state} pendingLabel={copy.pendingTitle} ackLabel={copy.cardTitle} />
          </div>
          {summary.lastContributionAt ? (
            <p className="mt-2 text-xs text-iw-ink-soft">
              {copy.pendingSharedOn({ date: formatDate(summary.lastContributionAt) })}
            </p>
          ) : null}
        </Card>
      </li>
    );
  }

  // never_contributed — the gentle invite.
  return (
    <li>
      <Card className="border-aivo-accent/40 bg-aivo-accent/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-iw-ink">{copy.neverTitle({ name })}</p>
            <p className="mt-0.5 text-sm text-iw-ink-muted">{copy.neverBody({ name })}</p>
          </div>
          <Link
            href={contributorInputFlowPath(summary.role, summary.learnerId)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-aivo-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {copy.neverCta}
          </Link>
        </div>
      </Card>
    </li>
  );
}

/**
 * The "Your contributions" card. Renders one row per learner. When there are no
 * learners (the contributor is on no care team yet), renders nothing — the
 * role-home's own empty state covers that case.
 */
export function ContributorContributionsCard({
  summaries,
  copy,
}: {
  summaries: ContributorLearnerSummary[];
  copy: ContributorCardCopy;
}) {
  if (summaries.length === 0) return null;
  return (
    <section className="grid gap-3" aria-label={copy.cardTitle}>
      <h2 className="text-sm font-semibold text-iw-ink">{copy.cardTitle}</h2>
      <ul className="grid gap-3">
        {summaries.map((s) => (
          <LearnerRow key={`${s.role}:${s.learnerId}`} summary={s} copy={copy} />
        ))}
      </ul>
    </section>
  );
}
