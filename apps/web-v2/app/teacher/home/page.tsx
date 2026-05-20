/**
 * Sprint 11: Teacher home redesign — calm soft-card workflow.
 *
 * Sprint 11 spec: teacher can act within two clicks from the
 * dashboard. The hero focuses attention on "who needs help today",
 * "AI lesson drafts awaiting review", "parent messages", and
 * "IEP accommodations active today" — each one a card that links
 * deep into the actionable surface.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  LearningHero,
  FloatingMetricCard,
  GlassCard,
  InsightChip,
  EmptyState,
} from "@aivo/ui";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { Home, Users, ClipboardList, BarChart3, Settings } from "lucide-react";

const TEACHER_NAV = [
  { href: "/teacher/home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { href: "/teacher/classes", label: "Classes", icon: <Users className="h-4 w-4" /> },
  {
    href: "/teacher/assignments",
    label: "Assignments",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  { href: "/teacher/insights", label: "Insights", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/teacher/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

const INSIGHTS = [
  {
    href: "/teacher/insights?filter=needs_support",
    label: "Needs support",
    body: "Learners who've stalled this week",
    count: 4,
    tone: "warning" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    href: "/teacher/lesson-plans",
    label: "AI lesson drafts",
    body: "Awaiting your review before publish",
    count: 3,
    tone: "primary" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    href: "/teacher/assignments",
    label: "Assignments due",
    body: "Coming up this week",
    count: 7,
    tone: "info" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/teacher/insights?filter=iep",
    label: "IEP supports active",
    body: "Accommodations in lessons today",
    count: 6,
    tone: "accent" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

const TONE_TINT: Record<(typeof INSIGHTS)[number]["tone"], string> = {
  warning:
    "bg-iw-warm-soft text-[var(--aivo-status-warning)] border-[var(--aivo-status-warning)]",
  primary:
    "bg-[var(--aivo-aivoPurple-50)] text-[var(--aivo-aivoPurple-700)] border-[var(--aivo-aivoPurple-100)]",
  info: "bg-iw-accent-soft text-[var(--aivo-status-info)] border-[var(--aivo-status-info)]",
  accent:
    "bg-[var(--aivo-aivoTeal-50)] text-[var(--aivo-aivoTeal-700)] border-[var(--aivo-aivoTeal-100)]",
};

// Greeting first-name: skips honorifics (Ms./Mr./Mrs./Mx./Dr./Prof.)
// so "Ms. Vega" becomes "Vega" instead of "Ms.".
function greetingName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  const HONORIFICS = new Set(["Ms.", "Ms", "Mr.", "Mr", "Mrs.", "Mrs", "Mx.", "Mx", "Dr.", "Dr", "Prof.", "Prof"]);
  for (const p of parts) {
    if (!HONORIFICS.has(p)) return p;
  }
  return parts[0] ?? displayName;
}

export default async function TeacherHome() {
  const session = await requirePageRole(["teacher"]);
  const first = greetingName(session.displayName);
  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <LearningHero
        greeting={`Good morning, ${first}.`}
        subhead="4 learners need a nudge today, and 3 AI lesson drafts are waiting on you. Let's start with the ones that need you most."
        actions={
          <Link
            href="/teacher/insights?filter=needs_support"
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
          >
            Open the needs-support list
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          </Link>
        }
      />

      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <FloatingMetricCard label="Active learners" value="22" description="Across 1 class" tone="info" />
        <FloatingMetricCard label="Active IEPs" value="3" description="Supports applied" tone="success" />
        <FloatingMetricCard label="Avg mastery" value="68%" description="Trending up" tone="success" />
        <FloatingMetricCard label="Open flags" value="1" description="Review needed" tone="warning" />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {INSIGHTS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="group relative flex flex-col gap-3 rounded-iw-card-lg bg-white border border-iw-border p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-[var(--aivo-color-surface-canvas)]"
          >
            <header className="flex items-start justify-between gap-2">
              <span
                className={
                  "shrink-0 w-10 h-10 rounded-iw-control inline-flex items-center justify-center border " +
                  TONE_TINT[i.tone]
                }
                aria-hidden="true"
              >
                {i.icon}
              </span>
              <span className="text-3xl font-semibold text-iw-text-strong tabular-nums">
                {i.count}
              </span>
            </header>
            <div>
              <p className="text-sm font-semibold text-iw-text-strong">{i.label}</p>
              <p className="text-xs text-iw-text-muted leading-relaxed">{i.body}</p>
            </div>
            <span className="text-xs font-semibold text-[var(--aivo-sensory-primary)] group-hover:underline">
              Open →
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-iw-text-strong">Your classes</h2>
          <Link
            href="/teacher/classes"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
          >
            See all classes →
          </Link>
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          <GlassCard
            elevation="raised"
            density="comfortable"
            title="3rd Grade · Room 12"
            description="22 learners · 3 IEPs · 2 awaiting baseline"
          >
            <div className="flex items-center justify-between gap-3 mt-2">
              <div className="flex -space-x-2">
                {["Sky", "River", "Mira", "Theo", "Sun"].map((n) => (
                  <LearnerAvatar
                    key={n}
                    name={n}
                    size="sm"
                    className="ring-2 ring-white"
                  />
                ))}
                <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-iw-chip text-[10px] font-semibold bg-[var(--aivo-color-surface-sunken)] text-iw-text-strong">
                  +17
                </span>
              </div>
              <Link
                href="/teacher/classes"
                className="inline-flex items-center gap-1 rounded-iw-control px-3 py-1.5 text-xs font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
              >
                Open
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <InsightChip tone="primary" size="sm">2 baseline pending</InsightChip>
              <InsightChip tone="accent" size="sm">3 IEPs active</InsightChip>
              <InsightChip tone="warning" size="sm">1 flag to review</InsightChip>
            </div>
          </GlassCard>

          <div className="rounded-iw-card-lg border-2 border-dashed border-iw-border bg-white p-5 flex items-center justify-center">
            <EmptyState
              title="Add another class"
              body="Roster sync from Google Classroom, Clever, or ClassLink lands here."
              action={
                <Button type="button" variant="outline" size="sm" disabled>
                  Connect roster
                </Button>
              }
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
