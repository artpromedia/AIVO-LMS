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
  NumberedSteps,
  CalloutCard,
  MockupShowcase,
  TrustStripInline,
} from "@/components/marketing/sections";
import { audienceMetadata } from "@/components/marketing/AudiencePage";
import { AUDIENCES } from "@/lib/landing-content";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";

const audience = AUDIENCES.find((a) => a.slug === "for-schools")!;

export const metadata: Metadata = audienceMetadata(audience);

const CRUMBS: Crumb[] = [
  { name: "Home", href: "/" },
  { name: audience.badge, href: `/${audience.slug}` },
];

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
  const sensoryMode = await getSensoryModeFromCookies();
  const t = await getTranslations("marketing.page_for_schools");
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <StickyHeader initialSensoryMode={sensoryMode} />
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />

      <main>
        <AudienceHero
          badge={audience.badge}
          badgeColor={audience.badgeColor}
          breadcrumbs={CRUMBS}
          headlinePre="Better outcomes,"
          headlineEmph="building-wide."
          subtitle={audience.subtitle}
          primary={{ label: "Request a demo", href: "/demo" }}
          secondary={{ label: "For Districts", href: "/for-districts" }}
          visual={
            <>
              <div
                className="absolute inset-0 rounded-[2rem] scale-[1.03] -z-10 bg-gradient-to-br from-indigo-100/50 via-white to-sky-100/40"
                aria-hidden="true"
              />
              <ProductMockupFrame title="School overview · sample">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { k: "Active learners", v: "312" },
                      { k: "Classrooms", v: "14" },
                      { k: "Today's Missions sent", v: "298" },
                      { k: "Reports ready", v: "14" },
                    ].map((s) => (
                      <div key={s.k} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="font-heading text-2xl font-bold text-slate-900 tabular-nums">
                          {s.v}
                        </p>
                        <p className="text-xs font-medium text-slate-500">{s.k}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {[
                      "Grade 3 · 4 classes · rostered",
                      "Grade 4 · 5 classes · rostered",
                      "Grade 5 · 5 classes · onboarding",
                    ].map((row) => (
                      <div
                        key={row}
                        className="rounded-lg bg-slate-50 p-2 text-xs font-body text-slate-700"
                      >
                        {row}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">Illustrative sample — not live data.</p>
                </div>
              </ProductMockupFrame>
            </>
          }
        />

        <ComplianceBar />

        <div className="max-w-6xl mx-auto px-6 md:px-8 py-16 md:py-20">
          {/* Why personalized learning fails without workflow */}
          <CalloutCard
            eyebrow="The honest version"
            title={t("callout_workflow_title")}
            body={
              <p>
                Schools have been promised &ldquo;personalized learning&rdquo; for a decade. Most
                products deliver another dashboard. AIVO is built around the classroom workflow
                first — visibility, intervention triggers, and plain-language reports — so the
                personalization doesn't cost the teacher their planning period.
              </p>
            }
            tone="slate"
          />

          {/* AIVO school workflow */}
          <NumberedSteps
            heading="The AIVO school workflow"
            subheading="From roster to running classrooms in the same week — without an army of integrations."
            steps={SCHOOL_WORKFLOW}
          />

          {/* Teacher dashboard */}
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

          {/* Roster & class support */}
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

          {/* Progress visibility */}
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
                <p className="text-sm font-semibold text-slate-900">{t("progress_summary")}</p>
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

          {/* Special education support */}
          <CalloutCard
            eyebrow="Special education"
            title={t("callout_neurodiverse_title")}
            body="AIVO can use parent-provided context and optional accommodation information to adapt pacing, scaffolds, read-aloud, and lesson structure — without exposing learners to clinical labels."
            ctaLabel="See the special-education page"
            ctaHref="/for-special-education"
            tone="emerald"
          />

          {/* Privacy / security */}
          <TrustStripInline
            heading="Privacy and security posture"
            subheading="Built around the school day, not the data exhaust. Designed for FERPA-aware data handling and COPPA-aware student workflows."
          />
        </div>

        <ClosingCTA
          title="Bring inclusive, adaptive learning to your whole building."
          body="See the admin dashboards, the teacher workflow, and the privacy posture in a 30-minute walkthrough built around your school."
          primary={{ label: "Request a demo", href: "/demo" }}
          secondary={{ label: "For Districts", href: "/for-districts" }}
          imageSrc="/images/hero/arab-boy-chromebook.webp"
          imageAlt="A learner working on a Chromebook"
        />
      </main>

      <Footer />
    </div>
  );
}
