/**
 * Sprint 12 → Sprint 7: school admin overview. Previously rendered
 * hardcoded values (learner count "411", consent "98%", "Last sync 12
 * minutes ago"); now fetches a live snapshot from the BFF and falls
 * back to a calm empty-state when no data is available.
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
import { getSchoolDashboard, type SchoolDashboardSnapshot } from "@/lib/db/repos";

const SCHOOL_NAV = [
  { href: "/admin/school", label: "Overview", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/school/staff", label: "Staff", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/school/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/school/compliance", label: "Compliance", icon: <Shield className="h-4 w-4" /> },
  { href: "/admin/school/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "Just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export default async function SchoolAdminHome() {
  const session = await requirePageRole(["school_admin"]);
  const tenantId = (session as { tenantId?: string }).tenantId ?? "";

  // Server-side fetch — no client round-trip. If no tenant is in scope
  // we still render the shell with an empty-state banner.
  let snap: SchoolDashboardSnapshot | null = null;
  if (tenantId) {
    snap = await getSchoolDashboard(tenantId);
  }

  const schoolName = snap?.school?.name ?? "Your school";
  const learners = snap?.counts.learners ?? 0;
  const staff = snap?.counts.staff ?? 0;
  const classes = snap?.counts.classes ?? 0;
  const consentPct = snap?.counts.consentCompletePct ?? 0;
  const ieps = snap?.counts.iepsOnFile ?? 0;
  const audit30 = snap?.counts.auditEvents30d ?? 0;
  const flagged7 = snap?.counts.moderationFlagged7d ?? 0;
  const lic = snap?.licenses ?? { used: 0, total: 0, utilizationPct: 0 };
  const ros = snap?.rostering ?? {
    source: "manual",
    lastSyncIso: null,
    lastErrorIso: null,
    status: "unknown" as const,
  };

  const consentTone: "success" | "warning" | "neutral" =
    consentPct >= 95 ? "success" : consentPct >= 80 ? "warning" : "neutral";
  const safetyTone: "success" | "warning" | "neutral" =
    flagged7 === 0 ? "success" : flagged7 < 5 ? "warning" : "neutral";
  const rosteringTone: "success" | "warning" | "neutral" | "error" =
    ros.status === "healthy"
      ? "success"
      : ros.status === "warning"
        ? "warning"
        : ros.status === "error"
          ? "error"
          : "neutral";

  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">School admin</p>
        <h1
          className="text-2xl md:text-3xl font-semibold text-iw-text-strong"
          data-testid="school-name"
        >
          {schoolName}
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          Adoption, compliance, and operational health at a glance. Drill into a card to manage
          staff, classes, or consent.
        </p>
      </header>

      <section
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        data-testid="school-kpis"
      >
        <FloatingMetricCard
          label="Active learners"
          value={String(learners)}
          description={`${consentPct}% consent on file`}
          tone={consentTone}
        />
        <FloatingMetricCard
          label="Staff"
          value={String(staff)}
          description={ros.status === "healthy" ? "Rostering healthy" : "Verify staff list"}
          tone="info"
        />
        <FloatingMetricCard
          label="Classes"
          value={String(classes)}
          description={classes === 0 ? "None yet" : "Active"}
          tone="neutral"
        />
        <FloatingMetricCard
          label="Consent complete"
          value={`${consentPct}%`}
          description={consentPct >= 95 ? "On track" : "Send reminders"}
          tone={consentTone}
        />
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <GlassCard
          elevation="raised"
          density="comfortable"
          title="Rostering health"
          description={`Last sync · ${relativeTime(ros.lastSyncIso)}`}
          actions={
            <InsightChip tone={rosteringTone === "error" ? "warning" : rosteringTone} size="md">
              {ros.status === "healthy"
                ? "Healthy"
                : ros.status === "warning"
                  ? "Watch"
                  : ros.status === "error"
                    ? "Error"
                    : "Not configured"}
            </InsightChip>
          }
        >
          <ul className="text-sm space-y-1.5 text-iw-text-muted">
            <li className="flex items-center justify-between">
              <span>Source</span>
              <span className="text-iw-text-strong font-semibold">{ros.source}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Last sync</span>
              <span className="text-iw-text-strong">{relativeTime(ros.lastSyncIso)}</span>
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
          actions={
            <InsightChip tone={consentTone} size="md">
              {consentPct}%
            </InsightChip>
          }
        >
          <ul className="text-sm space-y-1.5 text-iw-text-muted">
            <li className="flex items-center justify-between">
              <span>Consent complete</span>
              <span className="text-iw-text-strong font-semibold tabular-nums">{consentPct}%</span>
            </li>
            <li className="flex items-center justify-between">
              <span>IEPs on file</span>
              <span className="text-iw-text-strong font-semibold tabular-nums">{ieps}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Audit events (30d)</span>
              <span className="text-iw-text-strong font-semibold tabular-nums">{audit30}</span>
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
          actions={
            <InsightChip tone={safetyTone} size="md">
              {flagged7 === 0 ? "All clear" : `${flagged7} flagged`}
            </InsightChip>
          }
        >
          <ul className="text-sm space-y-1.5 text-iw-text-muted">
            <li className="flex items-center justify-between">
              <span>Flagged (7d)</span>
              <span className="text-iw-text-strong font-semibold tabular-nums">{flagged7}</span>
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
          actions={
            <InsightChip tone={lic.utilizationPct > 90 ? "warning" : "info"} size="md">
              {lic.utilizationPct}% used
            </InsightChip>
          }
        >
          <div
            className="relative h-2 rounded-full bg-[var(--aivo-color-surface-sunken)] overflow-hidden"
            role="img"
            aria-label={`License utilization ${lic.utilizationPct} percent`}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--aivo-sensory-primary)]"
              style={{ width: `${lic.utilizationPct}%` }}
            />
          </div>
          <p className="text-xs text-iw-text-muted">
            {lic.used} / {lic.total} seats used
          </p>
          <Link
            href="/admin/school/reports"
            className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline mt-2"
          >
            Open reports →
          </Link>
        </GlassCard>
      </section>

      {!snap && (
        <p
          className="mt-6 text-sm text-iw-text-muted"
          data-testid="school-empty-state"
        >
          No school is associated with this session yet. Ask your district admin to
          provision a school record.
        </p>
      )}
    </AppShell>
  );
}
