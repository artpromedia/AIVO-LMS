import Link from "next/link";
import {
  LearningHero,
  FloatingMetricCard,
  SetupProgressTrack,
  type SetupStep,
} from "@aivo/ui/hero";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /parent/home-v2 — REDESIGNED parent home.
 *
 * Non-destructive: the legacy /parent/home page is left in place;
 * this lives at a separate route mirroring the Sprint-2 pattern
 * (/design-system/shell, /locked/[area]). When the redesign passes
 * QA the team can flip the navigation to point here.
 *
 * Sprint-4 verbatim acceptance criteria enforced here:
 *
 *   "Parent home feels premium and calm. All cards have real
 *    destinations. Parent can add learner, upload IEP, review
 *    assessment status, and approve permissions."
 *
 *   Greeting: "Hi, [name]. [Child] is ready for today's learning."
 *
 * This page is server-rendered with placeholder data; later commits
 * in Sprint 4 wire it to the real `listLearnersForParent` repo.
 */
export default function ParentHomeV2() {
  // Placeholder data — Sprint 4 commit 3 will wire to real session.
  const parentFirstName = "Ofem";
  const learnerFirstName = "Emma";

  const setupSteps: SetupStep[] = [
    { id: "verify", label: "Verify parent", status: "done", href: "/onboarding/parent-verify" },
    { id: "consent", label: "Review consent", status: "done", href: "/onboarding/consent" },
    { id: "iep", label: "Upload IEP / 504 (optional)", status: "active", href: "/parent/learners/new/iep" },
    { id: "approve", label: "Approve learner access", status: "upcoming", href: "/onboarding/child-approval" },
  ];

  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas,#f4f6f5)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex flex-col gap-6">
        <LearningHero
          greeting={
            <>
              Hi, {parentFirstName}.
              <br />
              <span className="text-iw-text-muted font-bold">
                {learnerFirstName} is ready for today's learning.
              </span>
            </>
          }
          subhead="Calm, personalized, and waiting for one quick check-in from you."
          actions={
            <>
              <Link
                href={`/parent/learners`}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold shadow-sm hover:opacity-95"
              >
                <AivoIcon name="care" size={18} />
                Start with {learnerFirstName}
              </Link>
              <Link
                href="/parent/learners/new"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-white text-iw-text-strong font-semibold border border-iw-border hover:border-iw-text-muted"
              >
                <AivoIcon name="rosterStudents" size={18} />
                Add another learner
              </Link>
            </>
          }
        />

        <SetupProgressTrack steps={setupSteps} />

        <section aria-label="Today at a glance">
          <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
            Today at a glance
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FloatingMetricCard
              label="Baseline status"
              value="In progress"
              description="Discovery adventure 60% complete. Resumes where Emma left off."
              icon={<AivoIcon name="aiBrain" size={20} />}
              href={`/parent/learners/emma/assessments`}
              tone="info"
            />
            <FloatingMetricCard
              label="Stress / support signal"
              value="Calm"
              delta={{ value: "no flags this week", tone: "flat" }}
              description="Tutor pacing and break frequency look healthy."
              icon={<AivoIcon name="safetyOk" size={20} />}
              href={`/parent/learners/emma/wellbeing`}
              tone="success"
            />
            <FloatingMetricCard
              label="Mastery trend"
              value="+4"
              delta={{ value: "skills this week", tone: "up" }}
              description="Reading and number sense both moving up."
              icon={<AivoIcon name="growth" size={20} />}
              href={`/parent/learners/emma/mastery`}
              tone="success"
            />
            <FloatingMetricCard
              label="Today's learning time"
              value="22 min"
              description="Planned: 35 minutes. Emma can start whenever."
              icon={<AivoIcon name="goal" size={20} />}
              href={`/parent/learners/emma/today`}
            />
            <FloatingMetricCard
              label="Needs your approval"
              value="1 thing"
              description="Approve voice mode for the AI tutor."
              icon={<AivoIcon name="consentCheck" size={20} />}
              href="/onboarding/child-approval"
              tone="warning"
            />
            <FloatingMetricCard
              label="IEP support status"
              value="Active"
              description="3 accommodations applied. Add a plan or update from learner profile."
              icon={<AivoIcon name="iep" size={20} />}
              href={`/parent/learners/emma/iep`}
              tone="info"
            />
          </div>
        </section>

        <p className="text-xs text-iw-text-muted text-center pt-2">
          This is the redesigned parent home. The legacy view is still available at{" "}
          <Link href="/parent/home" className="underline hover:text-iw-text-strong">
            /parent/home
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
