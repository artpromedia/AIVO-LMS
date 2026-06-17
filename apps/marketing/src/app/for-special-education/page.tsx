import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { audienceMetadata } from "@/components/marketing/AudiencePage";
import { AUDIENCES } from "@/lib/landing-content";
import {
  NumberedSteps,
  CalloutCard,
  AdaptationsList,
  PrivacyBoundary,
  TrustStripInline,
  PageFAQ,
} from "@/components/marketing/sections";

const audience = AUDIENCES.find((a) => a.slug === "for-special-education")!;

export const metadata: Metadata = audienceMetadata(audience);

const CONTEXT_STEPS = [
  {
    title: "Parent context first",
    body: "What's worked, what's hard, what your child loves — in plain language, not clinical jargon.",
  },
  {
    title: "Optional accommodation context",
    body: "If you have an IEP, 504, or informal plan, you can share the relevant context. Skip if you don't.",
  },
  {
    title: "Adaptive baseline, calm by design",
    body: "No timer pressure, no high-stakes scores — a comfortable starting line per subject.",
  },
  {
    title: "Personalized supports turn on",
    body: "Pacing, scaffolds, read-aloud, hint depth, and break cues adjust automatically.",
  },
  {
    title: "Parent and teacher safety boundaries",
    body: "Adults see what they need. Learners never see clinical labels about themselves.",
  },
];

const ADAPTATIONS = [
  { title: "Step length", body: "Shorter, focused steps for working-memory support." },
  { title: "Reading support", body: "Decoded text, syllable hints, dyslexia-friendly fonts." },
  { title: "Read-aloud", body: "Voiceover on instructions, choices, and feedback." },
  { title: "Hints", body: "Tiered hints — never an answer dump." },
  { title: "Scaffolded examples", body: "Worked examples before independent practice." },
  { title: "Break reminders", body: "Gentle, not interruptive — and configurable per learner." },
  {
    title: "Reduced cognitive load",
    body: "Single-task layouts, minimal chrome, no surprise transitions.",
  },
  { title: "Progress summaries", body: "Strengths-first weekly summaries for parents." },
];

const ACCESSIBILITY = [
  {
    title: "WCAG 2.2 AA design target",
    body: "Color contrast, focus states, semantic markup — verified in CI.",
  },
  { title: "Keyboard & switch access", body: "Full operability without a mouse or touch screen." },
  { title: "Reduced motion mode", body: "Calmer transitions for sensory-sensitive learners." },
  { title: "High-contrast & large text", body: "Built-in toggles, no extension required." },
];

const SE_FAQS = [
  {
    q: "Does AIVO replace my child's IEP team, teachers, or therapists?",
    a: "No. AIVO is a learning support tool — it does not replace teachers, IEP teams, special educators, therapists, or specialists. It is designed to help with day-to-day learning while the professionals around your child do their work.",
  },
  {
    q: "Does AIVO diagnose learning differences?",
    a: "No. AIVO does not diagnose. We use parent-provided context and optional accommodation information to personalize learning supports — not to label your child.",
  },
  {
    q: "Where does my child's IEP information live?",
    a: "Your district's special-services system remains the source of truth for IEPs. AIVO only uses the accommodation context you choose to share, and it is never exposed as raw IEP text inside the product.",
  },
  {
    q: "Is AIVO FERPA or COPPA certified?",
    a: "FERPA and COPPA are not certifications — they are laws. AIVO is designed for FERPA-aware data handling and COPPA-aware workflows for users under 13. We publish what we do; we do not overclaim what we are.",
  },
  ...audience.faqs.slice(0, 2),
];

export default async function Page() {
  const t = await getTranslations("marketing.page_for_special_education");
  return (
    <LandingPageLayout
      badge={audience.badge}
      badgeColor={audience.badgeColor}
      title={audience.title}
      subtitle={audience.subtitle}
      primaryCtaLabel="Request a careful intro call"
      primaryCtaHref="/contact?intent=se-intro"
      secondaryCtaLabel="Read the accessibility statement"
      secondaryCtaHref="/accessibility"
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: audience.badge, href: `/${audience.slug}` },
      ]}
    >
      {/* §2 Support should meet the learner where they are */}
      <CalloutCard
        title={t("support_title")}
        body={
          <>
            <p>
              Every learner deserves a calm starting line, supports that adjust quietly, and adults
              who can see what they need to see — without their child being labelled by an app.
            </p>
            <p className="mt-3">
              AIVO is built around that idea. We don't promise outcomes. We don't claim to replace
              the professionals around your learner. We do build a learning environment that takes
              context seriously.
            </p>
          </>
        }
        tone="purple"
      />

      {/* §3 How AIVO uses learning context */}
      <NumberedSteps
        heading="How AIVO uses learning context"
        subheading="Step by step, with consent at every layer."
        steps={CONTEXT_STEPS}
      />

      {/* §4 Optional IEP / accommodation explanation */}
      <CalloutCard
        eyebrow="Optional — never required"
        title={t("iep_sharing_title")}
        body={
          <>
            <p>
              You can share the parts of an IEP, 504, or informal accommodation plan that affect
              day-to-day learning — pacing notes, read-aloud preferences, scaffolding cues. We use
              that context to personalize supports.
            </p>
            <p className="mt-3 text-sm text-iw-ink-muted">
              We never display raw IEP text inside the learner experience. Clinical sections
              (eligibility, evaluations, signatures) belong in your district's system, not ours.
            </p>
          </>
        }
        tone="blue"
      />

      {/* §5 What AIVO may adapt */}
      <AdaptationsList
        heading="What AIVO may adapt"
        subheading="Personalization is structural — not cosmetic skins or motivational stickers."
        items={ADAPTATIONS}
      />

      {/* §6 Parent vs learner privacy boundary */}
      <PrivacyBoundary
        heading="Parent view vs learner view — a real boundary"
        subheading="Both sides see what matters. Neither side sees what would harm trust."
        parent={{
          title: "Parents see",
          items: [
            "Plain-language weekly summary",
            "Accommodations in effect",
            "Read-aloud / break usage",
            "What's working and what to celebrate",
          ],
        }}
        learner={{
          title: "Learners never see",
          items: [
            "Clinical labels about themselves",
            "Raw IEP or 504 text",
            "Comparison rankings vs classmates",
            "Diagnostic-style framing of their work",
          ],
        }}
      />

      {/* §7 Teacher-safe summaries */}
      <CalloutCard
        eyebrow="For teachers and specialists"
        title={t("teacher_summaries_title")}
        body="Teachers see the pacing, scaffolds, and supports each learner needs — without raw IEP text, eligibility details, or clinical language exposed in the product."
        ctaLabel="See the teacher page"
        ctaHref="/for-teachers"
        tone="emerald"
      />

      {/* §8 Accessibility features */}
      <AdaptationsList
        heading="Accessibility features"
        subheading="Built in, not bolted on."
        items={ACCESSIBILITY}
      />

      {/* §9 Privacy & consent */}
      <TrustStripInline
        heading="Privacy and consent, taken seriously"
        subheading="Designed for COPPA-aware workflows. Parental consent is required for under-13 learners. No ads. No data sales. Accommodation context is treated as sensitive and access-controlled."
      />

      {/* §10 FAQ */}
      <PageFAQ items={SE_FAQS} />
    </LandingPageLayout>
  );
}
