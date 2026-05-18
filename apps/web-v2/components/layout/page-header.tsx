import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PageHeader — the title block at the top of each dashboard page.
 *
 * Uses the Inclusive-Warm display face (Fredoka via `font-iw-display`) and
 * the sensory-mode ink token so titles stay legible across all three modes.
 * The optional eyebrow sits in `text-iw-ink-muted` rather than a hardcoded
 * gray so calm / high-contrast modes can lift its contrast as needed.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-iw-ink-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-iw-display text-3xl font-bold tracking-tight text-iw-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-iw-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div>
        <h2 className="font-iw-display text-xl font-semibold text-iw-ink">{title}</h2>
        {description ? <p className="text-sm text-iw-ink-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
