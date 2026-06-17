import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getBrainProfile,
  getLearner,
  listBrainApprovals,
  listBrainProfileChanges,
  parentCanAccessLearner,
  recordChildProfileDisclosure,
} from "@/lib/db/repos";
import { getRegressionInsights } from "@/lib/services/brain-svc";
import { newRequestId } from "@/lib/observability/logger";
import { BrainTimelineClient } from "./brain-timeline-client";

/**
 * Sprint C-13 — "What changed since you approved" (storyboard timeline).
 *
 * A parent surface, sibling to brain-profile/ and brain-review/. Renders the
 * brain-profile CHANGE records + the C-06 APPROVAL records newest-first with
 * human summaries, ack buttons on pending structural deltas, and a link to the
 * C-05 /brain-review screen to ADJUST rather than just acknowledge. Regression
 * detections surface here as parent-readable insight cards (read from brain-svc,
 * the only stack with a regression source — empty otherwise).
 *
 * Parent-scoped; reading the change history is recorded in the FERPA disclosure
 * trail (a parent reading their own child is not a cross-role read, but the
 * read is logged for completeness, mirroring the brain-svc surface).
 */
export default async function BrainTimelinePage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.learner_brain_timeline");
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const [changes, approvals, insights, profile] = await Promise.all([
    listBrainProfileChanges(learnerId, session.tenantId),
    listBrainApprovals(learnerId, session.tenantId),
    getRegressionInsights(learnerId, session.tenantId, { requestId: newRequestId() }),
    getBrainProfile(learnerId, session.tenantId),
  ]);

  // Record the parent's read of the change history in the disclosure trail
  // (best-effort; never blocks the render).
  await recordChildProfileDisclosure({
    tenantId: session.tenantId,
    learnerId,
    readerUserId: session.userId,
    readerRole: "parent",
    surface: "web-v2:GET /parent/learners/{learnerId}/brain-timeline",
    dataClass: "brain_profile_change_history",
  }).catch(() => {});

  const name = learner.displayName;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={t("eyebrow", { name })}
        title={t("page_title")}
        description={t("page_description", { name })}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/parent/learners/${learnerId}/brain-profile`}>
              <ArrowLeft className="mr-1 h-4 w-4" /> {t("back_to_profile")}
            </Link>
          </Button>
        }
      />

      <BrainTimelineClient
        learnerId={learnerId}
        learnerName={name}
        changes={changes}
        approvals={approvals}
        insights={insights}
      />

      {/* Adjust affordance — the timeline is for awareness; the review screen is
          where the parent changes something. Only meaningful once a clone exists. */}
      {profile && profile.cloneStage !== "pre_clone" ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-iw-border pt-4">
          <p className="text-sm text-iw-ink-muted">{t("adjust_hint", { name })}</p>
          <Button asChild>
            <Link href={`/parent/learners/${learnerId}/brain-review`}>
              {t("review_changes_cta")} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      {/* Reduced-motion-safe settle for newly-rendered cards (no transform). */}
      <style>{`
        [data-testid="bt-change-row"], [data-testid="bt-approval-row"] {
          animation: bt-fade-in 240ms ease both;
        }
        @keyframes bt-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="bt-change-row"], [data-testid="bt-approval-row"] { animation: none; }
        }
      `}</style>
    </AppShell>
  );
}
