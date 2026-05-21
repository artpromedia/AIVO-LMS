import { MARKETING_ACCENTS } from "@aivo/brand";
import type { Metadata } from "next";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { SITE_URL } from "@/lib/constants";
import { NumberedSteps, CalloutCard, MockupShowcase } from "@/components/marketing/sections";

const TITLE = "Today's Mission · One next-best learning action, every day";
const DESCRIPTION =
  "Today's Mission gives every AIVO learner a single clear next-best action — adapted to their level, pacing, and context. No endless dashboards. No decision fatigue.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/features/todays-mission`,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: `${SITE_URL}/features/todays-mission` },
};

const PRIORITY_LOGIC = [
  {
    title: "Mastery state",
    body: "What the learner is currently working on, and where the next click of progress lives.",
  },
  {
    title: "Recent LessonRuns",
    body: "What was finished, skipped, or paused — and what should follow.",
  },
  {
    title: "Accommodation context",
    body: "Pacing, scaffold depth, and supports the learner needs today.",
  },
  {
    title: "Energy & session signals",
    body: "Time of day, recent break usage, and length of the last successful run.",
  },
  {
    title: "Teacher overrides",
    body: "Assignments and intervention queues take priority over algorithmic suggestions.",
  },
  {
    title: "Parent moments",
    body: "If a parent flags a focus area in the dashboard, AIVO surfaces it next.",
  },
];

export default function Page() {
  return (
    <LandingPageLayout
      badge="Feature · Today's Mission"
      badgeColor={MARKETING_ACCENTS.purple}
      title="One next-best learning action, every day"
      subtitle="Today's Mission is the calm answer to “what should my child work on right now?” — one clear lesson, picked for this learner, today."
      primaryCtaLabel="Start parent setup"
      secondaryCtaLabel="See how LessonRun works"
      secondaryCtaHref="/features/lessonrun"
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Features", href: "/features/todays-mission" },
        { name: "Today's Mission", href: "/features/todays-mission" },
      ]}
    >
      {/* §2 Problem */}
      <CalloutCard
        eyebrow="The problem"
        title="Learners get lost in dashboards"
        body={
          <p>
            Most learning products give kids a menu — units, lessons, badges, streaks — and ask a
            child to choose. For neurodiverse learners, executive-function-tired learners, or any
            learner at the end of a long school day, that menu is the moment they bounce.
          </p>
        }
        tone="slate"
      />

      {/* §3 AIVO solution + product mockup */}
      <MockupShowcase
        eyebrow="The AIVO answer"
        heading="One mission. One tap. One next step."
        body="Today's Mission collapses the menu into a single recommended lesson — chosen by AIVO using mastery state, pacing, accommodations, and recent session signals."
        bullets={[
          "Subject, tutor, goal, and estimated time at a glance",
          "One-tap start — no menu, no choice paralysis",
          "Parents and teachers see the same mission, in plain language",
        ]}
        mockupTitle="Today's Mission · Maya, Grade 3"
        mockup={
          <div className="space-y-3">
            <div className="rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 p-4 text-white">
              <p className="text-xs uppercase tracking-wider text-purple-100">Today's mission</p>
              <h3 className="mt-1 font-heading text-xl font-bold">Multiplying by 3s</h3>
              <p className="mt-1 text-xs text-purple-100">With Atlas · ~15 minutes · Math</p>
            </div>
            <div className="rounded-lg bg-slate-900 py-2.5 text-center text-sm font-semibold text-white">
              Start mission →
            </div>
            <p className="text-xs text-slate-500">Read-aloud and break mode are on for Maya.</p>
          </div>
        }
      />

      {/* §4 Mission priority logic */}
      <NumberedSteps
        heading="How AIVO picks today's mission"
        subheading="Mission priority isn't a black box — these are the signals AIVO considers, in order."
        steps={PRIORITY_LOGIC}
        columns={3}
      />

      {/* §5 Product mockup (alt view — what a teacher sees) */}
      <MockupShowcase
        eyebrow="Teacher view"
        heading="Same mission, surfaced in the class dashboard"
        body="Teachers don't have to remember what they assigned. The class view shows each learner's Today's Mission and flags the ones that may benefit from a check-in."
        bullets={[
          "Roster-wide visibility of today's mission per learner",
          "Intervention flags highlighted, not buried",
          "One click to assign a different mission if needed",
        ]}
        reverse
        mockupTitle="Class 3B · Today"
        mockup={
          <div className="space-y-2">
            {[
              { l: "Maya", m: "Multiplying by 3s", flag: false },
              { l: "Jordan", m: "Reading · main idea", flag: false },
              { l: "Sam", m: "Skip-counting · review", flag: true },
              { l: "Ada", m: "Writing · topic sentence", flag: false },
            ].map((r) => (
              <div
                key={r.l}
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                  r.flag ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
                }`}
              >
                <span className="font-semibold text-slate-900">{r.l}</span>
                <span className="text-slate-600">{r.m}</span>
              </div>
            ))}
          </div>
        }
      />

      {/* §6 Parent / teacher visibility */}
      <CalloutCard
        eyebrow="For parents and teachers"
        title="Plain-language visibility, not a data dump"
        body={
          <>
            <p>
              Parents see the same mission their child saw — in calm, plain language — alongside
              whether it was completed, paused, or skipped. Teachers see the roster view above. No
              raw scores, no rankings, no decoder ring required.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Today's Mission is visible across the parent dashboard, the teacher class view, and
              the weekly parent summary email.
            </p>
          </>
        }
        ctaLabel="See the parent page"
        ctaHref="/for-parents"
        tone="purple"
      />
    </LandingPageLayout>
  );
}
