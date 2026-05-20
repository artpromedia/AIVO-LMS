/**
 * /design-system/baseline — visual showcase of the sprint 6 baseline
 * primitives.
 */
import type { Metadata } from "next";
import Link from "next/link";
import {
  LearnerBaselineShell,
  AICompanionHero,
  PersonalizationChip,
  BaselineProgressDots,
  LearnerQuestionCard,
  LearnerChoiceCard,
  ReadAloudButton,
  HintCard,
  BreakCard,
  CompletionHero,
  ProctorBanner,
  type PersonalizationVariant,
  type DotState,
} from "@aivo/ui";

export const metadata: Metadata = {
  title: "AIVO Design System · Baseline",
  description: "Showcase of @aivo/ui/baseline primitives (sprint 6).",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
      {children}
    </h2>
  );
}

const ALL_CHIPS: PersonalizationVariant[] = [
  "parent_assessment",
  "iep",
  "pacing",
  "no_grades",
  "read_aloud",
  "calm_mode",
  "extended_time",
  "paused",
  "ai_companion",
];

const DEMO_DOTS: DotState[] = [
  "answered",
  "answered",
  "skipped",
  "answered",
  "current",
  "pending",
  "pending",
  "pending",
];

export default function BaselineDesignSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)] iw-safe-top">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 flex flex-col gap-12">
        <header className="flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">Design system · sprint 6</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-iw-text-strong">
            Custom baseline experience
          </h1>
          <p className="text-iw-text-muted max-w-2xl leading-relaxed">
            Calm, child-friendly primitives for the personalized baseline
            assessment. Big touch targets, no grades, no timers, always
            reduced-motion friendly.
          </p>
          <nav className="flex flex-wrap gap-2 mt-2">
            <Link
              href="/design-system"
              className="text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
            >
              ← Core primitives
            </Link>
            <Link
              href="/design-system/assessment"
              className="text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
            >
              Assessment primitives →
            </Link>
          </nav>
        </header>

        <section className="flex flex-col gap-4">
          <SectionLabel>PersonalizationChip · all 9 variants</SectionLabel>
          <div className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-wrap gap-2">
            {ALL_CHIPS.map((v) => (
              <PersonalizationChip key={v} variant={v} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionLabel>BaselineProgressDots</SectionLabel>
          <div className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-3">
            <BaselineProgressDots states={DEMO_DOTS} showCaption />
            <BaselineProgressDots
              states={[
                "answered",
                "answered",
                "answered",
                "answered",
                "answered",
                "answered",
                "answered",
                "answered",
              ]}
              showCaption
              ariaLabel="Completed strip"
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionLabel>LearnerChoiceCard · ReadAloudButton · HintCard</SectionLabel>
          <div className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <ReadAloudButton />
              <ReadAloudButton playing label="Stop" />
              <ReadAloudButton disabled label="Not available" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <LearnerChoiceCard name="demo.choice" value="a" label="The lion roared." index={0} />
              <LearnerChoiceCard name="demo.choice" value="b" label="The tiger leapt." index={1} defaultChecked />
              <LearnerChoiceCard name="demo.choice" value="c" label="The bear waited." index={2} />
              <LearnerChoiceCard name="demo.choice" value="d" label="The fox ran fast." index={3} disabled />
            </div>
            <HintCard hint="Look at the action word — it tells you who's moving." />
            <HintCard hint="(hidden)" policy="locked" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionLabel>LearnerQuestionCard</SectionLabel>
          <LearnerQuestionCard
            eyebrow="With Maya · Story Garden"
            companion={
              <span
                className="w-12 h-12 rounded-full inline-flex items-center justify-center text-2xl bg-[var(--aivo-aivoOrange-50)] text-[var(--aivo-aivoOrange-700)]"
                aria-hidden="true"
              >
                📚
              </span>
            }
            prompt="Which word completes the sentence: The bear was very ___ after the long walk."
            readAloud={<ReadAloudButton />}
          >
            <LearnerChoiceCard name="demo.q1" value="happy" label="happy" index={0} />
            <LearnerChoiceCard name="demo.q1" value="tired" label="tired" index={1} defaultChecked />
            <LearnerChoiceCard name="demo.q1" value="loud" label="loud" index={2} />
            <LearnerChoiceCard name="demo.q1" value="cold" label="cold" index={3} />
            <HintCard hint="Think about how someone might feel after walking a long way." />
          </LearnerQuestionCard>
        </section>

        <section className="flex flex-col gap-4">
          <SectionLabel>AICompanionHero</SectionLabel>
          <AICompanionHero
            eyebrow="A friendly check-in · 8 short questions"
            title="Ready, Emma?"
            body="Maya is here to help you start. We'll go one question at a time. Skip anything you don't want to try."
            tutorAvatar="📚"
            chips={ALL_CHIPS.slice(0, 4).map((v) => (
              <PersonalizationChip key={v} variant={v} />
            ))}
            actions={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                Start when you're ready
              </button>
            }
          />
        </section>

        <section className="flex flex-col gap-4">
          <SectionLabel>BreakCard</SectionLabel>
          <BreakCard
            learnerName="Emma"
            answered={5}
            total={12}
            resume={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                Resume
              </button>
            }
            secondary={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border"
              >
                Stop for today
              </button>
            }
          />
        </section>

        <section className="flex flex-col gap-4">
          <SectionLabel>CompletionHero · learner view (no scores)</SectionLabel>
          <CompletionHero
            learnerName="Emma"
            learned={["Reading: starting at on grade", "Math: starting at building", "IEP supports stay on"]}
            primary={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                Take me home
              </button>
            }
          />
          <SectionLabel>CompletionHero · proctor view (with answered/total)</SectionLabel>
          <CompletionHero
            learnerName="Emma"
            answered={11}
            total={12}
            showAnswered
            title="Baseline complete — here's where lessons will start"
            body="AIVO has enough signal to start. Numbers below are starting points, not scores."
            learned={["Reading: on grade", "Math: building", "Pacing locked to short bursts"]}
          />
        </section>

        <section className="flex flex-col gap-4">
          <SectionLabel>ProctorBanner</SectionLabel>
          <div className="rounded-iw-card-lg overflow-hidden border border-iw-border">
            <ProctorBanner role="parent" proctorName="Ms. Rivera" learnerName="Emma" />
          </div>
          <div className="rounded-iw-card-lg overflow-hidden border border-iw-border">
            <ProctorBanner role="teacher" proctorName="Mr. Park" learnerName="Aiden" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionLabel>LearnerBaselineShell · composed</SectionLabel>
          <div className="rounded-iw-card-lg border border-iw-border overflow-hidden">
            <LearnerBaselineShell
              topBanner={<ProctorBanner role="parent" proctorName="Mom" learnerName="Emma" />}
              headerLeft={<p className="text-xs text-iw-text-muted">Reading · 5 of 8</p>}
              headerRight={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border"
                >
                  Pause
                </button>
              }
              status={ALL_CHIPS.slice(0, 4).map((v) => (
                <PersonalizationChip key={v} variant={v} />
              ))}
            >
              <BaselineProgressDots states={DEMO_DOTS} />
              <LearnerQuestionCard
                eyebrow="With Maya · Story Garden"
                companion={
                  <span
                    className="w-12 h-12 rounded-full inline-flex items-center justify-center text-2xl bg-[var(--aivo-aivoOrange-50)] text-[var(--aivo-aivoOrange-700)]"
                    aria-hidden="true"
                  >
                    📚
                  </span>
                }
                prompt="Which word means the opposite of 'big'?"
                readAloud={<ReadAloudButton />}
              >
                <LearnerChoiceCard name="demo.q2" value="tall" label="tall" index={0} />
                <LearnerChoiceCard name="demo.q2" value="small" label="small" index={1} defaultChecked />
                <LearnerChoiceCard name="demo.q2" value="happy" label="happy" index={2} />
              </LearnerQuestionCard>
            </LearnerBaselineShell>
          </div>
        </section>
      </div>
    </main>
  );
}
