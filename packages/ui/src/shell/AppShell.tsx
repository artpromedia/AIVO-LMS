"use client";

/**
 * AppShell — desktop shell layout binding `Sidebar` + `CommandBar`
 * around a page slot. Hosts pass children directly; we provide the
 * sticky bar + scrollable content column.
 */
import * as React from "react";
import clsx from "clsx";
import { Sidebar, type SidebarProps } from "./Sidebar.js";
import { CommandBar, type CommandBarProps } from "./CommandBar.js";

export interface AppShellProps {
  sidebar: Omit<SidebarProps, "className">;
  commandBar: Omit<CommandBarProps, "className">;
  /** Whether the sidebar is shown on tablet / phones. Default `false`. */
  showSidebarOnMobile?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function AppShell({
  sidebar,
  commandBar,
  showSidebarOnMobile = false,
  className,
  children,
}: AppShellProps) {
  return (
    <div
      className={clsx(
        "flex min-h-screen w-full bg-[var(--aivo-color-surface-canvas,#f4f6f5)]",
        className,
      )}
    >
      <div
        className={clsx(
          "shrink-0",
          showSidebarOnMobile ? "block" : "hidden lg:block",
        )}
      >
        <Sidebar {...sidebar} className="sticky top-0 h-screen" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <CommandBar {...commandBar} />
        <main role="main" className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
AppShell.displayName = "Shell/AppShell";
