/**
 * Breadcrumbs — accessible, calm crumb trail.
 *
 * Pass an array of items; the last is treated as the current page and
 * rendered as a non-link with `aria-current="page"`. Renderer-free:
 * the consumer passes a `linkAs` component (Next/Link, NavLink, etc.).
 */
import * as React from "react";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: Crumb[];
  /**
   * Component used to render anchors. Defaults to a plain `<a>`. Pass
   * `Link` from `next/link` in Next.js apps.
   */
  linkAs?: React.ElementType;
}

export function Breadcrumbs({
  items,
  linkAs: LinkComponent = "a",
  className,
  ...rest
}: BreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={clsx("text-sm", className)}
      {...rest}
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-iw-text-muted">
        {items.map((crumb, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {last || !crumb.href ? (
                <span
                  className={clsx(
                    "px-1.5 py-0.5 rounded-iw-chip",
                    last && "text-iw-text-strong font-medium",
                  )}
                  aria-current={last ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <LinkComponent
                  href={crumb.href}
                  className="px-1.5 py-0.5 rounded-iw-chip hover:bg-iw-card hover:text-iw-text-strong transition-colors"
                >
                  {crumb.label}
                </LinkComponent>
              )}
              {!last ? (
                <ChevronRight aria-hidden className="w-3.5 h-3.5 opacity-60" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
Breadcrumbs.displayName = "Shell/Breadcrumbs";
