import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  BaselinePendingCard,
  ReassuranceCard,
  InsightChip,
} from "@aivo/ui";
import {
  getActiveBaselineForLearner,
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
} from "@/lib/db/repos";

export default async function BaselinePendingPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) {
    // The pending screen only makes sense after the assessment is submitted.
    redirect(`/parent/learners/${learner.id}/assessment`);
  }

  const iep = getIEPForLearner(learnerId, session.tenantId);
  const active = getActiveBaselineForLearner(learnerId, session.tenantId);

  // If a baseline already exists and is ready, send the parent on.
  if (active && active.status === "in_progress") {
    redirect(`/parent/learners/${learner.id}/baseline`);
  }
  if (active && active.status === "complete") {
    redirect(`/parent/learners/${learner.id}/baseline`);
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
            title="No generic quiz"
            body="The baseline is generated fresh from your inputs. Your learner will see questions that match their level and supports."
          />
          <ReassuranceCard
            tone="privacy"
            title="Calm by default"
            body="Read-aloud, extended time, and sensory-aware pacing turn on automatically when supports call for them."
          />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <BaselinePendingCard
          learnerName={learner.preferredName || learner.firstName}
          inputs={inputs}
          estimate="Usually under 2 minutes. You can leave this page — we'll keep going in the background."
          secondary={
            <Link
              href={`/parent/learners/${learner.id}`}
              className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
            >
              Check back later
            </Link>
          }
        />

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-iw-card border border-iw-border bg-white p-4 flex flex-col gap-1">
            <p className="iw-label text-iw-text-muted">Step 1 · Skill graph</p>
            <p className="text-sm font-semibold text-iw-text-strong">
              Picking the right starting skills
            </p>
            <p className="text-xs text-iw-text-muted leading-relaxed">
              We map your learner's grade band and confidence answers onto the curriculum.
            </p>
            <InsightChip tone="success" size="sm" className="self-start mt-1">
              Done
            </InsightChip>
          </div>
          <div className="rounded-iw-card border border-iw-border bg-white p-4 flex flex-col gap-1">
            <p className="iw-label text-iw-text-muted">Step 2 · Personalization</p>
            <p className="text-sm font-semibold text-iw-text-strong">
              Applying supports and pacing
            </p>
            <p className="text-xs text-iw-text-muted leading-relaxed">
              We respect every accommodation you confirmed plus the sensory profile.
            </p>
            <InsightChip tone="primary" size="sm" className="self-start mt-1">
              In progress
            </InsightChip>
          </div>
          <div className="rounded-iw-card border border-iw-border bg-white p-4 flex flex-col gap-1">
            <p className="iw-label text-iw-text-muted">Step 3 · Question set</p>
            <p className="text-sm font-semibold text-iw-text-strong">
              Drafting the first questions
            </p>
            <p className="text-xs text-iw-text-muted leading-relaxed">
              Short, calm, no time pressure. Your learner can pause anytime.
            </p>
            <InsightChip tone="neutral" size="sm" className="self-start mt-1">
              Up next
            </InsightChip>
          </div>
        </section>
      </div>
    </AssessmentShell>
  );
}
