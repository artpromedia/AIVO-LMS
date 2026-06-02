"use client";

/**
 * CommandBar — top bar with search, notifications, role switcher,
 * account, and help. Lives flush against the top of the shell.
 *
 * Visually calm: no hard divider, just a thin tinted backdrop blur so
 * cards underneath stay visible.
 */
import * as React from "react";
import clsx from "clsx";
import { Bell, HelpCircle, Search } from "lucide-react";
import { RoleSwitcher } from "./RoleSwitcher.js";
import type { AccountSummary, RoleOption } from "./types.js";
import type { Role } from "@aivo/nav";

export interface CommandBarProps {
  /** Currently active role (drives RoleSwitcher and account chip). */
  role: Role;
  account: AccountSummary;
  roleOptions: RoleOption[];
  onRoleSelect: (role: Role) => void;
  /** Triggered when the user submits the search input. */
  onSearch?: (query: string) => void;
  /** Unread notification count (omit or 0 for no badge). */
  unreadCount?: number;
  onOpenNotifications?: () => void;
  onOpenHelp?: () => void;
  onOpenAccount?: () => void;
  /**
   * Optional slot rendered at the far left of the bar, used by mobile
   * tablets to expose a "hamburger" that toggles the sidebar.
   */
  leading?: React.ReactNode;
  className?: string;
}

export function CommandBar({
  role,
  account,
  roleOptions,
  onRoleSelect,
  onSearch,
  unreadCount = 0,
  onOpenNotifications,
  onOpenHelp,
  onOpenAccount,
  leading,
  className,
}: CommandBarProps) {
  const [query, setQuery] = React.useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSearch?.(query.trim());
  }

  return (
    <header
      role="banner"
      className={clsx(
        "sticky top-0 z-30 flex h-16 items-center gap-3 px-4 lg:px-6",
        "border-b border-iw-border bg-white/70 backdrop-blur-md",
        className,
      )}
    >
      {leading}

      <form role="search" onSubmit={submit} className="flex flex-1 items-center gap-2 max-w-xl">
        <label className="iw-touch relative flex w-full items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-iw-text-muted"
            aria-hidden
          />
          <span className="sr-only">Search AIVO</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search learners, lessons, settings…"
            className="w-full rounded-iw-chip border border-iw-border bg-iw-card pl-9 pr-3 py-2 text-sm text-iw-text-strong placeholder:text-iw-text-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#a5b4fc)]"
          />
        </label>
      </form>

      <div className="flex items-center gap-1.5">
        <RoleSwitcher current={role} options={roleOptions} onSelect={onRoleSelect} />

        <button
          type="button"
          onClick={onOpenNotifications}
          className="iw-touch relative inline-flex h-9 w-9 items-center justify-center rounded-iw-control text-iw-text-muted hover:bg-iw-card hover:text-iw-text-strong"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--aivo-color-status-error-strong,#dc2626)] px-1 text-[10px] font-semibold text-white"
              aria-hidden
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          className="iw-touch inline-flex h-9 w-9 items-center justify-center rounded-iw-control text-iw-text-muted hover:bg-iw-card hover:text-iw-text-strong"
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onOpenAccount}
          className="iw-touch inline-flex items-center gap-2 rounded-iw-chip pl-1 pr-2.5 py-1 text-sm font-medium text-iw-text-strong hover:bg-iw-card"
          aria-label={`Account · ${account.name}`}
        >
          {account.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--aivo-color-aivoTeal-100,#ccfbf1)] text-xs font-semibold text-[var(--aivo-color-aivoTeal-700,#0f766e)]">
              {(account.initials ?? account.name.slice(0, 1)).toUpperCase()}
            </span>
          )}
          <span className="hidden md:inline max-w-[120px] truncate">{account.name}</span>
        </button>
      </div>
    </header>
  );
}
CommandBar.displayName = "Shell/CommandBar";
