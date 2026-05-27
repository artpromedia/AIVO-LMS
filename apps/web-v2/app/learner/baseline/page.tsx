import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  LearnerBaselineShell,
  AICompanionHero,
  PersonalizationChip,
  type PersonalizationVariant,
} from "@aivo/ui";
import {
  getActiveBaselineForLearner,
  getBrainProfile,
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
} from "@/lib/db/repos";

/**
 * /learner/baseline
 *
 * Soft entry point. Routes the learner to the calm intro flow
 * (why → subjects → readiness → intro → first question) on first
 * visit. Returning learners with an in-progress baseline jump back
 * into the runner.
 */
export default async function LearnerBaselineIndex() {
  const session = await requirePageRole(["learner"]);
  const learnerId = session.learnerId;
  if (!learnerId) redirect("/learner/home");

  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  const ready =
    Boolean(assessment.submittedAt) && Boolean(getBrainProfile(learnerId, session.tenantId));
  const baseline = getActiveBaselineForLearner(learnerId, session.tenantId);

  // Already mid-way? Drop the learner straight into the runner.
  if (baseline && baseline.status === "in_progress") {
    redirect(`/learner/baseline/${baseline.id}`);
  }

  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) redirect("/learner/home");

  if (!ready) {
    return (
      <LearnerBaselineShell
        headerLeft={
          <Link
            href="/learner/home"
            className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Back home
          </Link>
        }
      >
        <AICompanionHero
          eyebrow="Almost ready"
          title="A grown-up is still setting this up"
          body="Ask the grown-up who signed you up — they have a couple of questions to finish before AIVO can plan your check-in."
          actions={
            <Link
              href="/learner/home"
              className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
            >
              Back home
            </Link>
          }
        />
      </LearnerBaselineShell>
    );
  }

  const iep = getIEPForLearner(learnerId, session.tenantId);
  const chips: PersonalizationVariant[] = ["parent_assessment", "no_grades"];
  if (iep?.confirmedAt) chips.unshift("iep");
  chips.push("pacing", "ai_companion");

  return (
    <LearnerBaselineShell
      headerLeft={
        <Link
          href="/learner/home"
          className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back home
        </Link>
      }
    >
      <AICompanionHero
        eyebrow="A friendly check-in"
        title={`Hi ${learner.preferredName || learner.firstName} — ready to show me how you think?`}
        body="Three calm steps before the first question. Pick what you want to start with, AIVO does the rest."
        chips={chips.slice(0, 4).map((v) => (
          <PersonalizationChip key={v} variant={v} />
        ))}
        actions={
          <Link
            href="/learner/baseline/why"
            className="inline-flex items-center gap-2 rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
          >
            Let's go
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          </Link>
        }
      />
    </LearnerBaselineShell>
  );
}
