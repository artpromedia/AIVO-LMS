"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * LearnerHome/LearnerBottomNav
 *
 * Mobile bottom navigation for the learner. Per Sprint 7 spec the
 * tap targets must be generous (min 48px) and the active state
 * must be obvious. Renders as nav on md+ via sr-only fallback —
 * desktop uses the standard role shell.
 *
 * Each item is an anchor so the navigation works without client JS.
 * `current` controls the active visual state.
 */
export interface LearnerNavItem {
  href: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  /** Unread/new counter shown as a soft dot when > 0. */
  badge?: number;
}

export interface LearnerBottomNavProps {
  items: ReadonlyArray<LearnerNavItem>;
  /** Pathname of the currently-active item. */
  currentHref: string;
  /** Hide on desktop (default true). Set false to render at all sizes. */
  mobileOnly?: boolean;
  className?: string;
}

export function LearnerBottomNav({
  items,
  currentHref,
  mobileOnly = true,
  className,
}: LearnerBottomNavProps) {
  return (
    <nav
      aria-label="Learner navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-30",
        "border-t border-iw-border bg-white/95 backdrop-blur",
        "supports-[backdrop-filter]:bg-white/75",
        mobileOnly && "md:hidden",
        "iw-safe-bottom",
        className,
      )}
    >
      <ul className="grid grid-cols-5 max-w-md mx-auto">
        {items.map((item) => {
          const active = currentHref.startsWith(item.href);
          return (
            <li key={item.href} className="contents">
              <a
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px]",
                  "transition-colors",
                  active
                    ? "text-[var(--aivo-sensory-primary)]"
                    : "text-iw-text-muted hover:text-iw-text-strong",
                  "focus:outline-none focus:bg-[var(--aivo-color-aivoPurple-50)]/40",
                )}
              >
                <span aria-hidden="true" className="text-[20px] leading-none">
                  {item.icon}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  {item.label}
                </span>
                {typeof item.badge === "number" && item.badge > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 right-1/2 translate-x-3.5 w-2 h-2 rounded-full bg-[var(--aivo-color-aivoOrange-600)]"
                  />
                ) : null}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--aivo-sensory-primary)]"
                  />
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

LearnerBottomNav.displayName = "LearnerHome/LearnerBottomNav";
