import type { Metadata } from "next";
import Link from "next/link";
import {
  TutorMessage,
  TutorInsightChip,
  ExplanationCard,
  PracticeCard,
  LessonStepper,
  VoiceInputButton,
  ReadAloudButton,
  LearnerChoiceCard,
} from "@aivo/ui";

export const metadata: Metadata = {
  title: "AIVO Design System · Tutor",
  description: "Showcase of @aivo/ui/tutor primitives (sprint 8).",
};

export default function TutorDesignSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)] iw-safe-top">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 flex flex-col gap-12">
        <header className="flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">Design system · sprint 8</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-iw-text-strong">
            AI tutor & lesson experience
          </h1>
          <nav className="flex flex-wrap gap-2 mt-2">
            <Link href="/design-system/learner-home" className="text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline">
              ← Learner home
            </Link>
          </nav>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            TutorInsightChip · all 6 variants
          </h2>
          <div className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-wrap gap-2">
            <TutorInsightChip kind="thinking" />
            <TutorInsightChip kind="hint_used" />
            <TutorInsightChip kind="difficulty_adjusted" />
            <TutorInsightChip kind="safety_active" />
            <TutorInsightChip kind="cited" />
            <TutorInsightChip kind="scaffolded" />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            TutorMessage thread
          </h2>
          <TutorMessage
            author="tutor"
            name="AIVO"
            avatar="✨"
            insight={<TutorInsightChip kind="cited" />}
          >
            <p className="text-base leading-relaxed">
              Photosynthesis is how plants make food. They use sunlight, water, and air to make
              their own sugar. Pretty cool, right?
            </p>
          </TutorMessage>
          <TutorMessage author="learner" name="You" avatar="🙂">
            <p>What's the air part called?</p>
          </TutorMessage>
          <TutorMessage author="tutor" name="AIVO" avatar="✨" insight={<TutorInsightChip kind="difficulty_adjusted" />}>
            <p>Great question — it's <strong>carbon dioxide</strong>. Plants breathe it in.</p>
          </TutorMessage>
          <TutorMessage author="tutor" name="AIVO" avatar="✨" thinking>
            <p className="text-iw-text-muted">…</p>
          </TutorMessage>
          <TutorMessage author="system">Lesson started · Reading goal · ~12 min</TutorMessage>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            ExplanationCard · 4 kinds
          </h2>
          <ExplanationCard kind="explanation" step={1} title="What is a fraction?" controls={<ReadAloudButton />}>
            A fraction shows part of a whole. The top number is the part, the bottom is the whole.
          </ExplanationCard>
          <ExplanationCard kind="example" step={2} title="Worked example: 3/4 of a pizza" citation={<span>From your school's grade 3–5 unit</span>}>
            If a pizza has 4 slices and you eat 3, you've had 3/4 of it.
          </ExplanationCard>
          <ExplanationCard kind="correction" title="Common mistake to watch for">
            Some learners say 1/4 is bigger than 1/2 because 4 is bigger than 2. Smaller bottom
            number = bigger piece!
          </ExplanationCard>
          <ExplanationCard kind="definition" title="Word to know: denominator">
            The bottom number in a fraction. It tells you how many pieces the whole is split into.
          </ExplanationCard>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            PracticeCard · 3 kinds
          </h2>
          <PracticeCard kind="practice" prompt="Which fraction is the same as 1/2?" subtitle="Try it — no grade.">
            <LearnerChoiceCard name="demo.p1" value="2/4" label="2/4" index={0} />
            <LearnerChoiceCard name="demo.p1" value="1/3" label="1/3" index={1} />
            <LearnerChoiceCard name="demo.p1" value="3/8" label="3/8" index={2} />
          </PracticeCard>
          <PracticeCard kind="try_it" prompt="Now you try: simplify 6/9." subtitle="Take your time.">
            <input
              type="text"
              placeholder="Type your answer"
              className="rounded-iw-control border border-iw-border bg-white px-4 py-3 text-base text-iw-text-strong placeholder:text-iw-text-muted/70 focus:outline-none focus:border-[var(--aivo-sensory-primary)]"
            />
          </PracticeCard>
          <PracticeCard kind="graded" prompt="Check: Is 4/8 equal to 1/2?" subtitle="This one counts toward your assignment.">
            <LearnerChoiceCard name="demo.p2" value="yes" label="Yes" index={0} />
            <LearnerChoiceCard name="demo.p2" value="no" label="No" index={1} />
          </PracticeCard>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            LessonStepper · beat-by-beat
          </h2>
          <div className="rounded-iw-card-lg bg-white border border-iw-border p-5">
            <LessonStepper
              beats={[
                { id: "welcome", label: "Welcome" },
                { id: "goal", label: "Goal" },
                { id: "story", label: "Story" },
                { id: "example", label: "Example" },
                { id: "guided", label: "Practice" },
                { id: "check", label: "Check" },
                { id: "wrap", label: "Wrap" },
              ]}
              current={3}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            Input controls
          </h2>
          <div className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex items-center gap-4">
            <VoiceInputButton />
            <VoiceInputButton listening />
            <VoiceInputButton disabled />
          </div>
        </section>
      </div>
    </main>
  );
}
