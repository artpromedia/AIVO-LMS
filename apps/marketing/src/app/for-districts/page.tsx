import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { audienceMetadata } from "@/components/marketing/AudiencePage";
import { AUDIENCES } from "@/lib/landing-content";
import {
  NumberedSteps,
  CalloutCard,
  MockupShowcase,
  TrustStripInline,
} from "@/components/marketing/sections";

const audience = AUDIENCES.find((a) => a.slug === "for-districts")!;

export const metadata: Metadata = audienceMetadata(audience);

const DEPLOYMENT_STEPS = [
  {
    title: "Discovery & DPA",
    body: "Security and privacy review, DPA exchange, and procurement docs first. No surprises later.",
  },
  {
    title: "Pilot scoping",
    body: "Choose schools, classes, and learner counts. We size the pilot to your evaluation criteria.",
  },
  {
    title: "Roster integration",
    body: "OneRoster-ready architecture, CSV fallback, or manual rostering for short pilots.",
  },
  {
    title: "Teacher onboarding",
    body: "Cohort training, recorded sessions, and an opt-in coach for the first two weeks.",
  },
  {
    title: "Mid-pilot review",
    body: "We bring data, not just sentiment — usage, mastery trends, teacher feedback.",
  },
  {
    title: "Expansion planning",
    body: "Scale to a building or the district with the same architecture you piloted on.",
  },
];

export default async function Page() {
  const t = await getTranslations("marketing.page_for_districts");
  return (
    <LandingPageLayout
      badge={audience.badge}
      badgeColor={audience.badgeColor}
      title={audience.title}
      subtitle={audience.subtitle}
      primaryCtaLabel="Request DPA / security packet"
      primaryCtaHref="/contact?intent=district-packet"
      secondaryCtaLabel="Request a district demo"
      secondaryCtaHref="/contact?intent=district-demo"
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: audience.badge, href: `/${audience.slug}` },
      ]}
    >
      {/* §2 Deployment overview */}
      <NumberedSteps
        heading="A deployment your IT team won't hate"
        subheading="Procurement-friendly, evidence-ready, and built around the district calendar."
        steps={DEPLOYMENT_STEPS}
      />

      {/* §3 Rostering / SIS */}
      <CalloutCard
        eyebrow="Rostering"
        title={t("rostering_title")}
        body={
          <>
            <p>
              AIVO's rostering architecture is designed for OneRoster integration with major SIS
              providers. For short pilots or single buildings, CSV import and manual rostering are
              first-class paths — no need to wait on a vendor ticket to start a pilot.
            </p>
            <p className="mt-3 text-sm text-iw-ink-muted">
              We do not overclaim a roster integration we have not built. If your district needs a
              specific SIS path, we'll tell you where it stands before you sign.
            </p>
          </>
        }
        tone="blue"
      />

      {/* §4 Seat licensing */}
      <section className="mb-14" aria-labelledby="licensing-heading">
        <h2
          id="licensing-heading"
          className="text-2xl md:text-3xl font-heading font-bold text-iw-ink mb-3"
        >
          {t("licensing_heading")}
        </h2>
        <p className="text-iw-ink-muted font-body mb-6 leading-relaxed">
          Per-learner seats with district volume tiers. Multi-year commitments carry lock-in
          pricing. We publish a quote — not a fake list price.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { t: "Per-learner seats", b: "Active-learner counting, not a roster headcount tax." },
            { t: "Volume tiers", b: "Tiered pricing past 500, 2 500, and 10 000 learners." },
            { t: "Multi-year locks", b: "Two- and three-year price locks available on request." },
          ].map((c) => (
            <div key={c.t} className="rounded-iw-card border border-iw-border bg-white p-5 shadow-soft-1">
              <h3 className="font-heading font-bold text-iw-ink">{c.t}</h3>
              <p className="mt-1 text-sm text-iw-ink-muted font-body">{c.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* §5 Privacy / security */}
      <TrustStripInline
        heading="Privacy and security posture"
        subheading="Designed for FERPA-aware data handling and COPPA-aware learner workflows. We publish a security packet and subprocessor list — we do not claim certifications we don't hold."
      />

      {/* §6 Accessibility */}
      <CalloutCard
        eyebrow="Accessibility"
        title={t("accessibility_title")}
        body={
          <>
            <p>
              Accessibility is a build-time concern, not an add-on. AIVO targets WCAG 2.2 AA across
              learner, parent, and teacher surfaces, with built-in read-aloud, reduced-motion,
              high-contrast, and large-text modes.
            </p>
            <p className="mt-3 text-sm text-iw-ink-muted">{t("accessibility_gaps_note")}</p>
          </>
        }
        ctaLabel="Read the accessibility statement"
        ctaHref="/accessibility"
        tone="emerald"
      />

      {/* §7 Reporting */}
      <MockupShowcase
        eyebrow="Reporting"
        heading="District-level reporting without district-level surveillance"
        body="Aggregate dashboards for the curriculum office, building-level rollups for principals, and per-learner detail only where role permissions allow."
        bullets={[
          "Aggregate mastery and engagement by school",
          "Per-school plain-language summaries",
          "Exportable for board packets and federal reporting",
        ]}
        mockupTitle="District · Spring snapshot"
        mockup={
          <div className="space-y-2">
            {[
              { s: "Elementary · 4 schools", v: "Steady engagement" },
              { s: "Middle · 2 schools", v: "Reading lifts visible" },
              { s: "Pilot · 1 school", v: "Early signal" },
            ].map((r) => (
              <div
                key={r.s}
                className="flex items-center justify-between rounded-lg border border-iw-border bg-white p-2.5 text-xs"
              >
                <span className="font-semibold text-iw-ink">{r.s}</span>
                <span className="text-iw-ink-muted">{r.v}</span>
              </div>
            ))}
          </div>
        }
      />

      {/* §8 DPA / security packet CTA (inline because it's the primary district ask) */}
      <CalloutCard
        eyebrow="For procurement"
        title={t("dpa_title")}
        body="Architecture diagram, data flow, subprocessor list, accessibility statement, and a draft Data Processing Agreement — sent the same business day."
        ctaLabel="Request the packet"
        ctaHref="/contact?intent=district-packet"
        tone="slate"
      />
    </LandingPageLayout>
  );
}
