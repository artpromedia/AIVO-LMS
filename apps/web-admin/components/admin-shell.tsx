"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  FileCheck,
  FileText,
  Fingerprint,
  Flag,
  FlaskConical,
  GraduationCap,
  KeyRound,
  LayoutTemplate,
  LifeBuoy,
  ListChecks,
  ListTree,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Plug,
  Rocket,
  ScanFace,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Ticket,
  TrendingUp,
  Upload,
  UserMinus,
  Users,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { AdminNavGroup } from "@/lib/admin-nav-model";
import { CommandPalette } from "@/components/command-palette";

/**
 * Persistent platform app shell: brand lockup, grouped collapsible sidebar
 * (rail-collapsible, persisted) with active-route highlight; a top bar with a
 * ⌘K command-palette trigger, notifications, and the account menu; a content
 * breadcrumb; and the page slot. On small screens the sidebar is a drawer.
 *
 * Receives ALREADY role-filtered nav groups from the server layout — no role
 * logic runs on the client.
 */

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  "bar-chart-3": BarChart3,
  boxes: Boxes,
  "building-2": Building2,
  "clipboard-check": ClipboardCheck,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  "file-check": FileCheck,
  "file-text": FileText,
  fingerprint: Fingerprint,
  flag: Flag,
  "flask-conical": FlaskConical,
  "graduation-cap": GraduationCap,
  "key-round": KeyRound,
  "layout-template": LayoutTemplate,
  "life-buoy": LifeBuoy,
  "list-checks": ListChecks,
  "list-tree": ListTree,
  megaphone: Megaphone,
  palette: Palette,
  plug: Plug,
  rocket: Rocket,
  "scan-face": ScanFace,
  "scroll-text": ScrollText,
  settings: Settings,
  shield: Shield,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  siren: Siren,
  sparkles: Sparkles,
  ticket: Ticket,
  "trending-up": TrendingUp,
  upload: Upload,
  "user-minus": UserMinus,
  users: Users,
  "volume-2": Volume2,
};

function iconFor(key?: string): LucideIcon {
  return (key && ICONS[key]) || Circle;
}

const RAIL_KEY = "aivo-admin-sidebar-collapsed";

interface Crumb {
  label: string;
  href: string | null;
}

function humanizeSegment(segment: string): string {
  const decoded = decodeURIComponent(segment);
  if (/^[0-9a-f-]{16,}$/i.test(decoded)) return decoded.slice(0, 8) + "…";
  const words = decoded.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Longest nav href that prefixes the pathname — the single active item. */
function activeHref(pathname: string, groups: AdminNavGroup[]): string | null {
  let best: string | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (!best || item.href.length > best.length) best = item.href;
      }
    }
  }
  return best;
}

function breadcrumbsFor(
  pathname: string,
  groups: AdminNavGroup[],
  home: { href: string; label: string },
): Crumb[] {
  const crumbs: Crumb[] = [{ label: home.label, href: home.href }];
  if (pathname === home.href) {
    crumbs.push({ label: "Overview", href: null });
    return crumbs;
  }
  const href = activeHref(pathname, groups);
  let consumed = home.href;
  if (href) {
    const item = groups.flatMap((group) => group.items).find((entry) => entry.href === href);
    crumbs.push({ label: item?.label ?? humanizeSegment(href.split("/").at(-1) ?? ""), href });
    consumed = href;
  }
  const rest = pathname.slice(consumed.length).split("/").filter(Boolean);
  for (const segment of rest) {
    consumed += `/${segment}`;
    crumbs.push({ label: humanizeSegment(segment), href: consumed });
  }
  // The last crumb is the current page — render it as text, not a link.
  if (crumbs.length > 1) crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], href: null };
  return crumbs;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AdminShell({
  groups,
  account,
  homeHref = "/platform",
  homeLabel = "Platform",
  brand = "AIVO Admin",
  tenantLogoUrl = null,
  children,
}: {
  groups: AdminNavGroup[];
  account: { displayName: string; roleLabel: string };
  /** Console home route — the brand link and breadcrumb root. */
  homeHref?: string;
  homeLabel?: string;
  brand?: string;
  /** District logo (validated data URL) — shown above the wordmark (Sprint B6). */
  tenantLogoUrl?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? homeHref;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const [rail, setRail] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => activeHref(pathname, groups), [pathname, groups]);
  const crumbs = useMemo(
    () => breadcrumbsFor(pathname, groups, { href: homeHref, label: homeLabel }),
    [pathname, groups, homeHref, homeLabel],
  );

  // Restore the persisted rail state after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      setRail(window.localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleRail = () => {
    setRail((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // ⌘K / Ctrl+K opens the command palette from anywhere.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Dismiss the header menus on outside click / Escape.
  useEffect(() => {
    if (!accountOpen && !notifOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (accountOpen && accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
      if (notifOpen && notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen, notifOpen]);

  const toggleGroup = (id: string) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function renderSidebar(railMode: boolean) {
    return (
      <nav
        aria-label="Platform sections"
        className="flex h-full flex-col gap-1 overflow-y-auto overflow-x-hidden p-3"
      >
        {/* Brand lockup + rail toggle (desktop). */}
        <div className={`flex items-center gap-2 px-1 py-2 ${railMode ? "justify-center" : "justify-between"}`}>
          <Link
            className="flex min-w-0 items-center gap-2"
            href={homeHref}
            prefetch={false}
            aria-label={brand}
            onClick={() => setDrawerOpen(false)}
          >
            {tenantLogoUrl ? (
              /* Tenant logos are validated data URLs — next/image can't optimize them. */
              <img src={tenantLogoUrl} alt="" data-testid="tenant-logo" className="h-8 w-auto" />
            ) : railMode ? (
              <span className="flex size-9 items-center justify-center rounded-lg bg-violet-600 text-base font-extrabold text-white">
                A
              </span>
            ) : (
              // Handoff brand lockup: the AIVO wordmark image + a violet "Admin"
              // eyebrow (replaces the plain text "AIVO / Admin" wordmark).
              <span className="flex min-w-0 flex-col gap-1 leading-none">
                {/* Static brand asset (matches the tenant-logo <img> path above). */}
                <img
                  src="/images/aivo-logo-horizontal-dark.png"
                  alt="AIVO Learning"
                  className="h-7 w-auto"
                />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-violet-700">
                  Admin
                </span>
              </span>
            )}
          </Link>
          {!railMode ? (
            <button
              type="button"
              className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 lg:inline-flex"
              data-testid="admin-shell-collapse"
              aria-label="Collapse sidebar"
              onClick={toggleRail}
            >
              <PanelLeftClose className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="mt-1 flex flex-1 flex-col gap-1">
          {groups.map((group) => {
            const expanded = !collapsedGroups.has(group.id);
            const GroupIcon = iconFor(group.icon);
            if (railMode) {
              // Rail mode: drop the headers, show item icons only.
              return (
                <ul key={group.id} className="space-y-0.5 border-t border-slate-900/5 pt-1 first:border-0">
                  {group.items.map((item) => {
                    const isActive = item.href === active;
                    const ItemIcon = iconFor(item.icon);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          prefetch={false}
                          aria-current={isActive ? "page" : undefined}
                          aria-label={item.label}
                          title={item.label}
                          onClick={() => setDrawerOpen(false)}
                          className={`flex items-center justify-center rounded-lg p-2.5 ${
                            isActive
                              ? "bg-violet-600/10 text-violet-700"
                              : "text-slate-500 hover:bg-slate-900/5 hover:text-slate-800"
                          }`}
                        >
                          <ItemIcon className="size-5" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              );
            }
            return (
              <div key={group.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700"
                  data-testid={`nav-group-${group.id}`}
                  aria-expanded={expanded}
                  onClick={() => toggleGroup(group.id)}
                >
                  <GroupIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{group.label}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-3.5 shrink-0 text-slate-300 transition-transform ${
                      expanded ? "" : "-rotate-90"
                    }`}
                  />
                </button>
                {expanded ? (
                  <ul className="mb-2 mt-0.5 space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = item.href === active;
                      const ItemIcon = iconFor(item.icon);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            // Two dozen fully dynamic routes: prefetching them all
                            // on mount floods the origin's connection pool and
                            // aborts real navigations.
                            prefetch={false}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => setDrawerOpen(false)}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
                              isActive
                                ? "bg-violet-600/10 text-violet-700"
                                : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
                            }`}
                          >
                            <ItemIcon
                              className={`size-4 shrink-0 ${isActive ? "text-violet-600" : "text-slate-400"}`}
                              aria-hidden="true"
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Rail toggle pinned to the bottom. */}
        <button
          type="button"
          className={`mt-2 hidden items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-900/5 hover:text-slate-800 lg:flex ${
            railMode ? "justify-center" : ""
          }`}
          data-testid="admin-shell-collapse-bottom"
          aria-label={railMode ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleRail}
        >
          {railMode ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="size-4" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen" data-testid="admin-shell">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-slate-900/10 bg-white lg:block ${
          rail ? "w-[4.75rem]" : "w-64"
        }`}
        data-testid="admin-shell-sidebar"
      >
        {renderSidebar(rail)}
      </aside>

      {/* Mobile drawer (always full nav, never rail) */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl"
            data-testid="admin-shell-drawer"
          >
            {renderSidebar(false)}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-900/10 bg-white/85 px-4 py-2.5 backdrop-blur-sm sm:px-6">
          {/* Utilities only: .admin-button is unlayered CSS, so its display
              would beat the layered lg:hidden utility and pin this visible. */}
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-slate-900/15 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 lg:hidden"
            data-testid="admin-shell-menu"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            Menu
          </button>

          {/* ⌘K command-palette trigger (replaces the old nav-filter input). */}
          <button
            type="button"
            data-testid="admin-shell-search"
            aria-label="Search tenants, users, and learners"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={() => setPaletteOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-900/10 bg-slate-50 px-3 py-2 text-left text-sm text-slate-400 hover:border-slate-900/20 hover:bg-white sm:max-w-md"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            {/* Pilots join the palette in Prompt 9, when admin-svc /search gains
                pilot coverage; keep this copy truthful until then. */}
            <span className="min-w-0 flex-1 truncate">Search tenants, users, learners…</span>
            <kbd className="hidden shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 sm:inline">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Notifications — honest empty state (no fabricated count). */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-900/5 hover:text-slate-800"
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={notifOpen}
                data-testid="admin-shell-notifications"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setAccountOpen(false);
                }}
              >
                <Bell className="size-5" aria-hidden="true" />
              </button>
              {notifOpen ? (
                <div
                  role="menu"
                  aria-label="Notifications"
                  className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-900/10 bg-white p-4 shadow-xl"
                >
                  <p className="text-sm font-bold text-slate-900">Notifications</p>
                  <p className="mt-2 text-sm text-slate-500">You&rsquo;re all caught up.</p>
                </div>
              ) : null}
            </div>

            {/* Account menu */}
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-900/5"
                aria-haspopup="true"
                aria-expanded={accountOpen}
                data-testid="admin-shell-account"
                onClick={() => {
                  setAccountOpen((v) => !v);
                  setNotifOpen(false);
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white"
                >
                  {initials(account.displayName)}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-semibold text-slate-800">
                    {account.displayName}
                  </span>
                  <span className="block text-xs text-slate-500">{account.roleLabel}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  aria-label="Account"
                  className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-900/10 bg-white p-2 shadow-xl"
                >
                  <div className="px-2 py-2">
                    <p className="text-sm font-semibold text-slate-900">{account.displayName}</p>
                    <p className="text-xs text-slate-500">{account.roleLabel}</p>
                  </div>
                  <div className="my-1 border-t border-slate-900/10" />
                  <Link
                    role="menuitem"
                    href="/login"
                    className="block rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-900/5"
                  >
                    Switch account
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="admin-shell-content flex-1 px-4 py-6 sm:px-6" data-testid="admin-shell-content">
          {/* Breadcrumb lives above the page title to match the reference. */}
          <ol
            className="mb-4 flex min-w-0 flex-wrap items-center gap-1.5 text-sm"
            data-testid="admin-shell-breadcrumbs"
          >
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-slate-300">
                    ›
                  </span>
                ) : null}
                {crumb.href ? (
                  <Link
                    className="font-medium text-slate-500 hover:text-slate-800"
                    href={crumb.href}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="truncate font-semibold text-slate-700">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {children}
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
