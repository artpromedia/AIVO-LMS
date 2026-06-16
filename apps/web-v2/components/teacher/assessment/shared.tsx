/**
 * Shared building blocks for the teacher "Classroom insights" assessment flow
 * (intro / in-progress wizard / review). Pure-presentational and free of any
 * server-only imports, so the same module can be rendered from server pages
 * AND the client wizard island.
 *
 * @aivo/brand tokens only — violet primary (`--aivo-sensory-primary` = #7C3AED),
 * teal progress ring (`--aivo-color-aivoTeal-600`), success green
 * (`--aivo-color-status-success`) for the final submit. WCAG: visible focus
 * rings, `tabular-nums` on every count/percent.
 */
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";

/* ----- shared button styles (kept in sync across the three states) --------- */

export const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 active:brightness-95 shadow-[0_2px_8px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.20)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:pointer-events-none";

export const SECONDARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

export const SUCCESS_BTN =
  "inline-flex items-center justify-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-color-status-success)] hover:brightness-110 active:brightness-95 shadow-[0_2px_8px_rgb(from_var(--aivo-color-status-success)_r_g_b_/_0.24)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-color-status-success)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

export const GHOST_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-muted hover:text-iw-text-strong hover:bg-[var(--aivo-color-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)] focus-visible:ring-offset-2";

/* ----- icons (currentColor; className-driven sizing) ------------------------ */

type IconProps = { className?: string };

export function CheckIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function ClockIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ShieldIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function ListIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function EditIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

export function PrinterIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

export function BellIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function LockIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function HeartIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

export function HelpIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function BreadcrumbChevron({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/* ----- grade-band label ----------------------------------------------------- */

export function gradeBandLabel(g: string | null | undefined): string {
  switch (g) {
    case "preK":
      return "Pre-K";
    case "K":
      return "Kindergarten";
    case "1-2":
      return "Grades 1–2";
    case "3-5":
      return "Grades 3–5";
    case "6-8":
      return "Grades 6–8";
    case "9-12":
      return "Grades 9–12";
    case "post_secondary":
      return "Post-secondary";
    default:
      return "Grade not set";
  }
}

/* ----- breadcrumb ----------------------------------------------------------- */

export function AssessmentBreadcrumb({ learnerName }: { learnerName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-iw-text-muted">
        <li>Home</li>
        <li aria-hidden="true">
          <BreadcrumbChevron />
        </li>
        <li>Learners</li>
        <li aria-hidden="true">
          <BreadcrumbChevron />
        </li>
        <li className="text-iw-text-strong font-medium">{learnerName}</li>
        <li aria-hidden="true">
          <BreadcrumbChevron />
        </li>
        <li aria-current="page" className="text-[var(--aivo-sensory-primary)] font-semibold">
          Assessment
        </li>
      </ol>
    </nav>
  );
}

/* ----- learner summary card (intro + review) -------------------------------- */

export function LearnerSummaryCard({
  name,
  metaLine,
  chips = [],
  right,
}: {
  name: string;
  metaLine: string;
  chips?: string[];
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-iw-card border border-iw-border bg-white p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <Avatar name={name} size="xl" ring="soft" />
        <div className="min-w-0">
          <p className="text-lg font-semibold text-iw-text-strong font-iw-display">{name}</p>
          <p className="mt-0.5 text-sm text-iw-text-muted">{metaLine}</p>
          {chips.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center rounded-iw-chip px-2.5 py-0.5 text-xs font-semibold bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-sensory-primary)]"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {right ? <div className="shrink-0 text-right">{right}</div> : null}
    </div>
  );
}

/* ----- circular progress ring (review summary) ------------------------------ */

export function CircularProgress({ percent }: { percent: number }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const offset = circumference * (1 - clamped / 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: 132, height: 132 }}
      role="img"
      aria-label={`${clamped} percent complete`}
    >
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--aivo-color-aivoPurple-50)" strokeWidth="12" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="var(--aivo-color-aivoTeal-600)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-iw-text-strong tabular-nums">{clamped}%</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-iw-text-muted">
          Complete
        </span>
      </div>
    </div>
  );
}

/* ----- info row (intro "Why this matters" list) ----------------------------- */

export function InfoRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-iw-control bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-sensory-primary)]"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-iw-text-strong">{title}</span>
        <span className="text-xs leading-relaxed text-iw-text-muted">{body}</span>
      </span>
    </div>
  );
}
