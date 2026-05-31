import { MARKETING_ACCENTS } from "@aivo/brand";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { SITE_URL } from "@/lib/constants";
import { NumberedSteps, CalloutCard, MockupShowcase } from "@/components/marketing/sections";

const TITLE = "LessonRun · The personalized learning unit behind every AIVO lesson";
const DESCRIPTION =
  "LessonRun is AIVO's core personalized lesson — tutor-guided, scaffolded, with read-aloud and break mode built in. Mastery updates and parent summaries flow from each run.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/features/lessonrun`,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: `${SITE_URL}/features/lessonrun` },
};

const FLOW = [
  {
    title: "Intro",
    body: "Tutor greets the learner, sets the goal, and frames the run in plain language.",
  },
  { title: "Step", body: "Short, focused instructional step — sized for working memory." },
  { title: "Check", body: "A small check for understanding, never a high-stakes quiz item." },
  { title: "Adapt", body: "Hints, scaffolds, or a re-teach appear based on the check result." },
  {
    title: "Mastery update",
    body: "The learner's mastery state updates — feeding Today's Mission and the parent summary.",
  },
];

export default async function Page() {
  const t = await getTranslations("marketing.page_features_lessonrun");
  return (
    <LandingPageLayout
      badge="Feature · LessonRun"
      badgeColor={MARKETING_ACCENTS.blue}
      title={t("hero_title")}
      subtitle="LessonRun is what happens after the learner taps Start. Tutor-guided, scaffolded, sensory-aware — and quietly building a real picture of mastery."
      primaryCtaLabel="Start parent setup"
      secondaryCtaLabel="See Today's Mission"
      secondaryCtaHref="/features/todays-mission"
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Features", href: "/features/lessonrun" },
        { name: "LessonRun", href: "/features/lessonrun" },
      ]}
    >
      {/* §2 LessonRun flow */}
      <NumberedSteps
        heading="The LessonRun flow"
        subheading="Every LessonRun follows the same calm rhythm — intro, step, check, adapt, mastery — sized to the learner."
        steps={FLOW}
      />

      {/* §3 Tutor-guided learning */}
      <MockupShowcase
        eyebrow="Tutor-guided"
        heading="A real tutor voice, not a quiz engine"
        body="Each LessonRun is led by one of AIVO's 14 tutors. The tutor frames the goal, walks the learner through the step, and responds to checks in tutor-appropriate language — calm, encouraging, never preachy."
        bullets={[
          "14 tutors, each with a distinct personality and subject specialty",
          "Tutor voice is consistent across steps within a run",
          "No generic AI chat — every message is in tutor character",
        ]}
        mockupTitle="LessonRun · Multiplying by 3s · Step 2 of 5"
        mockup={
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600"
                aria-hidden
              />
              <p className="text-sm font-bold text-slate-900">Atlas</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700">
              {t("count_by_3s_prompt")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["5", "6", "7", "9"].map((w) => (
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

      {/* §4 Hints & scaffolds */}
      <MockupShowcase
        eyebrow="Hints & scaffolds"
        heading="Tiered hints — never an answer dump"
        body="When a learner gets stuck, AIVO gives the smallest hint that could unstick them. If that's not enough, the next hint adds a little more. The answer is never just handed over."
        bullets={[
          "Hint 1: a nudge toward strategy",
          "Hint 2: a worked partial example",
          "Hint 3: a step-by-step walk-through (still not the bare answer)",
        ]}
        reverse
        mockupTitle="Hint · Tier 2"
        mockup={
          <div className="space-y-3">
            <div className="rounded-xl bg-purple-50 p-3 text-sm text-slate-700 border border-purple-100">
              {t("hint_counting_fingers")}
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>🔊 Read this aloud</span>
              <span>{t("need_another_hint")}</span>
            </div>
          </div>
        }
      />

      {/* §5 Read-aloud */}
      <CalloutCard
        eyebrow="Read-aloud"
        title={t("voice_support_title")}
        body="Instructions, hints, answer choices, and tutor feedback can all be read aloud. Voice settings persist per learner — once it's on, it stays on. Read-aloud is treated as a learning support, not a luxury feature."
        tone="blue"
      />

      {/* §6 Break mode */}
      <CalloutCard
        eyebrow="Break mode"
        title={t("break_mode_title")}
        body={
          <>
            <p>
              When a learner needs a moment, Break Mode steps in with a calm transition screen. No
              timer pressure, no scolding, no “you lost your streak.” The LessonRun pauses cleanly
              and resumes where the learner left off.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Break Mode can be auto-triggered by the learner's profile, suggested by AIVO when
              signals call for it, or chosen by the learner at any time.
            </p>
          </>
        }
        tone="emerald"
      />

      {/* §7 Mastery update */}
      <MockupShowcase
        eyebrow="Mastery update"
        heading="Real mastery, not just minutes-on-task"
        body="At the end of a LessonRun, AIVO updates the learner's mastery state per skill. Today's Mission, the weekly parent summary, and the teacher dashboard all pull from this same signal."
        bullets={[
          "Per-skill mastery, not aggregate “points”",
          "Mastery decays gently if a skill isn't revisited",
          "Mastery is what teachers see in the IEP / RTI view",
        ]}
        mockupTitle="Maya · Mastery after this run"
        mockup={
          <div className="space-y-2">
            {[
              { l: "Skip-counting by 3s", s: "Strong" },
              { l: "Times-table · 3s", s: "Building" },
              { l: "Word problems · ×3", s: "Practicing" },
            ].map((r) => (
              <div
                key={r.l}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
              >
                <span className="font-semibold text-slate-900">{r.l}</span>
                <span className="text-slate-500">{r.s}</span>
              </div>
            ))}
          </div>
        }
      />

      {/* §8 Parent summary */}
      <MockupShowcase
        eyebrow="Parent summary"
        heading="What parents see after a LessonRun"
        body="Each run feeds the weekly parent summary in plain language. Strengths first, growth areas second, what to celebrate at the top."
        bullets={[
          "Strengths-first weekly summary",
          "Read-aloud and break usage surfaced",
          "Designed to read in two minutes on a phone",
        ]}
        reverse
        mockupTitle="Parent summary · This week"
        mockup={
          <div className="space-y-3">
            <h3 className="font-heading text-base font-bold text-slate-900">
              {t("maya_strong_week")}
            </h3>
            <p className="text-sm text-slate-600">
              5 of 5 missions completed. Skip-counting clicked.
            </p>
            <div className="space-y-2">
              {[
                "Math · skip-counting strong",
                "Reading · used read-aloud 12 min",
                "Took 1 break · returned to finish",
              ].map((r) => (
                <div key={r} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                  {r}
                </div>
              ))}
            </div>
          </div>
        }
      />
    </LandingPageLayout>
  );
}
