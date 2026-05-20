import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  SubmittedHero,
  ReassuranceCard,
  InsightChip,
} from "@aivo/ui";
import {
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
} from "@/lib/db/repos";

export default async function AssessmentSubmittedPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ skipped?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const sp = await searchParams;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  const iep = getIEPForLearner(learnerId, session.tenantId);

  const iepSkipped = sp.skipped === "iep";
  const iepConfirmed = !!iep && !!iep.confirmedAt;
  const supportsCount = iep?.acceptedAccommodations?.length ?? 0;

  return (
    <AssessmentShell
      eyebrow={`All set for ${learner.displayName}`}
      reassurance={
        <>
          <ReassuranceCard
            tone="info"
            title="What we use this for"
            body="Your answers feed straight into baseline generation. No generic quiz — every question your learner sees is shaped by what you shared."
          />
          {iepConfirmed ? (
            <ReassuranceCard
              tone="safety"
              title="IEP supports active"
              body={`AIVO will apply the ${supportsCount} support${supportsCount === 1 ? "" : "s"} you confirmed. Adjust anytime from the learner's settings.`}
            />
          ) : (
            <ReassuranceCard
              tone="privacy"
              title="No IEP on file"
              body="That's fine. AIVO will use your assessment alone for personalization. You can upload an IEP whenever you're ready."
            />
          )}
        </>
      }
    >
      <SubmittedHero
        eyebrow={`Parent assessment submitted on ${new Date(assessment.submittedAt ?? Date.now()).toLocaleDateString(
          undefined,
          { year: "numeric", month: "short", day: "numeric" },
        )}`}
        title={`Thanks — AIVO is set up for ${learner.preferredName || learner.firstName}`}
        body={
          iepSkipped
            ? "We'll generate the baseline check using your assessment. You can upload an IEP later from this learner's page."
            : iepConfirmed
              ? "We'll generate the baseline check using your answers plus the supports you confirmed from the IEP."
              : "We'll generate the baseline check using your answers. If you upload an IEP later, AIVO will weave the supports in too."
        }
        next={[
          {
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            ),
            label: "We'll build a custom baseline check tuned to your learner.",
          },
          {
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            ),
            label:
              iepConfirmed
                ? `We'll apply ${supportsCount} support${supportsCount === 1 ? "" : "s"} from the IEP to every lesson.`
                : "We'll apply sensory + pacing supports based on your assessment.",
          },
          {
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ),
            label: "You'll see a calm progress report as your learner moves through.",
          },
        ]}
        primary={
          <Link
            href={`/parent/learners/${learner.id}/baseline/pending`}
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_2px_6px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white"
          >
            See the baseline come together
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          </Link>
        }
        secondary={
          <Link
            href={`/parent/learners/${learner.id}`}
            className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-muted)]"
          >
            Back to learner home
          </Link>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-iw-card border border-iw-border bg-white p-4">
          <p className="iw-label text-iw-text-muted mb-2">Personalization inputs</p>
          <div className="flex flex-wrap gap-1.5">
            <InsightChip tone="primary" size="md">
              Parent assessment
            </InsightChip>
            {iepConfirmed ? (
              <InsightChip tone="accent" size="md">
                IEP supports · {supportsCount}
              </InsightChip>
            ) : null}
            <InsightChip tone="info" size="md">
              {learner.gradeBand ?? "grade band"}
            </InsightChip>
          </div>
        </div>
        <div className="rounded-iw-card border border-iw-border bg-white p-4">
          <p className="iw-label text-iw-text-muted mb-2">What learners never see</p>
          <ul className="space-y-1 text-xs text-iw-text-muted leading-relaxed">
            <li>· The raw IEP document</li>
            <li>· Diagnoses or clinical language</li>
            <li>· Your private assessment answers</li>
          </ul>
        </div>
        <div className="rounded-iw-card border border-iw-border bg-white p-4">
          <p className="iw-label text-iw-text-muted mb-2">Want to change something?</p>
          <Link
            href={`/parent/learners/${learner.id}/assessment`}
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline block"
          >
            Edit assessment answers →
          </Link>
          {iep ? (
            <Link
              href={`/parent/learners/${learner.id}/iep/review`}
              className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline block mt-1"
            >
              Manage IEP supports →
            </Link>
          ) : (
            <Link
              href={`/parent/learners/${learner.id}/iep`}
              className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline block mt-1"
            >
              Upload an IEP →
            </Link>
          )}
        </div>
      </section>
    </AssessmentShell>
  );
}
