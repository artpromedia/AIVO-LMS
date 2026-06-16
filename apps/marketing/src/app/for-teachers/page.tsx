import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { audienceMetadata } from "@/components/marketing/AudiencePage";
import { AUDIENCES } from "@/lib/landing-content";
import { CalloutCard, MockupShowcase } from "@/components/marketing/sections";

const audience = AUDIENCES.find((a) => a.slug === "for-teachers")!;

export const metadata: Metadata = audienceMetadata(audience);

export default async function Page() {
  const t = await getTranslations("marketing.page_for_teachers");
  return (
    <LandingPageLayout
      badge={audience.badge}
      badgeColor={audience.badgeColor}
      title={audience.title}
      subtitle={audience.subtitle}
      primaryCtaLabel="Request a teacher demo"
      secondaryCtaLabel="See the school page"
      secondaryCtaHref="/for-schools"
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: audience.badge, href: `/${audience.slug}` },
      ]}
    >
      {/* §2 Class dashboard */}
      <MockupShowcase
        eyebrow="Class dashboard"
        heading="Open the app. See your class. Teach."
        body="A heat-mapped class view designed for the first three minutes of period one — not a 14-tab analytics suite."
        bullets={[
          "At-a-glance roster status",
          "Intervention flags highlighted, not buried",
          "Optional grouping suggestions you can ignore",
        ]}
        mockupTitle="Class 3B · Monday"
        mockup={
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 16 }).map((_, i) => {
              const flagged = i === 4 || i === 9;
              return (
                <div
                  key={i}
                  className={`rounded ${
                    flagged ? "bg-iw-warning-subtle text-iw-warning-strong" : "bg-iw-success-subtle text-iw-success-strong"
                  } p-1.5 text-center`}
                >
                  <p className="font-heading text-[10px] font-bold">L{i + 1}</p>
                </div>
              );
            })}
          </div>
        }
      />

      {/* §3 Skill gap view */}
      <MockupShowcase
        eyebrow="Skill gaps"
        heading="See the gap, not just the grade"
        body="When a learner stalls, AIVO surfaces the specific skill that's blocking progress — and a tutor-led plan to address it."
        bullets={[
          "Skill-by-skill view per learner",
          "Linked LessonRuns ready to assign",
          "Plain-language explanations for IEP and RTI meetings",
        ]}
        reverse
        mockupTitle="Maya · Math gaps"
        mockup={
          <div className="space-y-2">
            {[
              { l: "Skip-counting by 3s", s: "Practicing" },
              { l: "Times-table fluency", s: "Building" },
              { l: "Word problems · multiplication", s: "Not yet" },
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
        }
      />

      {/* §4 Assignment creation */}
      <MockupShowcase
        eyebrow="Assignments"
        heading="One assignment, every level"
        body="Push a single lesson to the roster; AIVO delivers it at each learner's functioning level with the right scaffolds, sensory profile, and accommodations."
        bullets={[
          "Differentiated automatically — you do not maintain 5 versions",
          "Schedule for today, tomorrow, or a week of LessonRuns",
          "Co-teacher visibility built in",
        ]}
        mockupTitle="New assignment"
        mockup={
          <div className="space-y-2.5">
            <div className="rounded-lg border border-iw-border bg-white p-3">
              <p className="text-xs font-semibold text-iw-ink-muted">Title</p>
              <p className="font-heading text-sm font-bold text-iw-ink">
                {t("assignment_title")}
              </p>
            </div>
            <div className="rounded-lg border border-iw-border bg-white p-3">
              <p className="text-xs font-semibold text-iw-ink-muted">{t("roster_label")}</p>
              <p className="text-sm text-iw-ink">{t("roster_value")}</p>
            </div>
            <div className="rounded-lg bg-iw-primary py-2 text-center text-sm font-semibold text-white">
              {t("assign_cta")}
            </div>
          </div>
        }
      />

      {/* §5 Recent LessonRuns */}
      <MockupShowcase
        eyebrow="Recent LessonRuns"
        heading="The receipts, in human language"
        body="A timeline of what each learner worked on, where they got stuck, where they breezed through, and what AIVO did next."
        bullets={[
          "Per-learner LessonRun history",
          "Read-aloud / hint / break events surfaced",
          "Exportable for IEP progress notes",
        ]}
        reverse
        mockupTitle="Maya · Last 7 days"
        mockup={
          <div className="space-y-2">
            {[
              { d: "Mon", t: "Multiplying by 3s · finished" },
              { d: "Tue", t: "Reading · used read-aloud 8 min" },
              { d: "Wed", t: "Math · break mode, returned" },
              { d: "Thu", t: "Today's Mission · skipped" },
            ].map((r) => (
              <div
                key={r.d + r.t}
                className="flex gap-3 rounded-lg border border-iw-border bg-white p-2.5 text-xs"
              >
                <span className="font-heading font-bold text-iw-ink w-8">{r.d}</span>
                <span className="text-iw-ink">{r.t}</span>
              </div>
            ))}
          </div>
        }
      />

      {/* §6 Instructional support summaries */}
      <CalloutCard
        eyebrow="Instructional summaries"
        title={t("callout_summaries_title")}
        body="AIVO writes per-learner instructional summaries in the tone of a thoughtful teacher — strengths first, growth areas named in non-clinical language, and next steps you can act on."
        tone="blue"
      />

      {/* §7 Privacy-aware accommodation view */}
      <CalloutCard
        eyebrow="Accommodation view"
        title={t("callout_accommodation_title")}
        body={
          <>
            <p>
              Teachers see what they need to teach — pacing notes, scaffold cues, read-aloud
              preferences — without raw IEP text, diagnoses, or clinical language exposed in the
              product.
            </p>
            <p className="mt-3 text-sm text-iw-ink-muted">
              Full IEP documents stay where they belong: in your district's special-services system,
              with the access controls already in place.
            </p>
          </>
        }
        ctaLabel="See the special-education page"
        ctaHref="/for-special-education"
        tone="purple"
      />
    </LandingPageLayout>
  );
}
