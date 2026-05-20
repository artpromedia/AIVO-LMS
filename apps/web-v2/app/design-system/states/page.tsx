import type { Metadata } from "next";
import Link from "next/link";
import {
  EmptyState,
  StateCard,
  AIGenerationStatusCard,
  OfflineBanner,
  Skeleton,
  type StateKind,
  type AIGenerationKind,
} from "@aivo/ui";

export const metadata: Metadata = {
  title: "AIVO Design System · States",
  description: "Showcase of @aivo/ui/states primitives (sprint 19).",
};

const STATE_KINDS: ReadonlyArray<{
  kind: StateKind;
  title: string;
  body: string;
  action: string;
}> = [
  {
    kind: "blocked_permission",
    title: "We need parent permission first",
    body: "Ask the grown-up who signed you up to approve this and we'll be back here in a moment.",
    action: "Ask a grown-up",
  },
  {
    kind: "consent_required",
    title: "Consent needed to continue",
    body: "AIVO needs your consent to apply IEP supports during lessons. You can change this any time.",
    action: "Review consent",
  },
  {
    kind: "payment_failed",
    title: "Your payment didn't go through",
    body: "We've kept everything in place. Update your payment method to keep learning calmly.",
    action: "Update payment",
  },
  {
    kind: "alignment_missing",
    title: "This lesson needs curriculum alignment",
    body: "AIVO can't generate this lesson yet — the skill isn't mapped to your district's curriculum.",
    action: "Open curriculum",
  },
  {
    kind: "upload_failed",
    title: "We couldn't read your upload",
    body: "Try a clearer photo, a PDF, or a smaller file. No rush — your other work is saved.",
    action: "Try again",
  },
  {
    kind: "blocked_safety",
    title: "Safety hold",
    body: "Something in this content tripped our safety filters. A grown-up has been notified.",
    action: "Talk to a grown-up",
  },
  {
    kind: "offline",
    title: "You're offline",
    body: "Your work is saved on this device. We'll sync as soon as you're back.",
    action: "Retry now",
  },
  {
    kind: "rate_limited",
    title: "Easy does it",
    body: "We're limiting how often AIVO generates so it stays calm and stable. Try again in a minute.",
    action: "Try in a moment",
  },
];

const AI_KINDS: ReadonlyArray<AIGenerationKind> = [
  "baseline_generating",
  "iep_extracting",
  "lesson_generating",
  "homework_analyzing",
  "tutor_thinking",
  "mastery_updating",
  "report_compiling",
];

export default function StatesDesignSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)] iw-safe-top">
      <OfflineBanner
        variant="sync_pending"
        message="Demo · sync_pending banner"
        retry={
          <button type="button" className="text-xs font-semibold underline">
            Sync now
          </button>
        }
      />
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 flex flex-col gap-12">
        <header className="flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">Design system · sprint 19</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-iw-text-strong">
            States, errors, and AI in-flight
          </h1>
          <p className="text-iw-text-muted max-w-2xl leading-relaxed">
            Every dead-end becomes a calm soft-glass card with a clear next action.
          </p>
          <nav className="flex flex-wrap gap-2 mt-2">
            <Link href="/design-system" className="text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline">← Core primitives</Link>
          </nav>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            StateCard · 8 kinds
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {STATE_KINDS.map((s) => (
              <StateCard
                key={s.kind}
                kind={s.kind}
                title={s.title}
                body={s.body}
                action={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-iw-control px-4 py-2 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                  >
                    {s.action}
                  </button>
                }
                secondary={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border"
                  >
                    Not now
                  </button>
                }
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            AIGenerationStatusCard · 7 kinds
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {AI_KINDS.map((k, i) => (
              <AIGenerationStatusCard
                key={k}
                kind={k}
                progress={i % 2 === 0 ? undefined : Math.min(95, 35 + i * 12)}
                inputs={["Parent assessment", "IEP supports · 4"]}
                estimate="Usually under 2 minutes."
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            EmptyState + Skeleton
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-iw-card-lg bg-white border border-iw-border p-5">
              <EmptyState
                title="Nothing here yet"
                body="Once your learner completes a baseline, this panel lights up with their progress."
              />
            </div>
            <div className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-3">
              <Skeleton variant="metric" />
              <Skeleton variant="line" lines={3} />
              <Skeleton variant="chart" />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-iw-text-strong border-b border-iw-border pb-2">
            OfflineBanner
          </h2>
          <div className="rounded-iw-card-lg overflow-hidden border border-iw-border">
            <OfflineBanner variant="offline" />
          </div>
          <div className="rounded-iw-card-lg overflow-hidden border border-iw-border">
            <OfflineBanner variant="sync_pending" />
          </div>
        </section>
      </div>
    </main>
  );
}
