"use client";
/**
 * /design-system — non-destructive showcase of every AIVO primitive.
 *
 * Lives outside the parent/learner/teacher/admin route trees so we can
 * iterate on the visual system without breaking dashboards. Once we are
 * happy with this page we migrate each role's home in a follow-up.
 *
 * Client component because several primitives (InsightChip, MetricCard,
 * EmptyState) accept an `icon` render-function prop, and Next 15 RSC
 * strict serialization rejects passing functions across the server/
 * client boundary. The showcase has no server data needs, so going
 * client-side is harmless.
 */
import Link from "next/link";
import {
  GlassCard,
  MetricCard,
  HeroPanel,
  InsightChip,
  EmptyState,
  Skeleton,
  SoftLine,
  DotChart,
  MasteryHeatStrip,
  ProgressCurve,
  RiskIndicator,
  ClassOverviewCard,
  AivoIcon,
  type MasteryCell,
} from "@aivo/ui";

// Note: `export const metadata` is only valid on server components.
// Title for this showcase is set in the parent route's layout (if any)
// or falls through to the app-wide default. Keep this client-only.

const trend = [
  { label: "W1", value: 42 },
  { label: "W2", value: 48 },
  { label: "W3", value: 55 },
  { label: "W4", value: 53 },
  { label: "W5", value: 61 },
  { label: "W6", value: 67 },
  { label: "W7", value: 72 },
];

const dots = [
  { label: "M", value: 3 },
  { label: "T", value: 5 },
  { label: "W", value: 4 },
  { label: "Th", value: 6 },
  { label: "F", value: 7 },
];

const mastery: MasteryCell[] = [
  { code: "RL.3.1", level: "mastered" },
  { code: "RL.3.2", level: "proficient" },
  { code: "RL.3.3", level: "proficient" },
  { code: "RL.3.4", level: "developing" },
  { code: "RL.3.5", level: "developing" },
  { code: "RL.3.6", level: "emerging" },
  { code: "RL.3.7", level: "emerging" },
  { code: "RL.3.8", level: "developing" },
  { code: "RL.3.9", level: "proficient" },
  { code: "RL.3.10", level: "mastered" },
];

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)] iw-safe-top">
      <div className="max-w-iw-container-desktop mx-auto px-6 lg:px-8 py-12 flex flex-col gap-12">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="iw-label text-iw-text-muted">Design system showcase</p>
            <h1 className="text-3xl md:text-4xl font-semibold text-iw-text-strong">
              AIVO calm — primitives
            </h1>
            <p className="text-iw-text-muted max-w-2xl">
              Every panel, chart, and chip below resolves through{" "}
              <code className="px-1.5 py-0.5 rounded-iw-control bg-iw-card border border-iw-border text-xs">
                @aivo/brand
              </code>{" "}
              tokens. Use this page as a quick visual diff while iterating on the shared system.
            </p>
          </div>

          {/* Showcase index — one tile per @aivo/ui module. Each route renders
              the primitives in that module with synthetic props so we can
              eyeball changes without seeding production data. */}
          <nav aria-label="Design system sections" className="flex flex-wrap gap-2 pt-2">
            {[
              { href: "/design-system", label: "Overview" },
              { href: "/design-system/learner-dashboard", label: "Learner dashboard" },
              { href: "/design-system/learner-home", label: "Learner home (legacy)" },
              { href: "/design-system/tutor", label: "Tutor" },
              { href: "/design-system/assessment", label: "Assessment" },
              { href: "/design-system/baseline", label: "Baseline" },
              { href: "/design-system/states", label: "States" },
              { href: "/design-system/shell", label: "Shell" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-white border border-iw-border text-iw-text-strong hover:border-[var(--color-aivo-primary)]/40 hover:bg-iw-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aivo-primary)] focus-visible:ring-offset-2"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        {/* Hero */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-iw-text-strong">Hero</h2>
          <HeroPanel
            tone="primary"
            eyebrow={
              <span className="inline-flex items-center gap-1.5">
                <AivoIcon name="aiSparkle" tone="brand" className="w-3.5 h-3.5" />
                AI-tutor live
              </span>
            }
            title="Welcome back, Sky"
            subtitle="Your reading mastery jumped from 53% to 67% this week. Two lessons left to hit your weekly goal."
            primaryAction={
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-iw-chip bg-[var(--aivo-sensory-primary)] text-white text-sm font-semibold shadow-md">
                <AivoIcon name="curriculum" className="w-4 h-4 text-white" />
                Continue lesson
              </button>
            }
            secondaryAction={
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-iw-chip border border-iw-border bg-white text-iw-text-strong text-sm font-semibold">
                Talk with tutor
              </button>
            }
            chips={
              <>
                <InsightChip
                  tone="success"
                  icon={({ className, "aria-hidden": ah }) => (
                    <AivoIcon name="growth" tone="mastery" className={className} aria-hidden={ah} />
                  )}
                >
                  +14% mastery
                </InsightChip>
                <InsightChip tone="info">3 streaks</InsightChip>
                <InsightChip tone="warm">Spelling practice ready</InsightChip>
              </>
            }
          />
        </section>

        {/* Metrics */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-iw-text-strong">Metric cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Lessons this week" value="14" suffix="/ 20" delta={12} />
            <MetricCard label="Reading mastery" value="67%" delta={14} caption="vs. last week" />
            <MetricCard
              label="Active risks"
              value="2"
              delta={-1}
              deltaTone="success"
              icon={({ className, "aria-hidden": ah }) => (
                <AivoIcon name="safetyAlert" tone="risk" className={className} aria-hidden={ah} />
              )}
            />
            <MetricCard
              label="Pending consents"
              value="0"
              delta={null}
              caption="All families up to date"
            />
          </div>
        </section>

        {/* Charts */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-iw-text-strong">Charts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard density="base" radius="card-lg" title="Mastery trend" description="7 weeks">
              <SoftLine data={trend} tone="mastery" />
            </GlassCard>
            <GlassCard
              density="base"
              radius="card-lg"
              title="Daily lessons"
              description="This week"
            >
              <DotChart data={dots} tone="brand" />
            </GlassCard>
            <GlassCard
              density="base"
              radius="card-lg"
              title="Weekly goal"
              description="Lessons completed"
            >
              <div className="flex justify-center">
                <ProgressCurve value={0.7} target={0.85} tone="mastery" helper="14 of 20 lessons" />
              </div>
            </GlassCard>
          </div>
          <GlassCard
            density="base"
            radius="card-lg"
            title="Standards mastery"
            description="Grade 3 Reading"
          >
            <MasteryHeatStrip cells={mastery} />
          </GlassCard>
        </section>

        {/* Risk + class composites */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-iw-text-strong">Risk & class overview</h2>
          <div className="flex flex-wrap gap-3">
            <RiskIndicator level="low" label="On track" detail="No flags this week" />
            <RiskIndicator level="watch" label="Watch" detail="Fluency slipping" />
            <RiskIndicator level="elevated" label="Elevated" detail="3 students need support" />
            <RiskIndicator level="high" label="High" detail="Intervention recommended" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ClassOverviewCard
              className="Grade 3 — Reading"
              studentCount={24}
              mastery={mastery}
              risk="watch"
              riskNote="3 students slipping in fluency"
            />
            <ClassOverviewCard
              className="Grade 3 — Math"
              studentCount={24}
              mastery={mastery.map((c) =>
                c.level === "emerging" ? { ...c, level: "developing" as const } : c,
              )}
              risk="low"
              riskNote="No flags"
            />
          </div>
        </section>

        {/* States */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-iw-text-strong">States</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard density="base" radius="card-lg">
              <Skeleton variant="metric" />
            </GlassCard>
            <GlassCard density="base" radius="card-lg">
              <Skeleton variant="chart" />
            </GlassCard>
            <GlassCard density="base" radius="card-lg">
              <EmptyState
                icon={({ className, "aria-hidden": ah }) => (
                  <AivoIcon name="iep" tone="muted" className={className} aria-hidden={ah} />
                )}
                title="No IEP documents yet"
                body="Upload an IEP to unlock accommodations for this learner."
                action={
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-iw-chip bg-[var(--aivo-sensory-primary)] text-white text-sm font-semibold">
                    Upload IEP
                  </button>
                }
              />
            </GlassCard>
          </div>
        </section>

        {/* Icon set */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-iw-text-strong">Icon set</h2>
          <GlassCard density="comfortable" radius="card-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {(
                [
                  "aiBrain",
                  "aiSparkle",
                  "aiWand",
                  "curriculum",
                  "classroom",
                  "library",
                  "mastery",
                  "goal",
                  "growth",
                  "iep",
                  "plan",
                  "care",
                  "safetyOk",
                  "safetyAlert",
                  "safetyFlag",
                  "billingCard",
                  "billingReceipt",
                  "billingWallet",
                  "rosterStudents",
                  "rosterSchool",
                  "rosterDistrict",
                  "consentCheck",
                  "consentDoc",
                  "consentLock",
                ] as const
              ).map((n) => (
                <div
                  key={n}
                  className="flex flex-col items-center gap-2 p-3 rounded-iw-control border border-iw-border bg-white"
                >
                  <AivoIcon name={n} className="w-6 h-6" />
                  <code className="text-xs text-iw-text-muted">{n}</code>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>
      </div>
    </main>
  );
}
