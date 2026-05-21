import type { Metadata } from "next";
import Link from "next/link";
import {
  SubjectCard,
  TodayFocusCard,
  MessageCard,
  LearnerBottomNav,
  InsightChip,
  FloatingMetricCard,
  LearningHero,
} from "@aivo/ui";

export const metadata: Metadata = {
  title: "AIVO Design System · Learner Home",
  description: "Showcase of @aivo/ui/learner-home primitives (sprint 7).",
};

const NAV_ITEMS = [
  { href: "/learner/home", label: "Home", icon: "🏠" },
  { href: "/learner/subjects", label: "Subjects", icon: "📘" },
  { href: "/learner/lesson-runs", label: "Lesson", icon: "✨" },
  { href: "/learner/quests", label: "Quests", icon: "🌟" },
  { href: "/learner/progress", label: "Progress", icon: "📈" },
];

export default function LearnerHomeDesignSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)] iw-safe-top pb-24">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12 flex flex-col gap-12">
        <header className="flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">Design system · sprint 7</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-iw-text-strong">
            Learner home & subject hub
          </h1>
          <p className="text-iw-text-muted max-w-2xl leading-relaxed">
            Premium soft-card primitives for the learner-first dashboard.
          </p>
          <nav className="flex flex-wrap gap-2 mt-2">
            <Link
              href="/design-system/baseline"
              className="text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
            >
              ← Baseline primitives
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
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            LearningHero + FloatingMetricCard strip
          </h2>
          <LearningHero
            greeting="Hi, Emma."
            subhead="Ready for a calm learning session?"
            actions={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                Start today's lesson
              </button>
            }
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FloatingMetricCard label="Today's focus" value="Reading" description="15 min" tone="info" />
            <FloatingMetricCard label="Streak" value="7 days" description="Keep going!" tone="success" />
            <FloatingMetricCard label="Support mode" value="4 on" description="IEP supports" tone="info" />
            <FloatingMetricCard label="Tutor" value="Ready" description="Ask for a hint" tone="neutral" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            TodayFocusCard
          </h2>
          <TodayFocusCard
            eyebrow="Continue · Reading"
            title="Identifying main idea"
            body="A short story and a couple of friendly questions. About 12 minutes."
            companion={
              <span className="w-12 h-12 rounded-full inline-flex items-center justify-center text-2xl bg-[var(--aivo-aivoOrange-50)] text-[var(--aivo-aivoOrange-700)]" aria-hidden="true">
                📚
              </span>
            }
            meta={
              <>
                <InsightChip tone="primary" size="md">12 min</InsightChip>
                <InsightChip tone="accent" size="md">IEP supports on</InsightChip>
                <InsightChip tone="info" size="md">Read-aloud available</InsightChip>
              </>
            }
            action={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                Resume
              </button>
            }
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            SubjectCard grid
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SubjectCard
              href="#"
              name="Reading"
              eyebrow="Maya · Story Garden"
              masteryLabel="On grade"
              masteryPct={72}
              icon="📚"
              accent="var(--aivo-aivoOrange-600)"
              nextAction="Identifying main idea"
              support="Read-aloud on"
              teacherAssigned={2}
            />
            <SubjectCard
              href="#"
              name="Math"
              eyebrow="Nimbus · Number Forest"
              masteryLabel="Building"
              masteryPct={48}
              icon="🔢"
              accent="var(--aivo-sensory-primary)"
              nextAction="Fractions warm-up"
            />
            <SubjectCard
              href="#"
              name="Science"
              eyebrow="Cosmo · Star Bay"
              masteryLabel="Strong"
              masteryPct={88}
              icon="🔬"
              accent="var(--aivo-aivoTeal-600)"
              nextAction="Plant life cycles"
              support="Supports on"
            />
            <SubjectCard
              href="#"
              name="Writing"
              eyebrow="Locked"
              masteryLabel="Not started"
              masteryPct={0}
              icon="✏️"
              locked
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            MessageCard variants
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <MessageCard
              from="parent"
              sender="Mom"
              title="Great work yesterday!"
              body="I'm so proud of you for finishing the whole reading set. Let's pick something fun next."
              when="2h"
              avatar="💜"
            />
            <MessageCard
              from="teacher"
              sender="Ms. Rivera"
              title="One assignment due Friday"
              body="No worries — it's short. Take it at your own pace."
              when="Yesterday"
              avatar="✏️"
            />
            <MessageCard
              from="tutor"
              sender="AIVO"
              title="Need a hint? I'm here."
              body="Tap the read-aloud speaker on any question to hear it."
              avatar="✨"
            />
            <MessageCard
              from="break"
              title="Time for a stretch?"
              body="You've been at it 20 minutes. Look out the window — I'll save your place."
              avatar="🌿"
              action={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                >
                  Take 5
                </button>
              }
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            LearnerBottomNav (mobile only — view this page in a narrow viewport)
          </h2>
          <p className="text-sm text-iw-text-muted">
            Renders at the bottom of the page on small screens. Active state and unread dot are shown
            in the live preview below the design system content.
          </p>
        </section>
      </div>

      <LearnerBottomNav items={NAV_ITEMS} currentHref="/learner/home" mobileOnly={false} />
    </main>
  );
}
