import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  QuestionCard,
  AssessmentFooter,
  ASSESSMENT_BACK_CLASS,
  ReassuranceCard,
} from "@aivo/ui";
import {
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
} from "@/lib/db/repos";
import { WIZARD_STEPS } from "@/lib/validators/parent-assessment";

const ROAD_AHEAD = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    label: "About 6 minutes",
    body: "Eleven calm screens, one question group per screen. Your answers autosave.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    label: "Private to you",
    body: "We never show your raw answers to your learner — only learner-safe summaries.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    label: "IEP optional",
    body: "If you have an IEP or 504, you'll upload it after. If not, your answers are enough.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M3 12a9 9 0 0 1 9-9" />
        <path d="M21 12a9 9 0 0 1-9 9" />
      </svg>
    ),
    label: "Personalized baseline",
    body: "We use your answers to build a baseline check that's tuned to your learner — no generic quiz.",
  },
];

export default async function AssessmentIntro({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  const hasProgress = Object.values(assessment.answers ?? {}).some(
    (v) => v && Object.keys(v).length > 0,
  );

  return (
    <AssessmentShell
      eyebrow={`Parent assessment for ${learner.displayName}`}
      reassurance={
        <>
          <ReassuranceCard
            tone="privacy"
            title="Your answers stay with you"
            body="Stored on your account. Never displayed to your learner or shared with other parents."
            icon={
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            link={{ href: "/parent/privacy", label: "How we protect your data →" }}
          />
          <ReassuranceCard
            tone="info"
            title="No diagnosis required"
            body="Pick whatever feels right. AIVO doesn't need a formal label — only what helps day to day."
          />
        </>
      }
    >
      <QuestionCard
        eyebrow="Get set up"
        title={`Let's set up learning for ${learner.preferredName || learner.firstName}`}
        helper="A few calm questions so AIVO can teach the way your learner thinks, paces, and feels best. Nothing here is graded — it shapes how lessons land."
        actions={
          <AssessmentFooter
            back={
              <Link
                href={`/parent/learners/${learner.id}`}
                className={ASSESSMENT_BACK_CLASS}
              >
                Not now
              </Link>
            }
            primary={
              <Link
                href={`/parent/learners/${learner.id}/assessment?step=${
                  hasProgress
                    ? (WIZARD_STEPS.find((s) =>
                        s.sections.some(
                          (sec) =>
                            assessment.answers[sec] === undefined ||
                            Object.keys(assessment.answers[sec] ?? {}).length === 0,
                        ),
                      )?.id ?? 1)
                    : 1
                }`}
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_2px_6px_rgb(from var(--aivo-sensory-primary) r g b / 0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white"
              >
                {hasProgress ? "Continue where I left off" : "Start the assessment"}
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
          />
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {ROAD_AHEAD.map((step) => (
            <li
              key={step.label}
              className="flex items-start gap-3 rounded-iw-card border border-iw-border bg-[var(--aivo-color-surface-canvas)]/40 p-4"
            >
              <span
                className="shrink-0 w-9 h-9 rounded-iw-control flex items-center justify-center bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-sensory-primary)]"
                aria-hidden="true"
              >
                {step.icon}
              </span>
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-iw-text-strong">
                  {step.label}
                </span>
                <span className="text-xs text-iw-text-muted leading-relaxed">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </QuestionCard>
    </AssessmentShell>
  );
}
