"use client";

/**
 * PageContainer — the calm soft-glass shell every shell page sits inside.
 *
 * Renders the `bg-iw-canvas` page background, a max-width container,
 * vertical breathing room, and a slot for breadcrumbs above the title.
 *
 * Keep this dumb: it does not know about the current route. Pass
 * `title`, `eyebrow`, `actions`, `breadcrumbs` from the page component.
 */
import * as React from "react";
import clsx from "clsx";

export interface PageContainerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Small label above the title (e.g. "Reading", "Class · Grade 3"). */
  eyebrow?: React.ReactNode;
  /** Main page title. Rendered as h1. */
  title?: React.ReactNode;
  /** Sub-headline rendered under the title. */
  subtitle?: React.ReactNode;
  /** Right-side actions in the title row (buttons, role chips, etc.). */
  actions?: React.ReactNode;
  /** Optional breadcrumbs slot rendered above the title. */
  breadcrumbs?: React.ReactNode;
  /**
   * When `true` the body is wrapped in a soft glass card. Useful for
   * dense single-card screens; leave false for multi-card dashboards.
   */
  glass?: boolean;
  /** Restrict max width — default `iw-container-desktop` (1200px). */
  width?: "narrow" | "default" | "wide" | "full";
}

const WIDTHS: Record<NonNullable<PageContainerProps["width"]>, string> = {
  narrow: "max-w-iw-container-tablet",
  default: "max-w-iw-container-desktop",
  wide: "max-w-iw-container-ultrawide",
  full: "max-w-none",
};

export function PageContainer({
  eyebrow,
  title,
  subtitle,
  actions,
  breadcrumbs,
  glass = false,
  width = "default",
  className,
  children,
  ...rest
}: PageContainerProps) {
  return (
    <div
      className={clsx(
        "min-h-full bg-[var(--aivo-color-surface-canvas,#f4f6f5)]",
        "px-4 sm:px-6 lg:px-10",
        "pt-6 pb-16 lg:pt-10",
        className,
      )}
      {...rest}
    >
      <div className={clsx("mx-auto flex flex-col gap-6", WIDTHS[width])}>
        {breadcrumbs ? <div>{breadcrumbs}</div> : null}
        {(eyebrow || title || subtitle || actions) && (
          <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-1">
              {eyebrow ? (
                <p className="iw-label text-iw-text-muted">{eyebrow}</p>
              ) : null}
              {title ? (
                <h1 className="text-2xl lg:text-3xl font-semibold text-iw-text-strong">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="text-iw-text-muted max-w-2xl">{subtitle}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </header>
        )}
        {glass ? (
          <div className="rounded-iw-card-lg bg-white/85 backdrop-blur-md border border-iw-border shadow-iw-soft p-6 lg:p-8">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
PageContainer.displayName = "Shell/PageContainer";
