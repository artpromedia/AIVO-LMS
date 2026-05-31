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

const audience = AUDIENCES.find((a) => a.slug === "for-schools")!;

export const metadata: Metadata = audienceMetadata(audience);

const SCHOOL_WORKFLOW = [
  {
    title: "Roster setup",
    body: "Add classes manually or import via CSV. SIS/OneRoster-ready architecture for districts.",
  },
  {
    title: "Teacher onboarding",
    body: "Teachers see a familiar class dashboard from day one — no 14-tab learning curve.",
  },
  {
    title: "Learner baselines",
    body: "Calm, low-pressure adaptive baselines per learner — not building-wide stress tests.",
  },
  {
    title: "Today's Mission distribution",
    body: "Each learner gets one clear next-best action, surfaced to the teacher.",
  },
  {
    title: "Mastery & intervention",
    body: "The dashboard highlights who needs a check-in, not who's behind.",
  },
  {
    title: "Plain-language reports",
    body: "Progress summaries parents and admins can actually read.",
  },
];

export default async function Page() {
  const t = await getTranslations("marketing.page_for_schools");
  return (
    <LandingPageLayout
      badge={audience.badge}
      badgeColor={audience.badgeColor}
      title={audience.title}
      subtitle={audience.subtitle}
      primaryCtaLabel="Request a demo"
      secondaryCtaLabel="Download school packet"
      secondaryCtaHref="/contact?intent=school-packet"
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: audience.badge, href: `/${audience.slug}` },
      ]}
    >
      {/* §2 Why personalized learning fails without workflow */}
      <CalloutCard
        eyebrow="The honest version"
        title={t("callout_workflow_title")}
        body={
          <p>
            Schools have been promised &ldquo;personalized learning&rdquo; for a decade. Most
            products deliver another dashboard. AIVO is built around the classroom workflow first —
            visibility, intervention triggers, and plain-language reports — so the personalization
            doesn't cost the teacher their planning period.
          </p>
        }
        tone="slate"
      />

      {/* §3 AIVO school workflow */}
      <NumberedSteps
        heading="The AIVO school workflow"
        subheading="From roster to running classrooms in the same week — without an army of integrations."
        steps={SCHOOL_WORKFLOW}
      />

      {/* §4 Teacher dashboard */}
      <MockupShowcase
        eyebrow="Teacher dashboard"
        heading="See your class in 30 seconds"
        body="A heat-mapped class view so teachers can spot who's on track, who needs a check-in, and who's flying — without opening 22 student tabs."
        bullets={[
          "Heat-mapped mastery view across the roster",
          "Today's Mission visibility per learner",
          "One-click intervention queue",
        ]}
        mockupTitle="Class 3B · Today"
        mockup={
          <div className="space-y-3">
            <h3 className="font-heading text-base font-bold text-slate-900">
              22 learners · 18 active today
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 16 }).map((_, i) => {
                const flagged = i === 2 || i === 7 || i === 11;
                const tone = flagged
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800";
                return (
                  <div key={i} className={`rounded ${tone} p-1.5 text-center`}>
                    <p className="font-heading text-[10px] font-bold">L{i + 1}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">3 learners may benefit from a check-in.</p>
          </div>
        }
      />

      {/* §5 Roster & class support */}
      <MockupShowcase
        eyebrow="Roster & classes"
        heading="Rostering that respects how schools actually work"
        body="Manual entry, CSV import, or full SIS/OneRoster integration when your district is ready. Classes can be co-taught and re-grouped without losing learner history."
        bullets={[
          "CSV import for solo-school deployments",
          "OneRoster-ready architecture for district rollout",
          "Co-teaching and intervention groupings supported",
        ]}
        reverse
        mockupTitle="Roster · Grade 3"
        mockup={
          <div className="space-y-2">
            {[
              "Class 3A · Ms. Patel · 24 learners",
              "Class 3B · Mr. Owens · 22 learners",
              "Reading group · Ms. Garcia · 6 learners",
            ].map((row) => (
              <div
                key={row}
                className="rounded-lg border border-slate-200 bg-white p-3 text-xs font-body text-slate-700"
              >
                {row}
              </div>
            ))}
          </div>
        }
      />

      {/* §6 Progress visibility */}
      <MockupShowcase
        eyebrow="Progress visibility"
        heading="Mastery you can show in a parent-teacher conference"
        body="Per-learner progress summaries that lead with strengths, name growth areas in plain language, and skip the test-score jargon."
        bullets={[
          "Per-learner plain-language summaries",
          "Class-level mastery rollups",
          "Optional export for IEP and RTI meetings",
        ]}
        mockupTitle="Maya · This quarter"
        mockup={
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              {t("progress_summary")}
            </p>
            <div className="space-y-1.5">
              {[
                "Reading · steady progress",
                "Math · working through 3s",
                "Writing · early draft skills emerging",
              ].map((r) => (
                <div key={r} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                  {r}
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* §7 Special education support */}
      <CalloutCard
        eyebrow="Special education"
        title={t("callout_neurodiverse_title")}
        body="AIVO can use parent-provided context and optional accommodation information to adapt pacing, scaffolds, read-aloud, and lesson structure — without exposing learners to clinical labels."
        ctaLabel="See the special-education page"
        ctaHref="/for-special-education"
        tone="emerald"
      />

      {/* §8 Privacy / security */}
      <TrustStripInline
        heading="Privacy and security posture"
        subheading="Built around the school day, not the data exhaust. Designed for FERPA-aware data handling and COPPA-aware student workflows."
      />
    </LandingPageLayout>
  );
}
