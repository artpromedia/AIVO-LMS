import type { Metadata } from "next";
import {
  StatChip,
  LearnerLevelBadge,
  LearnerProfileCard,
  FeaturedLessonCard,
  LessonSecondaryAction,
  TutorAvatar,
  TutorAvatarCard,
} from "@aivo/ui/learner-dashboard";

/**
 * Showcase of the SensoryAdaptive learner-dashboard primitives in
 * states that the live `/learner/home` page can only show when a
 * learner has progress data. Renders with synthetic props so design
 * QA can verify the hero card, stat strip, and tutor grid without
 * seeding LessonRuns into the in-memory store.
 *
 * Visit at /design-system/learner-dashboard.
 */
export const metadata: Metadata = {
  title: "AIVO Design System · Learner Dashboard",
  description: "Showcase of @aivo/ui/learner-dashboard primitives.",
};

export default function LearnerDashboardDesignSystemPage() {
  return (
    <main
      data-role-theme="learner"
      className="min-h-screen bg-[var(--color-aivo-page-bg)] py-12"
    >
      <div className="max-w-[1280px] mx-auto px-6 flex flex-col gap-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-iw-text-strong">
            Learner Dashboard primitives
          </h1>
          <p className="text-base text-iw-text-muted">
            SensoryAdaptive composition — what the live learner home renders
            once a learner has a resumable lesson or completed baseline.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="iw-label-sm text-iw-text-muted">Featured lesson hero</h2>
          <FeaturedLessonCard
            subject="Math"
            subjectTone="math"
            durationLabel="15 mins"
            difficultyLabel="Easy"
            title="Fractions with Ada"
            description="Let's practice sharing pizza slices."
            tutorName="Ada"
            tutorPersonality="Patient & Encouraging"
            tutorGlyph="🤖"
            tutorTone="lavender"
            secondaryActions={
              <>
                <LessonSecondaryAction>Read Aloud</LessonSecondaryAction>
                <LessonSecondaryAction>Overview</LessonSecondaryAction>
              </>
            }
            primaryAction={
              <button
                type="button"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-base font-bold text-white bg-[var(--color-aivo-primary)] hover:brightness-110 shadow-[0_8px_24px_-6px_color-mix(in_oklab,var(--color-aivo-primary)_55%,transparent)] transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7L8 5Z" />
                </svg>
                Start Lesson
              </button>
            }
          />
        </section>

        <section className="grid gap-6 md:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-3">
            <h2 className="iw-label-sm text-iw-text-muted">Profile card</h2>
            <LearnerProfileCard
              name="Aiden Park"
              initials="AP"
              roleLabel="Learner"
              approvalStatus="approved"
            />
            <LearnerProfileCard
              name="Sky Rivera"
              initials="SR"
              roleLabel="Learner"
              approvalStatus="pending"
            />
            <LearnerProfileCard
              name="Jordan Lee"
              initials="JL"
              roleLabel="Learner"
              approvalStatus="review"
            />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="iw-label-sm text-iw-text-muted">Stat strip</h2>
            <div className="flex items-center gap-3 p-4 rounded-3xl bg-white border border-iw-border/60 flex-wrap">
              <StatChip
                tone="warm"
                label="Level 12"
                value="2,450 XP"
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="m12 2 2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.8 6.1 20l1.7-6.7L2.5 8.9l6.9-.5L12 2Z" />
                  </svg>
                }
              />
              <StatChip
                tone="primary"
                label="Streak"
                value="4 Days"
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                  </svg>
                }
              />
              <span className="ml-auto">
                <LearnerLevelBadge level="Emerging" />
              </span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="iw-label-sm text-iw-text-muted">AI tutor cards</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <TutorAvatarCard name="Ada" subject="Math" glyph="🤖" tone="lavender" />
            <TutorAvatarCard name="Milo" subject="Reading" glyph="🦉" tone="mint" />
            <TutorAvatarCard name="Iris" subject="Science" glyph="🐱" tone="peach" />
            <TutorAvatarCard name="Rex" subject="Coding" glyph="🦖" tone="sunshine" />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="iw-label-sm text-iw-text-muted">Avatar sizes & tones</h2>
          <div className="flex items-end gap-6 flex-wrap p-6 bg-white rounded-3xl border border-iw-border/60">
            <div className="flex flex-col items-center gap-2">
              <TutorAvatar glyph="🤖" tone="lavender" size="sm" />
              <span className="text-xs text-iw-text-muted">sm · lavender</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <TutorAvatar glyph="🦉" tone="mint" size="md" />
              <span className="text-xs text-iw-text-muted">md · mint</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <TutorAvatar glyph="🐱" tone="peach" size="lg" />
              <span className="text-xs text-iw-text-muted">lg · peach</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <TutorAvatar glyph="🦖" tone="sunshine" size="xl" />
              <span className="text-xs text-iw-text-muted">xl · sunshine</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <TutorAvatar glyph="🐬" tone="sky" size="lg" />
              <span className="text-xs text-iw-text-muted">lg · sky</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <TutorAvatar glyph="🦊" tone="coral" size="lg" />
              <span className="text-xs text-iw-text-muted">lg · coral</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
