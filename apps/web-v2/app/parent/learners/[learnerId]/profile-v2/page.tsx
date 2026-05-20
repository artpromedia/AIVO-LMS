import Link from "next/link";
import { FloatingMetricCard, LearningHero } from "@aivo/ui/hero";
import { AivoIcon } from "@aivo/ui/icon";

interface ProfileV2Props {
  params: { learnerId: string };
}

/**
 * /parent/learners/[learnerId]/profile-v2 — REDESIGNED learner
 * profile. Non-destructive; legacy [learnerId]/page.tsx remains.
 *
 * Anchors the page around the LearningHero + a set of
 * FloatingMetricCards with real destinations to the existing
 * learner sub-routes (assessment, iep, lessons, sensory,
 * brain-profile, settings).
 *
 * Verbatim acceptance: "All cards have real destinations."
 */
export default function LearnerProfileV2({ params }: ProfileV2Props) {
  const { learnerId } = params;
  // Placeholder display data; sprint 4 commit 4 wires to repo.
  const learnerName = "Emma";

  const base = `/parent/learners/${learnerId}`;

  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex flex-col gap-6">
        <LearningHero
          greeting={<>{learnerName}'s learning profile</>}
          subhead="Everything we know — and everything you've taught us — about how this learner learns best."
          actions={
            <>
              <Link
                href={`${base}/lessons`}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold shadow-sm hover:opacity-95"
              >
                <AivoIcon name="curriculum" size={18} />
                Open today's lessons
              </Link>
              <Link
                href={`${base}/settings`}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-white text-iw-text-strong font-semibold border border-iw-border hover:border-iw-text-muted"
              >
                <AivoIcon name="care" size={18} />
                Profile settings
              </Link>
            </>
          }
        />

        <section>
          <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
            Learning identity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FloatingMetricCard
              label="Baseline assessment"
              value="60% done"
              description="Discovery adventure resumes where Emma left off."
              icon={<AivoIcon name="aiBrain" size={20} />}
              href={`${base}/assessment`}
              tone="info"
            />
            <FloatingMetricCard
              label="Brain profile"
              value="3 strengths"
              description="Pattern, narrative, and spatial reasoning."
              icon={<AivoIcon name="aiSparkle" size={20} />}
              href={`${base}/brain-profile`}
              tone="success"
            />
            <FloatingMetricCard
              label="IEP / support"
              value="3 accommodations"
              description="Extended time, audio supports, movement breaks."
              icon={<AivoIcon name="iep" size={20} />}
              href={`${base}/iep`}
            />
            <FloatingMetricCard
              label="Sensory preferences"
              value="Calm mode"
              description="Reduced motion, warmer color palette, soft sound."
              icon={<AivoIcon name="care" size={20} />}
              href={`${base}/sensory`}
            />
            <FloatingMetricCard
              label="Accessibility"
              value="Audio + captions"
              description="Captions on for all video. Voice tutor on."
              icon={<AivoIcon name="consentCheck" size={20} />}
              href={`${base}/accessibility`}
            />
            <FloatingMetricCard
              label="Mastery & progress"
              value="+4 skills"
              delta={{ value: "this week", tone: "up" }}
              description="Reading and number sense moving up."
              icon={<AivoIcon name="growth" size={20} />}
              href={`${base}/progress`}
              tone="success"
            />
          </div>
        </section>

        <p className="text-xs text-iw-text-muted text-center pt-2">
          Legacy profile available at{" "}
          <Link href={base} className="underline hover:text-iw-text-strong">
            {base}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
