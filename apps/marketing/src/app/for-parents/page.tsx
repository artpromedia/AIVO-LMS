import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { audienceMetadata } from "@/components/marketing/AudiencePage";
import { AUDIENCES } from "@/lib/landing-content";
import {
  PainPointsGrid,
  NumberedSteps,
  CalloutCard,
  MockupShowcase,
  AdaptationsList,
  TrustStripInline,
  PageFAQ,
} from "@/components/marketing/sections";

const audience = AUDIENCES.find((a) => a.slug === "for-parents")!;

export const metadata: Metadata = audienceMetadata(audience);

const LOOP_STEPS = [
  {
    title: "Create the learner profile",
    body: "Add your child in minutes — strengths, interests, and challenges in plain language.",
  },
  {
    title: "Complete the parent assessment",
    body: "Quick context so AIVO knows where to start and what to avoid.",
  },
  {
    title: "Add IEP context (optional)",
    body: "Drop in accommodation context if you have it. Skip if you don't.",
  },
  { title: "Adaptive baseline", body: "A calm, low-pressure baseline — not a high-stakes test." },
  { title: "Today's Mission", body: "One clear next-best learning action, every day." },
  { title: "LessonRuns", body: "Tutor-guided lessons with hints, scaffolds, and read-aloud." },
  {
    title: "Weekly summary",
    body: "Plain-language progress, designed for parents — not data scientists.",
  },
];

const ACCESSIBILITY_ITEMS = [
  {
    title: "Read-aloud on every step",
    body: "Voiceover support across math, reading, and instructions.",
  },
  { title: "Reduced motion mode", body: "Calmer transitions for sensory-sensitive learners." },
  { title: "High-contrast & large text", body: "Built-in toggles, no extension required." },
  { title: "Keyboard & switch access", body: "Full operability without a mouse." },
];

export default async function Page() {
  const t = await getTranslations("marketing.page_for_parents");
  return (
    <LandingPageLayout
      badge={audience.badge}
      badgeColor={audience.badgeColor}
      title={audience.title}
      subtitle={audience.subtitle}
      primaryCtaLabel="Start parent setup"
      secondaryCtaLabel="Join the waitlist"
      secondaryCtaHref="/contact?intent=waitlist"
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: audience.badge, href: `/${audience.slug}` },
      ]}
    >
      {/* §2 Pain points */}
      <PainPointsGrid
        heading="The things parents tell us"
        subheading="If any of these sound familiar, you're not alone — and they're the exact reasons we built AIVO."
        points={[
          "I do not know where my child is struggling.",
          "Generic tutoring does not adapt enough.",
          "I want progress updates I can understand.",
          "My child needs support without shame.",
          "I want learning to feel less overwhelming.",
        ]}
      />

      {/* §3 AIVO learning loop */}
      <NumberedSteps
        heading="How AIVO works for your family"
        subheading="A calm, transparent loop — same steps for every learner, adapted to their pace and needs."
        steps={LOOP_STEPS}
      />

      {/* §4 Parent assessment */}
      <MockupShowcase
        eyebrow="Parent assessment"
        heading="Five minutes of context that shapes everything"
        body={
          <>
            You know your child. The parent assessment is how AIVO learns what matters — interests,
            sensitivities, what's worked, what hasn't — in plain questions you can answer in a
            single sitting.
          </>
        }
        bullets={[
          "Five short sections, save and return anytime",
          "No clinical language, no diagnostic claims",
          "Editable later — you stay in control",
        ]}
        mockupTitle="Parent assessment · Section 2 of 5"
        mockup={
          <div className="space-y-3">
            <p className="text-sm font-semibold text-iw-ink">{t("reading_question")}</p>
            <div className="grid grid-cols-2 gap-2">
              {["Loves it", "Mixed", "Avoids it", "Not sure"].map((o) => (
                <div
                  key={o}
                  className="rounded-lg border-2 border-iw-border bg-white py-2 text-center text-sm font-body text-iw-ink"
                >
                  {o}
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-iw-raised p-3 text-xs text-iw-ink-muted">
              {t("answers_saved")}
            </div>
          </div>
        }
      />

      {/* §5 Optional IEP / accommodation */}
      <CalloutCard
        eyebrow="Optional — only if you have one"
        title={t("iep_title")}
        body={
          <>
            <p>
              If your child has an IEP, 504, or informal accommodation plan, you can share the
              relevant context with AIVO. We use it to adjust pacing, scaffolds, and supports —
              never to label your child or expose raw plan text inside the product.
            </p>
            <p className="mt-3 text-sm text-iw-ink-muted">{t("aivo_disclaimer")}</p>
          </>
        }
        ctaLabel="Read our special education page"
        ctaHref="/for-special-education"
        tone="purple"
      />

      {/* §6 Personalized baseline */}
      <MockupShowcase
        eyebrow="Personalized baseline"
        heading="A calm starting point, not a stressful test"
        body="The baseline is an adaptive activity that finds your child's comfortable starting line across each subject — without timer pressure, scores, or stakes."
        bullets={[
          "Adapts in real time to keep difficulty just right",
          "Built-in break activities — no rage-quit moments",
          "Results frame strengths first, then growth areas",
        ]}
        reverse
        mockupTitle="Baseline · Reading · Activity 3"
        mockup={
          <div className="space-y-3">
            <p className="text-xs text-iw-ink-muted">{t("take_a_breath")}</p>
            <div className="rounded-iw-card border border-iw-border bg-iw-raised/60 p-4 text-sm text-iw-ink">
              {t("which_word_means")} <span className="font-bold">happy</span>?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["joyful", "tired", "loud", "quiet"].map((w) => (
                <div
                  key={w}
                  className="rounded-lg border-2 border-iw-border bg-white py-2 text-center text-sm font-body text-iw-ink"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-iw-ink-muted">
              <span>🔊 Read aloud</span>
              <span>{t("need_a_break")}</span>
            </div>
          </div>
        }
      />

      {/* §7 Today's Mission */}
      <MockupShowcase
        eyebrow="Today's Mission"
        heading="One clear next-best lesson, every day"
        body="No endless dashboards. AIVO selects the single most important thing for your child to do today — adapted to their level, energy, and context."
        bullets={[
          "Subject, tutor, goal, and estimated time at a glance",
          "One-tap start — no menu navigation required",
          "You see it too, in plain language",
        ]}
        mockupTitle="Today's Mission · Maya, Grade 3"
        mockup={
          <div className="space-y-3">
            <div className="rounded-iw-card bg-iw-primary p-4 text-white">
              <p className="text-xs uppercase tracking-wider text-iw-purple-100">
                {t("todays_mission")}
              </p>
              <h3 className="mt-1 font-heading text-xl font-bold">{t("multiplying_by_3s")}</h3>
              <p className="mt-1 text-xs text-iw-purple-100">{t("with_atlas")}</p>
            </div>
            <div className="rounded-lg bg-iw-ink py-2.5 text-center text-sm font-semibold text-white">
              {t("start_mission")}
            </div>
          </div>
        }
      />

      {/* §8 Parent progress summaries */}
      <MockupShowcase
        eyebrow="Weekly summary"
        heading="Plain-language progress, not a grade book"
        body="Once a week, you get a calm summary of what your child worked on, what's clicking, and where they may need a parent moment."
        bullets={[
          "Strengths first, growth areas second",
          "No raw test scores — just what to know and what to celebrate",
          "Designed to read in two minutes on your phone",
        ]}
        reverse
        mockupTitle="Parent summary · This week"
        mockup={
          <div className="space-y-3">
            <h3 className="font-heading text-base font-bold text-iw-ink">
              {t("maya_strong_week")}
            </h3>
            <p className="text-sm text-iw-ink-muted">
              5 of 5 missions completed. Focus areas adapted twice.
            </p>
            <div className="space-y-2">
              {[
                { l: "Reading", s: "Steady progress" },
                { l: "Math · 3s", s: "Working through it" },
                { l: "Read-aloud used", s: "12 minutes" },
              ].map((r) => (
                <div
                  key={r.l}
                  className="flex items-center justify-between rounded-lg border border-iw-border bg-white p-2.5 text-xs"
                >
                  <span className="font-semibold text-iw-ink">{r.l}</span>
                  <span className="text-iw-ink-muted">{r.s}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* §9 Accessibility / read-aloud */}
      <AdaptationsList
        heading="Accessibility built in, not bolted on"
        subheading="Supports turn on automatically based on the parent assessment and any accommodation context you share."
        items={ACCESSIBILITY_ITEMS}
      />

      {/* §10 Safety & privacy */}
      <TrustStripInline
        heading="Safe, private, and built for kids"
        subheading="Designed for COPPA-aware workflows. No ads. No data sales. Parents stay in control."
      />

      {/* §11 FAQ */}
      <PageFAQ items={audience.faqs} />
    </LandingPageLayout>
  );
}
