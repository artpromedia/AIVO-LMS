import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AssessmentShell, BaselinePendingCard, ReassuranceCard, InsightChip } from "@aivo/ui";
import {
  createBaseline,
  getActiveBaselineForLearner,
  getBrainProfile,
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

// Pending is a transient SSR screen. There's no background worker that
// generates baselines, so on first visit (after the parent submits the
// assessment) we kick off `createBaseline` here and redirect into the
// learner runner. On retries / refreshes we either reuse an in-progress
// baseline or fall through to render the pending UI.
export const dynamic = "force-dynamic";

export default async function BaselinePendingPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.learner_baseline_pending");
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) {
    // The pending screen only makes sense after the assessment is submitted.
    redirect(`/parent/learners/${learner.id}/assessment`);
  }

  // Brain profile is a hard prereq for baseline generation. If it's
  // missing, sending the parent in circles on a "loading" screen is
  // worse than telling them what to do — bounce to the brain-profile
  // step explicitly. (Note: `getBrainProfile` is async — without the
  // await this check was `!Promise` ⇒ always false, so the redirect
  // never fired and the parent's "Setting it up…" CTA span forever
  // while `createBaseline` below hung on the missing prereq.)
  const brainProfile = await getBrainProfile(learnerId, session.tenantId);
  if (!brainProfile) {
    redirect(`/parent/learners/${learner.id}/brain-profile`);
  }

  const iep = await getIEPForLearner(learnerId, session.tenantId);
  const active = await getActiveBaselineForLearner(learnerId, session.tenantId);

  // If a baseline already exists and is ready, send the parent on.
  if (active?.status === "in_progress") {
    redirect(`/learner/baseline/${active.id}?as=parent`);
  }
  if (active?.status === "complete") {
    redirect(`/parent/learners/${learner.id}/baseline`);
  }

  // No active baseline yet — generate one now (this is what the pending
  // screen has been "waiting" for). If creation succeeds we drop the
  // parent straight into the learner runner. If it fails we render the
  // pending UI so the parent can at least retry via "Check back later".
  if (!active) {
    try {
      const created = await createBaseline({
        learnerId,
        tenantId: session.tenantId,
      });
      if (created) {
        audit(session, "baseline.create", newRequestId(), {
          learnerId,
          metadata: {
            baselineId: created.baseline.id,
            questionCount: created.questions.length,
            source: "pending-auto",
          },
        });
        await refreshLearnerReadiness(learnerId, session.tenantId);
        redirect(`/learner/baseline/${created.baseline.id}?as=parent`);
      }
    } catch (err) {
      // `redirect()` throws a NEXT_REDIRECT control-flow error — must
      // re-throw or the user gets stuck on the pending screen.
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        typeof (err as { digest?: unknown }).digest === "string" &&
        (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      console.error("baseline.pending.auto_create_failed", {
        learnerId,
        tenantId: session.tenantId,
        message: err instanceof Error ? err.message : String(err),
      });
      // fall through and render the pending UI as a soft-fail state
    }
  }

  const inputs: React.ReactNode[] = ["Parent assessment"];
  if (iep && iep.confirmedAt) {
    const n = iep.acceptedAccommodations?.length ?? 0;
    inputs.push(`IEP supports · ${n}`);
  }
  if (learner.gradeBand) inputs.push(`Grade band ${learner.gradeBand}`);
  inputs.push("Pacing & sensory preferences");

  return (
    <AssessmentShell
      eyebrow={`Setting up learning for ${learner.displayName}`}
      reassurance={
        <>
          <ReassuranceCard
            tone="info"
            title={t("no_generic_quiz_title")}
            body="The baseline is generated fresh from your inputs. Your learner will see questions that match their level and supports."
          />
          <ReassuranceCard
            tone="privacy"
            title={t("calm_by_default_title")}
            body="Read-aloud, extended time, and sensory-aware pacing turn on automatically when supports call for them."
          />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <BaselinePendingCard
          learnerName={learner.preferredName || learner.firstName}
          inputs={inputs}
          estimate="Usually under 2 minutes. Stay on this page — we'll redirect you as soon as the first question set is ready."
          secondary={
            <Link
              href={`/parent/learners/${learner.id}/baseline/pending`}
              className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
            >
              {t("try_again")}
            </Link>
          }
        />

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-iw-card border border-iw-border bg-white p-4 flex flex-col gap-1">
            <p className="iw-label text-iw-text-muted">{t("step1_label")}</p>
            <p className="text-sm font-semibold text-iw-text-strong">{t("step1_heading")}</p>
            <p className="text-xs text-iw-text-muted leading-relaxed">{t("step1_body")}</p>
            <InsightChip tone="success" size="sm" className="self-start mt-1">
              Done
            </InsightChip>
          </div>
          <div className="rounded-iw-card border border-iw-border bg-white p-4 flex flex-col gap-1">
            <p className="iw-label text-iw-text-muted">{t("step2_label")}</p>
            <p className="text-sm font-semibold text-iw-text-strong">{t("step2_heading")}</p>
            <p className="text-xs text-iw-text-muted leading-relaxed">{t("step2_body")}</p>
            <InsightChip tone="primary" size="sm" className="self-start mt-1">
              {t("in_progress")}
            </InsightChip>
          </div>
          <div className="rounded-iw-card border border-iw-border bg-white p-4 flex flex-col gap-1">
            <p className="iw-label text-iw-text-muted">{t("step3_label")}</p>
            <p className="text-sm font-semibold text-iw-text-strong">{t("step3_heading")}</p>
            <p className="text-xs text-iw-text-muted leading-relaxed">{t("step3_body")}</p>
            <InsightChip tone="neutral" size="sm" className="self-start mt-1">
              {t("up_next")}
            </InsightChip>
          </div>
        </section>
      </div>
    </AssessmentShell>
  );
}
