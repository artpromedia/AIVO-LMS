"use client";

/**
 * Sidebar — collapsible, role-aware left nav for the web shell.
 *
 * Reads the nav registry by passing a `role`; the shell takes care of
 * ordering (full → linked → locked). Locked items render with a small
 * lock badge and route to `/locked/[area]`.
 *
 * The component is uncontrolled by default (`useState` collapse) and
 * supports a controlled `collapsed` + `onCollapseChange` pair for apps
 * that persist the collapse preference.
 */
import * as React from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import {
  NAV_AREA_META,
  getAreasForRole,
  getPermission,
  resolveRoute,
  type NavArea,
  type Role,
} from "@aivo/nav";
import { AivoIcon } from "../icon/AivoIcon.js";
import { NAV_ICON_TO_AIVO_ICON } from "./icon-map.js";

export interface SidebarProps {
  role: Role;
  /** Currently active area, used for the visual selected state. */
  activeArea?: NavArea;
  /** Controlled collapsed state. Omit for uncontrolled. */
  collapsed?: boolean;
  onCollapseChange?: (next: boolean) => void;
  /** Anchor component (e.g. Next/Link). Defaults to `<a>`. */
  linkAs?: React.ElementType;
  /** Optional brand block rendered above the nav list. */
  brand?: React.ReactNode;
  /** Optional footer rendered below the nav list (e.g. account chip). */
  footer?: React.ReactNode;
  className?: string;
}

export function Sidebar({
  role,
  activeArea,
  collapsed: controlled,
  onCollapseChange,
  linkAs: LinkComponent = "a",
  brand,
  footer,
  className,
}: SidebarProps) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const collapsed = controlled ?? uncontrolled;
  const setCollapsed = (next: boolean) => {
    if (onCollapseChange) onCollapseChange(next);
    else setUncontrolled(next);
  };

  const areas = React.useMemo(() => getAreasForRole(role, { includeLocked: true }), [role]);

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={clsx(
        "group relative h-full flex flex-col gap-4",
        "border-r border-iw-border bg-white/80 backdrop-blur-md",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[244px]",
        className,
      )}
      aria-label="Primary"
    >
      <div className="flex items-center justify-between px-3 pt-4">
        <div
          className={clsx(
            "min-w-0 transition-opacity duration-150",
            collapsed && "opacity-0 pointer-events-none",
          )}
        >
          {brand}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="iw-touch -mr-1.5 inline-flex h-8 w-8 items-center justify-center rounded-iw-control text-iw-text-muted hover:bg-iw-card hover:text-iw-text-strong"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <ul className="flex flex-col gap-0.5">
          {areas.map((area) => {
            const meta = NAV_AREA_META[area];
            const perm = getPermission(role, area);
            const href = resolveRoute(role, area, "web") ?? "#";
            const isActive = activeArea === area;
            const isLocked = perm.access === "locked";
            return (
              <li key={area}>
                <LinkComponent
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  aria-disabled={isLocked || undefined}
                  title={collapsed ? meta.label : undefined}
                  className={clsx(
                    "group/item iw-touch relative flex items-center gap-3 rounded-iw-control px-2.5 py-2 text-sm",
                    "transition-colors",
                    isActive
                      ? "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-color-aivoPurple-700,#6d28d9)] font-medium"
                      : "text-iw-text-strong hover:bg-iw-card",
                    isLocked && "text-iw-text-muted",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-iw-control",
                      isActive ? "bg-white shadow-iw-soft" : "bg-transparent",
                    )}
                  >
                    <AivoIcon
                      name={NAV_ICON_TO_AIVO_ICON[meta.icon]}
                      className="h-4 w-4"
                      aria-hidden
                    />
                  </span>
                  <span
                    className={clsx(
                      "min-w-0 flex-1 truncate transition-opacity duration-150",
                      collapsed && "opacity-0 pointer-events-none",
                    )}
                  >
                    {meta.label}
                  </span>
                  {isLocked && !collapsed ? (
                    <Lock className="h-3.5 w-3.5 text-iw-text-muted" aria-label="Locked" />
                  ) : null}
                </LinkComponent>
              </li>
            );
          })}
        </ul>
      </nav>

      {footer ? (
        <div className={clsx("border-t border-iw-border px-3 py-3", collapsed && "px-1.5")}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
Sidebar.displayName = "Shell/Sidebar";
