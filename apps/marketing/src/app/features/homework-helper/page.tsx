import { MARKETING_ACCENTS } from "@aivo/brand";
import type { Metadata } from "next";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { SITE_URL } from "@/lib/constants";
import { CalloutCard, MockupShowcase } from "@/components/marketing/sections";

const TITLE = "Homework Helper · Guided help, never an answer dump";
const DESCRIPTION =
  "Homework Helper walks learners through a problem step by step — asking clarifying questions, offering scaffolded hints, and recommending a follow-up LessonRun. Designed to teach, not to cheat.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/features/homework-helper`,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: `${SITE_URL}/features/homework-helper` },
};

export default function Page() {
  return (
    <LandingPageLayout
      badge="Feature · Homework Helper"
      badgeColor={MARKETING_ACCENTS.emeraldDeep}
      title="Guided help, never an answer dump"
      subtitle="Homework Helper walks learners through the problem step by step — clarifying, scaffolding, and recommending what to learn next. It is designed to teach, not to cheat."
      primaryCtaLabel="Start parent setup"
      secondaryCtaLabel="See how LessonRun works"
      secondaryCtaHref="/features/lessonrun"
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Features", href: "/features/homework-helper" },
        { name: "Homework Helper", href: "/features/homework-helper" },
      ]}
    >
      {/* §2 Problem input */}
      <MockupShowcase
        eyebrow="Step 1 · Problem input"
        heading="Snap, paste, or type the problem"
        body="Learners can drop in a photo of the worksheet, paste a problem, or just type it. Homework Helper reads the problem the way a tutor would — slowly and out loud if needed."
        bullets={[
          "Photo, paste, or typed input",
          "Read-aloud on the problem itself",
          "No silent “answering” — the next step is a conversation",
        ]}
        mockupTitle="Homework Helper · New problem"
        mockup={
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
              📷 Snap a photo · or paste text
            </div>
            <textarea
              readOnly
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700"
              value="Maya has 4 bags of marbles. Each bag has 3 marbles. How many in all?"
            />
            <div className="rounded-lg bg-slate-900 py-2 text-center text-sm font-semibold text-white">
              Get help →
            </div>
          </div>
        }
      />

      {/* §3 Clarifying question */}
      <MockupShowcase
        eyebrow="Step 2 · Clarifying question"
        heading="A real tutor question first"
        body="Before any explanation, Homework Helper asks a clarifying question to find out where the learner actually is. This is how good tutors start. It is also how Homework Helper avoids dumping an answer onto a learner who could solve it themselves with a small nudge."
        bullets={[
          "Reveals where the learner is stuck",
          "Replaces an answer with a conversation",
          "Sets the depth of the help that follows",
        ]}
        reverse
        mockupTitle="Homework Helper · Clarifying"
        mockup={
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700">
              Before we solve it — what does “in all” mean to you in this problem?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["Add them up", "Multiply", "Not sure", "Show me an example"].map((w) => (
                <div
                  key={w}
                  className="rounded-lg border-2 border-slate-200 bg-white py-2 text-center text-sm font-body text-slate-700"
                >
                  {w}
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* §4 Guided help */}
      <MockupShowcase
        eyebrow="Step 3 · Guided help"
        heading="One small step at a time"
        body="From here Homework Helper guides — not lectures. Each turn is a single small step, ending in another check. The learner does the math. The helper holds the rail."
        bullets={[
          "Single small step per turn",
          "Checks for understanding between steps",
          "Tiered hints — never an answer dump",
        ]}
        mockupTitle="Homework Helper · Step"
        mockup={
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700">
              Great — “in all” means we're combining. We have 4 bags. Each bag has 3 marbles. Let's
              draw the first bag together. How many marbles go in bag 1?
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2 text-sm text-slate-700">
              Your answer: <span className="font-mono">3</span>
            </div>
          </div>
        }
      />

      {/* §5 Scaffolded explanation */}
      <MockupShowcase
        eyebrow="Step 4 · Scaffolded explanation"
        heading="The why, after the doing"
        body="Once the learner has worked the problem, Homework Helper names what they just did — in plain language. This is where the actual learning lands."
        bullets={[
          "Names the strategy in plain words",
          "Connects to the skill in AIVO's mastery state",
          "Skippable if the learner is confident",
        ]}
        reverse
        mockupTitle="What we just did"
        mockup={
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-slate-700">
              You added 3 four times. That's the same as 3 × 4. That's called
              <span className="font-semibold"> multiplication as repeated addition.</span>
            </div>
            <p className="text-xs text-slate-500">
              Mastery updated: Multiplying as repeated addition · building.
            </p>
          </div>
        }
      />

      {/* §6 Follow-up lesson recommendation */}
      <MockupShowcase
        eyebrow="Step 5 · Follow-up recommendation"
        heading="A LessonRun, not just a vibes-check"
        body="If the helper revealed a real gap, AIVO suggests a follow-up LessonRun — not a generic worksheet. The recommendation drops into Today's Mission for the next session."
        bullets={[
          "Suggested LessonRun based on the gap, not the topic",
          "Parents see the recommendation in the weekly summary",
          "Teachers see it in the intervention queue",
        ]}
        mockupTitle="Next up · Today's Mission"
        mockup={
          <div className="space-y-2">
            <div className="rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 p-3 text-white">
              <p className="text-xs uppercase tracking-wider text-purple-100">Recommended next</p>
              <h3 className="mt-1 font-heading text-base font-bold">
                Multiplying by 3s · LessonRun
              </h3>
              <p className="mt-0.5 text-xs text-purple-100">With Atlas · ~15 minutes</p>
            </div>
            <p className="text-xs text-slate-500">Added to Maya's next session.</p>
          </div>
        }
      />

      {/* §7 Safety + anti-answer-dump */}
      <CalloutCard
        eyebrow="Safety · the line we hold"
        title="Homework Helper will not dump answers"
        body={
          <>
            <p>
              Homework Helper is designed to refuse the “just give me the answer” ask. It will read
              the problem aloud, ask a clarifying question, and offer tiered hints. The learner does
              the math, every time.
            </p>
            <p className="mt-3">
              It will also recognize problem types where a learner should be working with a teacher
              or a specialist — graded test items, IEP assessments, formal evaluation tasks — and
              decline rather than try.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Safety controls are tuned with educators. We log what the helper declined and why, and
              surface it to parents on request.
            </p>
          </>
        }
        ctaLabel="Read our trust posture"
        ctaHref="/accessibility"
        tone="slate"
      />
    </LandingPageLayout>
  );
}
