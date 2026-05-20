/**
 * Sprint 12: School admin home redesign.
 *
 * Calm operational dashboard for school admins. Sprint 12 spec
 * requires: enterprise clarity without losing premium softness;
 * role-aware data visibility; dense tables only when unavoidable.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  FloatingMetricCard,
  GlassCard,
  InsightChip,
} from "@aivo/ui";
import { Building2, Users, FileText, Shield, Settings } from "lucide-react";

const SCHOOL_NAV = [
  { href: "/admin/school", label: "Overview", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/school/staff", label: "Staff", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/school/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/school/compliance", label: "Compliance", icon: <Shield className="h-4 w-4" /> },
  { href: "/admin/school/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export default async function SchoolAdminHome() {
  const session = await requirePageRole(["school_admin"]);
  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">School admin</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          Westbrook Elementary
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          Adoption, compliance, and operational health at a glance. Drill into a card to manage
          staff, classes, or consent.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FloatingMetricCard label="Active learners" value="411" description="98% engaged this week" tone="success" />
        <FloatingMetricCard label="Staff" value="42" description="3 pending invites" tone="info" />
        <FloatingMetricCard label="Classes" value="18" description="K–5" tone="neutral" />
        <FloatingMetricCard label="Consent complete" value="98%" description="2 reminders sent" tone="success" />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <GlassCard
          elevation="raised"
          density="comfortable"
          title="Rostering health"
          description="Last sync · 12 minutes ago"
          actions={<InsightChip tone="success" size="md">Healthy</InsightChip>}
        >
          <ul className="text-sm space-y-1.5 text-iw-text-muted">
            <li className="flex items-center justify-between">
              <span>Source</span>
              <span className="text-iw-text-strong font-semibold">Clever</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Last error</span>
              <span className="text-iw-text-strong">None in 30d</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Next sync</span>
              <span className="text-iw-text-strong">in 18 min</span>
            </li>
          </ul>
          <Link
            href="/admin/school/staff"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline mt-2"
          >
            Manage rostering →
          </Link>
        </GlassCard>

        <GlassCard
          elevation="raised"
          density="comfortable"
          title="Consent & compliance"
          description="COPPA / FERPA / IEP"
          actions={<InsightChip tone="warning" size="md">2 pending</InsightChip>}
        >
          <ul className="text-sm space-y-1.5 text-iw-text-muted">
            <li className="flex items-center justify-between">
              <span>Consent complete</span>
              <span className="text-iw-text-strong font-semibold tabular-nums">98%</span>
            </li>
            <li className="flex items-center justify-between">
              <span>IEPs on file</span>
              <span className="text-iw-text-strong font-semibold tabular-nums">34</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Audit events (30d)</span>
              <span className="text-iw-text-strong font-semibold tabular-nums">1,204</span>
            </li>
          </ul>
          <Link
            href="/admin/school/compliance"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline mt-2"
          >
            Open compliance →
          </Link>
        </GlassCard>

        <GlassCard
          elevation="raised"
          density="comfortable"
          title="AI safety"
          description="Tutor & lesson filters"
          actions={<InsightChip tone="success" size="md">All clear</InsightChip>}
        >
          <ul className="text-sm space-y-1.5 text-iw-text-muted">
            <li className="flex items-center justify-between">
              <span>Active filters</span>
              <span className="text-iw-text-strong font-semibold">6</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Flagged (7d)</span>
              <span className="text-iw-text-strong font-semibold tabular-nums">0</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Reviewer queue</span>
              <span className="text-iw-text-strong font-semibold">Empty</span>
            </li>
          </ul>
          <Link
            href="/admin/school/compliance"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline mt-2"
          >
            Review safety logs →
          </Link>
        </GlassCard>

        <GlassCard
          elevation="raised"
          density="comfortable"
          title="License utilization"
          description="Family + school plans"
          actions={<InsightChip tone="info" size="md">82% used</InsightChip>}
        >
          <div className="relative h-2 rounded-full bg-[var(--aivo-color-surface-sunken)] overflow-hidden" role="img" aria-label="License utilization 82 percent">
            <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--aivo-sensory-primary)]" style={{ width: "82%" }} />
          </div>
          <p className="text-xs text-iw-text-muted">411 / 500 seats used</p>
          <Link
            href="/admin/school/reports"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline mt-2"
          >
            Open reports →
          </Link>
        </GlassCard>

        <GlassCard
          elevation="raised"
          density="comfortable"
          title="Support tickets"
          description="Last 7 days"
          actions={<InsightChip tone="neutral" size="md">3 open</InsightChip>}
        >
          <ul className="text-sm space-y-1.5 text-iw-text-muted">
            <li className="flex items-center justify-between">
              <span>SSO config</span>
              <InsightChip tone="warning" size="sm">In review</InsightChip>
            </li>
            <li className="flex items-center justify-between">
              <span>Roster mapping</span>
              <InsightChip tone="info" size="sm">Triaged</InsightChip>
            </li>
            <li className="flex items-center justify-between">
              <span>Bulk consent reset</span>
              <InsightChip tone="neutral" size="sm">Waiting</InsightChip>
            </li>
          </ul>
        </GlassCard>

        <GlassCard
          elevation="raised"
          density="comfortable"
          title="Curriculum coverage"
          description="District-approved standards"
          actions={<InsightChip tone="success" size="md">94%</InsightChip>}
        >
          <p className="text-sm text-iw-text-muted leading-relaxed">
            Curriculum aligned across math, reading, and science. Social studies and writing
            partial — review in the curriculum surface.
          </p>
          <Link
            href="/admin/school/reports"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline mt-2"
          >
            View curriculum →
          </Link>
        </GlassCard>
      </section>
    </AppShell>
  );
}
