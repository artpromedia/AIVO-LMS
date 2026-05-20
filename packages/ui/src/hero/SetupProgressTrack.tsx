import * as React from "react";
import { clsx } from "clsx";

/**
 * SetupProgressTrack
 *
 * Horizontal track that shows the parent how far through first-time
 * setup they are. Each step is one of:
 *   - "done"       : completed (filled green check)
 *   - "active"     : the step the parent should do next (brand purple)
 *   - "upcoming"   : not yet started (muted)
 *   - "blocked"    : waiting on something out of the parent's hands
 *                    (e.g. school approval), with a tooltip label
 *
 * Each step is a button (when an action is provided) so keyboard
 * users can jump straight to the step.
 */
export type SetupStep = {
  id: string;
  label: string;
  status: "done" | "active" | "upcoming" | "blocked";
  href?: string;
};

const STATUS_DOT: Record<SetupStep["status"], string> = {
  done: "bg-[var(--aivo-domain-completion-completed-strong,#16a34a)] text-white",
  active: "bg-[var(--aivo-sensory-primary,#7c3aed)] text-white ring-4 ring-[var(--aivo-sensory-primary,#7c3aed)]/20",
  upcoming: "bg-white text-iw-text-muted ring-1 ring-iw-border",
  blocked: "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
};

const STATUS_LABEL: Record<SetupStep["status"], string> = {
  done: "Completed",
  active: "Current step",
  upcoming: "Upcoming",
  blocked: "Waiting on someone else",
};

export type SetupProgressTrackProps = {
  steps: SetupStep[];
  className?: string;
};

export function SetupProgressTrack({ steps, className }: SetupProgressTrackProps) {
  const total = steps.length;
  const done = steps.filter((s) => s.status === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div
      className={clsx(
        "rounded-iw-card-lg bg-white ring-1 ring-iw-border p-5 sm:p-6",
        className,
      )}
      aria-label="Family setup progress"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="iw-label uppercase tracking-wider text-iw-text-muted">
          Family setup
        </p>
        <p className="text-sm font-semibold text-iw-text-strong tabular-nums">
          {done} of {total} done · {pct}%
        </p>
      </div>

      {/* progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--aivo-color-surface-canvas,#f4f6f5)]">
        <div
          className="h-full rounded-full bg-[var(--aivo-sensory-primary,#7c3aed)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* step list */}
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const Tag: React.ElementType = s.href ? "a" : "div";
          return (
            <li key={s.id}>
              <Tag
                {...(s.href ? { href: s.href } : {})}
                className={clsx(
                  "flex items-center gap-3 rounded-iw-card border border-iw-border bg-white px-3 py-2",
                  s.href ? "hover:border-[var(--aivo-sensory-primary,#7c3aed)] transition-colors" : "",
                )}
                aria-current={s.status === "active" ? "step" : undefined}
              >
                <span
                  className={clsx(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    STATUS_DOT[s.status],
                  )}
                  aria-label={STATUS_LABEL[s.status]}
                >
                  {s.status === "done" ? "✓" : i + 1}
                </span>
                <span
                  className={clsx(
                    "text-sm",
                    s.status === "active"
                      ? "font-semibold text-iw-text-strong"
                      : s.status === "done"
                        ? "text-iw-text-muted line-through"
                        : "text-iw-text-strong",
                  )}
                >
                  {s.label}
                </span>
              </Tag>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
SetupProgressTrack.displayName = "Hero/SetupProgressTrack";
