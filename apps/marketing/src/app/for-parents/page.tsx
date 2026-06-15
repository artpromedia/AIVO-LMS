import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { StickyHeader } from "@/components/marketing/StickyHeader";
import { Footer } from "@/components/marketing/Footer";
import { FunctioningLevels } from "@/components/marketing/FunctioningLevels";
import { breadcrumbJsonLd, type Crumb } from "@/components/marketing/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  AudienceHero,
  ComplianceBar,
  ClosingCTA,
  PainPointsGrid,
  NumberedSteps,
  CalloutCard,
  MockupShowcase,
  AdaptationsList,
  TrustStripInline,
  PageFAQ,
} from "@/components/marketing/sections";
import { audienceMetadata } from "@/components/marketing/AudiencePage";
import { AUDIENCES } from "@/lib/landing-content";
import { WEB_APP_URL } from "@/lib/constants";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";

const audience = AUDIENCES.find((a) => a.slug === "for-parents")!;

export const metadata: Metadata = audienceMetadata(audience);

const CRUMBS: Crumb[] = [
  { name: "Home", href: "/" },
  { name: audience.badge, href: `/${audience.slug}` },
];

const HERO_SUBTITLE =
  "Whether your child is gifted, on an IEP, or somewhere in between, AIVO adapts to how they learn — with calm pacing, plain-language progress, and supports that respect how they think.";

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
    title: "Read-aloud support",
    body: "Voiceover support across reading, math, and instructions.",
  },
  { title: "Reduced-motion option", body: "Calmer transitions for sensory-sensitive learners." },
  { title: "High-contrast & large text", body: "Built-in toggles, no extension required." },
  { title: "Keyboard-accessible", body: "Designed to be operable without a mouse." },
];

export default async function Page() {
  const sensoryMode = await getSensoryModeFromCookies();
  const t = await getTranslations("marketing.page_for_parents");
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <StickyHeader initialSensoryMode={sensoryMode} />
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />

      <main>
        <AudienceHero
          badge={audience.badge}
          badgeColor={audience.badgeColor}
          breadcrumbs={CRUMBS}
          headlinePre="Understand your child's progress."
          headlineEmph="Support every step."
          subtitle={HERO_SUBTITLE}
          primary={{ label: "Start parent setup", href: `${WEB_APP_URL}/signup?plan=family` }}
          secondary={{ label: "See a demo", href: "/demo" }}
          visual={
            <>
              <div
                className="absolute inset-0 rounded-[2rem] scale-[1.02] -z-10 bg-gradient-to-br from-indigo-100/50 via-white to-sky-100/40"
                aria-hidden="true"
              />
              <Image
                src="/images/hero/mother-son-sofa.webp"
                alt="A parent and child learning together at home"
                width={680}
                height={680}
                priority
                className="rounded-[2rem] shadow-[0_30px_60px_-30px_rgba(15,23,42,0.30)] w-full object-cover border border-slate-200/60 aspect-square"
              />
              {/* Honest floating chip — a real product moment (Today's Mission),
                  no efficacy numbers. */}
              <div className="absolute -bottom-5 -left-4 md:-bottom-7 md:-left-7 w-60 md:w-72 rounded-2xl bg-white shadow-[0_20px_45px_-20px_rgba(15,23,42,0.25)] border border-slate-200/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Today's Mission
                </p>
                <p className="font-heading text-base font-bold text-slate-900">
                  Multiplying by 3s · with Nova
                </p>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  One clear next step — in plain language.
                </p>
              </div>
            </>
          }
        />

        <ComplianceBar note="Designed for COPPA-aware student workflows. No ads. No data sales. Parents stay in control." />

        <div className="max-w-6xl mx-auto px-6 md:px-8 py-16 md:py-20">
          {/* Pain points */}
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

          {/* AIVO learning loop */}
          <NumberedSteps
            heading="How AIVO works for your family"
            subheading="A calm, transparent loop — same steps for every learner, adapted to their pace and needs."
            steps={LOOP_STEPS}
          />

          {/* Parent assessment */}
          <MockupShowcase
            eyebrow="Parent assessment"
            heading="Five minutes of context that shapes everything"
            body={
              <>
                You know your child. The parent assessment is how AIVO learns what matters —
                interests, sensitivities, what's worked, what hasn't — in plain questions you can
                answer in a single sitting.
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
                <p className="text-sm font-semibold text-slate-900">{t("reading_question")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {["Loves it", "Mixed", "Avoids it", "Not sure"].map((o) => (
                    <div
                      key={o}
                      className="rounded-lg border-2 border-slate-200 bg-white py-2 text-center text-sm font-body text-slate-700"
                    >
                      {o}
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  {t("answers_saved")}
                </div>
              </div>
            }
          />

          {/* Optional IEP / accommodation */}
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
                <p className="mt-3 text-sm text-slate-600">{t("aivo_disclaimer")}</p>
              </>
            }
            ctaLabel="Read our special education page"
            ctaHref="/for-special-education"
            tone="purple"
          />

          {/* Personalized baseline */}
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
                <p className="text-xs text-slate-500">{t("take_a_breath")}</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
                  {t("which_word_means")} <span className="font-bold">happy</span>?
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["joyful", "tired", "loud", "quiet"].map((w) => (
                    <div
                      key={w}
                      className="rounded-lg border-2 border-slate-200 bg-white py-2 text-center text-sm font-body text-slate-700"
                    >
                      {w}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>🔊 Read aloud</span>
                  <span>{t("need_a_break")}</span>
                </div>
              </div>
            }
          />

          {/* Today's Mission */}
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
                <div className="rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 p-4 text-white">
                  <p className="text-xs uppercase tracking-wider text-purple-100">
                    {t("todays_mission")}
                  </p>
                  <h3 className="mt-1 font-heading text-xl font-bold">{t("multiplying_by_3s")}</h3>
                  <p className="mt-1 text-xs text-purple-100">{t("with_atlas")}</p>
                </div>
                <div className="rounded-lg bg-slate-900 py-2.5 text-center text-sm font-semibold text-white">
                  {t("start_mission")}
                </div>
              </div>
            }
          />

          {/* Parent progress summaries */}
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
                <h3 className="font-heading text-base font-bold text-slate-900">
                  {t("maya_strong_week")}
                </h3>
                <p className="text-sm text-slate-600">
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
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                    >
                      <span className="font-semibold text-slate-900">{r.l}</span>
                      <span className="text-slate-500">{r.s}</span>
                    </div>
                  ))}
                </div>
              </div>
            }
          />
        </div>

        {/* Neurodiversity, demonstrated by the real product: five functioning levels */}
        <FunctioningLevels />

        <div className="max-w-6xl mx-auto px-6 md:px-8 py-16 md:py-20">
          {/* Accessibility / read-aloud */}
          <AdaptationsList
            heading="Accessibility built in, not bolted on"
            subheading="Supports turn on based on the parent assessment and any accommodation context you share."
            items={ACCESSIBILITY_ITEMS}
          />

          {/* Safety & privacy */}
          <TrustStripInline
            heading="Safe, private, and built for kids"
            subheading="Designed for COPPA-aware workflows. No ads. No data sales. Parents stay in control."
          />

          {/* FAQ */}
          <PageFAQ items={audience.faqs} />
        </div>

        <ClosingCTA
          title="A calmer, more personal way to learn."
          body="Start your child's profile in minutes. Calm pacing, plain-language progress, and support that adapts to how they learn."
          primary={{ label: "Start parent setup", href: `${WEB_APP_URL}/signup?plan=family` }}
          secondary={{ label: "See a demo", href: "/demo" }}
          imageSrc="/images/hero/girl-reading.png"
          imageAlt="A child reading"
        />
      </main>

      <Footer />
    </div>
  );
}
