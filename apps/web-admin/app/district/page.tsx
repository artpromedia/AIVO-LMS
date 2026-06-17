import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  FlaskConical,
  GraduationCap,
  Info,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { completeDistrictSetup, getDistrictSetupOverview } from "@aivo/admin-api/identity";
import { getDistrictOverview } from "@aivo/admin-api/district";
import type { DistrictActivityRow, DistrictPilotRow } from "@aivo/admin-api/district";
import {
  AdminCard,
  AdminPageFrame,
  ChartCard,
  DonutBreakdown,
  MultiLineTrend,
} from "@aivo/admin-ui";
import type { DonutSlice, MultiLineSeries } from "@aivo/admin-ui";
import { ADMIN_CHART_PALETTE } from "@aivo/brand";
import { StatusPill } from "@/components/status-pill";

async function completeSetup() {
  "use server";
  const session = await requirePageRole(["district_admin"]);
  try {
    await completeDistrictSetup(session);
  } catch (error) {
    const message = error instanceof AdminApiError ? error.message : "Unable to complete setup.";
    redirect(`/district?error=${encodeURIComponent(message)}`);
  }
  redirect("/district?notice=District%20setup%20completed.");
}

const INTEGER = new Intl.NumberFormat("en-US");
const TREND_DONUT_TONES = ["primary", "positive", "warning", "danger", "neutral"] as const;

const ACTIVITY_ICON: Record<string, typeof Activity> = {
  sync: Sparkles,
  user: UserPlus,
  report: FileText,
  shield: ShieldCheck,
  school: GraduationCap,
  default: Activity,
};

const PILOT_ICON = [FlaskConical, Rocket, GraduationCap];

function formatActivityTime(iso: string, now: number): string {
  const then = new Date(iso);
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  const dayStart = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const diffDays = Math.round((dayStart(now) - dayStart(then.getTime())) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return `Today, ${timeFmt.format(then)}`;
  if (diffDays === 1) return `Yesterday, ${timeFmt.format(then)}`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(then);
}

function pilotStatusLabel(status: DistrictPilotRow["status"]): string {
  if (status === "starting_soon") return "Starting soon";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** A single KPI tile: pastel icon, label, big tabular value, delta/sublabel, footer link. */
function KpiTile({
  label,
  value,
  suffix,
  icon: Icon,
  tone,
  delta,
  deltaCaption,
  subLabel,
  subTone,
  href,
  hrefLabel,
  testId,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: typeof Activity;
  tone: string;
  delta?: number;
  deltaCaption?: string;
  subLabel?: string;
  subTone?: "positive";
  href: string;
  hrefLabel: string;
  testId?: string;
}) {
  const hasDelta = typeof delta === "number" && delta !== 0;
  const up = (delta ?? 0) > 0;
  return (
    <AdminCard className="flex flex-col p-5" testId={testId}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `color-mix(in srgb, ${tone} 14%, white)`, color: tone }}
          aria-hidden="true"
        >
          <Icon size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="admin-tabular mt-0.5 text-3xl font-bold leading-tight text-slate-900">
            {INTEGER.format(value)}
            {suffix ?? ""}
          </p>
        </div>
      </div>
      <div className="mt-3 min-h-[20px] text-sm">
        {subLabel ? (
          <span className={subTone === "positive" ? "font-semibold text-emerald-700" : "text-slate-500"}>
            {subLabel}
          </span>
        ) : hasDelta ? (
          <span className={up ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
            <span aria-hidden="true">{up ? "▲" : "▼"} </span>
            <span className="sr-only">{up ? "Up " : "Down "}</span>
            {up ? "+" : ""}
            {INTEGER.format(delta ?? 0)}
            {suffix ?? ""} {deltaCaption}
          </span>
        ) : (
          <span className="text-slate-400">{deltaCaption ?? "No change vs prior 30 days"}</span>
        )}
      </div>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-accent,#7C3AED)] hover:underline"
        style={{ color: "#7C3AED" }}
      >
        {hrefLabel}
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </AdminCard>
  );
}

function SetupStep({
  index,
  done,
  title,
  description,
  detail,
  action,
}: {
  index: number;
  done: boolean;
  title: string;
  description: string;
  detail: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}
        aria-hidden="true"
      >
        {done ? <CheckCircle2 size={18} /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
        {detail}
        {action}
      </div>
    </li>
  );
}

function PilotRow({ pilot, icon: Icon }: { pilot: DistrictPilotRow; icon: typeof Activity }) {
  const leadLabel =
    pilot.leadSchool != null
      ? pilot.extraSchools > 0
        ? `${pilot.leadSchool} +${pilot.extraSchools} more`
        : pilot.leadSchool
      : pilot.extraSchools > 0
        ? `${pilot.extraSchools} schools`
        : "District-wide";
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
        aria-hidden="true"
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{pilot.name}</p>
        <p className="truncate text-sm text-slate-500">{leadLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusPill
          status={pilot.status}
          tone={pilot.status === "active" ? "positive" : pilot.status === "completed" ? "positive" : "warning"}
          label={pilotStatusLabel(pilot.status)}
        />
        <span className="admin-tabular hidden w-24 text-right text-sm text-slate-500 sm:inline">
          {INTEGER.format(pilot.learners)} learners
        </span>
        <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />
      </div>
    </li>
  );
}

function ActivityRow({ row, now }: { row: DistrictActivityRow; now: number }) {
  const Icon = ACTIVITY_ICON[row.icon] ?? ACTIVITY_ICON.default;
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
        aria-hidden="true"
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{row.title}</p>
        {row.subtitle ? <p className="truncate text-sm text-slate-500">{row.subtitle}</p> : null}
      </div>
      <span className="admin-tabular shrink-0 text-xs text-slate-400">
        {formatActivityTime(row.createdAt, now)}
      </span>
    </li>
  );
}

export default async function DistrictPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["district_admin"]);
  const params = await searchParams;
  const now = Date.now();

  // Live aggregates from the district read model + the identity setup state
  // (step 5 / canComplete). Both key off the session tenant; the overview is
  // the source of every panel, so a failure degrades to the setup-only view.
  const [overview, setup] = await Promise.all([
    getDistrictOverview(session).catch(() => null),
    getDistrictSetupOverview(session).catch(() => null),
  ]);

  const districtName = overview?.districtName ?? setup?.district.name ?? "District";

  if (!overview) {
    return (
      <AdminPageFrame
        eyebrow="District Admin"
        title="District Overview"
        description="Monitor district progress, manage schools, and ensure every learner has what they need to succeed."
      >
        {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}
        <AdminCard className="mt-8 p-6" testId="district-overview-unavailable">
          <h2 className="admin-h2 text-xl">District overview is temporarily unavailable</h2>
          <p className="mt-2 text-slate-600">
            Live district metrics could not be loaded. Refresh in a moment — your data is safe.
          </p>
        </AdminCard>
      </AdminPageFrame>
    );
  }

  const [c0, c1, c2, c3, c4] = ADMIN_CHART_PALETTE.series;

  // 5-step setup checklist (signals from the read model; step 5 from identity).
  const sig = overview.setupSignals;
  const step5Done = Boolean(setup?.setupComplete);
  const steps = [
    {
      done: sig.schoolsCount > 0,
      title: "Create schools",
      description: "Add and configure your district schools.",
      detail: `${INTEGER.format(sig.schoolsCount)} schools`,
    },
    {
      done: sig.adminsCount > 0,
      title: "Invite school admins",
      description: "Invite administrators to your schools.",
      detail: `${INTEGER.format(sig.adminsCount)} admins invited`,
    },
    {
      done: sig.rosteringCount > 0,
      title: "Grant rostering access",
      description: "Connect SIS or import rosters for your schools.",
      detail: `${INTEGER.format(sig.rosteringCount)} SIS connected`,
    },
    {
      done: sig.brandingDone,
      title: "Configure branding",
      description: "Customize district branding for portals and emails.",
      detail: sig.brandingDone ? "Completed" : "Not started",
    },
  ];
  const stepsDone = steps.filter((s) => s.done).length + (step5Done ? 1 : 0);
  const totalSteps = steps.length + 1;
  const setupPct = Math.round((stepsDone / totalSteps) * 100);

  // Learner-progress trend → multi-series chart.
  const trendSeries: MultiLineSeries[] = [
    { key: "mastery", label: "Mastery", tone: "primary" },
    { key: "onTrack", label: "On track", tone: "positive" },
    { key: "atRisk", label: "At risk", tone: "warning" },
    { key: "needsSupport", label: "Needs support", tone: "danger" },
  ];
  const trendData = overview.trend.map((p) => ({
    t: new Date(`${p.day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    mastery: p.mastery,
    onTrack: p.onTrack,
    atRisk: p.atRisk,
    needsSupport: p.needsSupport,
  }));
  // Downsample the sr-only table to ~10 evenly spaced points.
  const srStep = Math.max(1, Math.floor(overview.trend.length / 10));
  const trendSrRows = overview.trend
    .filter((_, i) => i % srStep === 0 || i === overview.trend.length - 1)
    .map((p) => ({
      day: p.day,
      "mastery %": p.mastery,
      "on track %": p.onTrack,
      "at risk %": p.atRisk,
      "needs support %": p.needsSupport,
    }));

  // Learners-by-school donut.
  const donutSlices: DonutSlice[] = overview.learnersBySchool.slices.map((s, i) => ({
    label: s.name,
    value: s.learners,
    tone: TREND_DONUT_TONES[i % TREND_DONUT_TONES.length],
  }));

  const pillStyle =
    "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700";

  return (
    <AdminPageFrame
      eyebrow="District Admin"
      title="District Overview"
      description="Monitor district progress, manage schools, and ensure every learner has what they need to succeed."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span className={pillStyle} data-testid="district-selector">
            <Building2 size={16} className="text-slate-400" aria-hidden="true" />
            {districtName}
            <ChevronDown size={16} className="text-slate-400" aria-hidden="true" />
          </span>
          <span className={pillStyle}>
            <Calendar size={16} className="text-slate-400" aria-hidden="true" />
            Last {overview.windowDays} days
          </span>
        </div>
      }
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      {/* Row 1 — five KPIs. */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          testId="district-kpi-schools"
          label="Schools"
          value={overview.schools.total}
          icon={Building2}
          tone={c0}
          delta={overview.schools.delta30d}
          deltaCaption="vs prior 30 days"
          href="#learners-by-school"
          hrefLabel="View all schools"
        />
        <KpiTile
          testId="district-kpi-learners"
          label="Learners"
          value={overview.learners.total}
          icon={UsersRound}
          tone={c1}
          delta={overview.learners.delta30d}
          deltaCaption="vs prior 30 days"
          href="#learner-progress"
          hrefLabel="View learners"
        />
        <KpiTile
          testId="district-kpi-pilots"
          label="Active pilots"
          value={overview.pilots.activeTotal}
          icon={Rocket}
          tone={c2}
          delta={overview.pilots.delta30d}
          deltaCaption="vs prior 30 days"
          href="#pilot-status"
          hrefLabel="View pilots"
        />
        <KpiTile
          testId="district-kpi-setup"
          label="District setup"
          value={setupPct}
          suffix="%"
          icon={SlidersHorizontal}
          tone={c3}
          deltaCaption={`${stepsDone} of ${totalSteps} steps complete`}
          href="#district-setup"
          hrefLabel="Continue setup"
        />
        <KpiTile
          testId="district-kpi-compliance"
          label="Compliance score"
          value={overview.compliance.score}
          suffix="%"
          icon={ShieldCheck}
          tone={c4}
          subLabel={overview.compliance.band}
          subTone="positive"
          href="/district/compliance"
          hrefLabel="View compliance"
        />
      </section>

      {/* Row 2 — setup (tall, left) + learner progress / pilots (mid) + learners-by-school / activity (right). */}
      <section className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* District setup progress — spans both rows on the left. */}
        <AdminCard
          className="p-6 lg:col-span-4 lg:row-span-2"
          testId="district-setup"
        >
          <div id="district-setup" className="flex items-start justify-between gap-3">
            <div>
              <h2 className="admin-h2 text-lg">District setup progress</h2>
              <p className="mt-1 text-sm text-slate-500">
                Complete these steps to unlock all district features.
              </p>
            </div>
            <span className="admin-tabular shrink-0 text-sm font-semibold text-slate-500">
              {stepsDone} of {totalSteps} completed
            </span>
          </div>
          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full"
            style={{ background: "var(--admin-chart-grid, #e2e8f0)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            aria-valuenow={stepsDone}
            aria-label="District setup progress"
          >
            <div className="h-2 rounded-full" style={{ width: `${setupPct}%`, background: "#7C3AED" }} />
          </div>

          <ul className="mt-4 divide-y divide-slate-100">
            {steps.map((step, i) => (
              <SetupStep
                key={step.title}
                index={i + 1}
                done={step.done}
                title={step.title}
                description={step.description}
                detail={
                  <>
                    <span className="hidden sm:inline">{step.detail}</span>
                    <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />
                  </>
                }
              />
            ))}
            <SetupStep
              index={5}
              done={step5Done}
              title="Complete district setup"
              description="Review and finalize your district configuration."
              detail={null}
              action={
                step5Done ? (
                  <span className="text-sm font-semibold text-emerald-700">Completed</span>
                ) : (
                  <form action={completeSetup}>
                    <button
                      type="submit"
                      disabled={!setup?.canComplete}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: "#7C3AED" }}
                    >
                      Complete setup
                    </button>
                  </form>
                )
              }
            />
          </ul>
        </AdminCard>

        {/* Learner progress — multi-series trend. */}
        <div id="learner-progress" className="lg:col-span-5">
          <ChartCard
            testId="district-learner-progress"
            title="Learner progress (all schools)"
            aspect={16 / 9}
            legend={<span className={pillStyle}>Last {overview.windowDays} days<ChevronDown size={16} className="text-slate-400" aria-hidden="true" /></span>}
            srRows={trendSrRows}
          >
            <MultiLineTrend
              data={trendData}
              series={trendSeries}
              title="District learner progress over the last 90 days"
              description="Mastery, on-track, at-risk, and needs-support percentages by day"
            />
          </ChartCard>
        </div>

        {/* Learners by school — donut. */}
        <div id="learners-by-school" className="lg:col-span-3">
          <ChartCard
            testId="district-learners-by-school"
            title="Learners by school"
            subtitle={`${INTEGER.format(sig.schoolsCount)} schools · ${INTEGER.format(overview.learnersBySchool.total)} learners`}
            aspect={4 / 3}
            legend={
              <Link href="/district/reports" className="text-sm font-semibold" style={{ color: "#7C3AED" }}>
                View all
              </Link>
            }
            srRows={overview.learnersBySchool.slices.map((s) => ({
              school: s.name,
              learners: s.learners,
            }))}
          >
            <DonutBreakdown
              data={donutSlices}
              title="Learners by school"
              description="District learners grouped by school (top five plus the rest)"
              totalLabel="Total learners"
              detailedLegend
            />
          </ChartCard>
        </div>

        {/* Pilot status. */}
        <AdminCard className="p-6 lg:col-span-5" testId="district-pilot-status">
          <div id="pilot-status" className="flex items-center justify-between gap-3">
            <h2 className="admin-h2 text-lg">Pilot status</h2>
            <Link href="/district/reports" className="text-sm font-semibold" style={{ color: "#7C3AED" }}>
              View all pilots
            </Link>
          </div>
          {overview.pilots.list.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {overview.pilots.list.map((pilot, i) => (
                <PilotRow key={pilot.id} pilot={pilot} icon={PILOT_ICON[i % PILOT_ICON.length]} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No active pilots yet.</p>
          )}
        </AdminCard>

        {/* Recent activity. */}
        <AdminCard className="p-6 lg:col-span-3" testId="district-recent-activity">
          <div className="flex items-center justify-between gap-3">
            <h2 className="admin-h2 text-lg">Recent activity</h2>
            <Link href="/district/audit" className="text-sm font-semibold" style={{ color: "#7C3AED" }}>
              View all
            </Link>
          </div>
          {overview.recentActivity.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {overview.recentActivity.map((row) => (
                <ActivityRow key={row.id} row={row} now={now} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No recent activity.</p>
          )}
        </AdminCard>
      </section>

      {/* Rostering banner. */}
      {overview.schoolsNotRostered > 0 ? (
        <div
          className="mt-6 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4"
          data-testid="district-rostering-banner"
        >
          <Info size={20} className="shrink-0 text-blue-600" aria-hidden="true" />
          <p className="flex-1 text-sm text-slate-700">
            <span className="font-semibold">Action required:</span> {overview.schoolsNotRostered}{" "}
            {overview.schoolsNotRostered === 1 ? "school has" : "schools have"} not yet connected
            rostering.
          </p>
          <Link href="/district/sis" className="text-sm font-semibold" style={{ color: "#7C3AED" }}>
            Review and connect
          </Link>
          <X size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
        </div>
      ) : null}
    </AdminPageFrame>
  );
}
