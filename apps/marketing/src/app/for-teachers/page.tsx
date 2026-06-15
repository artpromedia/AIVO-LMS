import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StickyHeader } from "@/components/marketing/StickyHeader";
import { Footer } from "@/components/marketing/Footer";
import { ProductMockupFrame } from "@/components/marketing/primitives/ProductMockupFrame";
import { breadcrumbJsonLd, type Crumb } from "@/components/marketing/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  AudienceHero,
  ComplianceBar,
  ClosingCTA,
  CalloutCard,
  MockupShowcase,
} from "@/components/marketing/sections";
import { audienceMetadata } from "@/components/marketing/AudiencePage";
import { AUDIENCES } from "@/lib/landing-content";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";

const audience = AUDIENCES.find((a) => a.slug === "for-teachers")!;

export const metadata: Metadata = audienceMetadata(audience);

const CRUMBS: Crumb[] = [
  { name: "Home", href: "/" },
  { name: audience.badge, href: `/${audience.slug}` },
];

const HERO_SUBTITLE =
  "Open the app and see your class at a glance — who is on track, who needs a check-in, and the specific skill behind a stall — with progress data ready for your IEP and RTI conversations.";

export default async function Page() {
  const sensoryMode = await getSensoryModeFromCookies();
  const t = await getTranslations("marketing.page_for_teachers");
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <StickyHeader initialSensoryMode={sensoryMode} />
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />

      <main>
        <AudienceHero
          badge={audience.badge}
          badgeColor={audience.badgeColor}
          breadcrumbs={CRUMBS}
          headlinePre="Differentiate with confidence."
          headlineEmph="Intervene with impact."
          subtitle={HERO_SUBTITLE}
          primary={{ label: "Request a teacher demo", href: "/demo" }}
          secondary={{ label: "See the school page", href: "/for-schools" }}
          visual={
            <>
              <div
                className="absolute inset-0 rounded-[2rem] scale-[1.03] -z-10 bg-gradient-to-br from-indigo-100/50 via-white to-sky-100/40"
                aria-hidden="true"
              />
              <ProductMockupFrame title="Class 3B · Monday">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-base font-bold text-slate-900">
                      22 learners · 18 active today
                    </h3>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      2 to check in
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {Array.from({ length: 18 }).map((_, i) => {
                      const flagged = i === 4 || i === 11;
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
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                      On track
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden="true" />
                      Needs a check-in
                    </span>
                  </div>
                </div>
              </ProductMockupFrame>
            </>
          }
        />

        <ComplianceBar note="Designed for FERPA-aware data handling. Teachers see what they need to teach — never raw IEP text or clinical labels." />

        <div className="max-w-6xl mx-auto px-6 md:px-8 py-16 md:py-20">
          {/* Skill gap view */}
          <MockupShowcase
            eyebrow="Skill gaps"
            heading="See the gap, not just the grade"
            body="When a learner stalls, AIVO surfaces the specific skill that's blocking progress — and a tutor-led plan to address it."
            bullets={[
              "Skill-by-skill view per learner",
              "Linked LessonRuns ready to assign",
              "Plain-language explanations for IEP and RTI meetings",
            ]}
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
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                  >
                    <span className="font-semibold text-slate-900">{r.l}</span>
                    <span className="text-slate-500">{r.s}</span>
                  </div>
                ))}
              </div>
            }
          />

          {/* Assignment creation */}
          <MockupShowcase
            eyebrow="Assignments"
            heading="One assignment, every level"
            body="Assign once; AIVO delivers each learner's version at their functioning level with the right scaffolds, sensory profile, and accommodations."
            bullets={[
              "Differentiated automatically — you do not maintain 5 versions",
              "Schedule for today, tomorrow, or a week of LessonRuns",
              "Co-teacher visibility built in",
            ]}
            reverse
            mockupTitle="New assignment"
            mockup={
              <div className="space-y-2.5">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">Title</p>
                  <p className="font-heading text-sm font-bold text-slate-900">
                    {t("assignment_title")}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">{t("roster_label")}</p>
                  <p className="text-sm text-slate-700">{t("roster_value")}</p>
                </div>
                <div className="rounded-lg bg-purple-600 py-2 text-center text-sm font-semibold text-white">
                  {t("assign_cta")}
                </div>
              </div>
            }
          />

          {/* Recent LessonRuns */}
          <MockupShowcase
            eyebrow="Recent LessonRuns"
            heading="The receipts, in human language"
            body="A timeline of what each learner worked on, where they got stuck, where they breezed through, and what AIVO did next."
            bullets={[
              "Per-learner LessonRun history",
              "Read-aloud / hint / break events surfaced",
              "Plain-language history for IEP and RTI conversations",
            ]}
            mockupTitle="Maya · Last 7 days"
            mockup={
              <div className="space-y-2">
                {[
                  { d: "Mon", x: "Multiplying by 3s · finished" },
                  { d: "Tue", x: "Reading · used read-aloud 8 min" },
                  { d: "Wed", x: "Math · break mode, returned" },
                  { d: "Thu", x: "Today's Mission · skipped" },
                ].map((r) => (
                  <div
                    key={r.d + r.x}
                    className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                  >
                    <span className="font-heading font-bold text-slate-900 w-8">{r.d}</span>
                    <span className="text-slate-700">{r.x}</span>
                  </div>
                ))}
              </div>
            }
          />

          {/* Instructional support summaries */}
          <CalloutCard
            eyebrow="Instructional summaries"
            title={t("callout_summaries_title")}
            body="AIVO writes per-learner instructional summaries in the tone of a thoughtful teacher — strengths first, growth areas named in non-clinical language, and next steps you can act on."
            tone="blue"
          />

          {/* Privacy-aware accommodation view */}
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
                <p className="mt-3 text-sm text-slate-600">
                  Full IEP documents stay where they belong: in your district's special-services
                  system, with the access controls already in place.
                </p>
              </>
            }
            ctaLabel="See the special-education page"
            ctaHref="/for-special-education"
            tone="purple"
          />
        </div>

        <ClosingCTA
          title="Spend less time prepping. More time teaching."
          body="See where every learner stands, intervene where it counts, and let AIVO handle the differentiation in the background."
          primary={{ label: "Request a teacher demo", href: "/demo" }}
          secondary={{ label: "See the school page", href: "/for-schools" }}
          imageSrc="/images/hero/girl-laptop.png"
          imageAlt="A learner working on a laptop"
        />
      </main>

      <Footer />
    </div>
  );
}
