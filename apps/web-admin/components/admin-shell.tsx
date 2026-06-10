"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { AdminNavGroup } from "@/lib/admin-nav-model";

/**
 * Persistent platform app shell: grouped, collapsible sidebar with
 * active-route highlight; top bar with pathname breadcrumbs, a global nav
 * search, and the account switcher; content slot for the page. On small
 * screens the sidebar becomes a drawer behind the top-bar menu button.
 *
 * Receives ALREADY role-filtered nav groups from the server layout — no
 * role logic runs on the client.
 */

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

function breadcrumbsFor(pathname: string, groups: AdminNavGroup[]): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Platform", href: "/platform" }];
  if (pathname === "/platform") {
    crumbs.push({ label: "Overview", href: null });
    return crumbs;
  }
  const href = activeHref(pathname, groups);
  let consumed = "/platform";
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

export function AdminShell({
  groups,
  account,
  children,
}: {
  groups: AdminNavGroup[];
  account: { displayName: string; roleLabel: string };
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/platform";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");

  const active = useMemo(() => activeHref(pathname, groups), [pathname, groups]);
  const crumbs = useMemo(() => breadcrumbsFor(pathname, groups), [pathname, groups]);

  const trimmed = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!trimmed) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(trimmed)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, trimmed]);

  const toggleGroup = (id: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sidebar = (
    <nav aria-label="Platform sections" className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <Link
        className="px-2 text-sm font-bold uppercase tracking-[0.25em] text-blue-700"
        href="/platform"
        prefetch={false}
        onClick={() => setDrawerOpen(false)}
      >
        AIVO Admin
      </Link>
      {visibleGroups.map((group) => {
        // A live search overrides collapse state so matches always show.
        const expanded = trimmed.length > 0 || !collapsed.has(group.id);
        return (
          <div key={group.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
              data-testid={`nav-group-${group.id}`}
              aria-expanded={expanded}
              onClick={() => toggleGroup(group.id)}
            >
              {group.label}
              <span aria-hidden="true" className="text-slate-400">
                {expanded ? "▾" : "▸"}
              </span>
            </button>
            {expanded ? (
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.href === active;
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
                        className={`block rounded-lg px-2 py-1.5 text-sm font-semibold ${
                          isActive
                            ? "bg-blue-700/10 text-blue-800"
                            : "text-slate-700 hover:bg-slate-900/5"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen" data-testid="admin-shell">
      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-900/10 bg-white/70 lg:block"
        data-testid="admin-shell-sidebar"
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl" data-testid="admin-shell-drawer">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-slate-900/10 bg-white/80 px-4 py-3 backdrop-blur-sm sm:px-6">
          {/* Utilities only: .admin-button is unlayered CSS, so its display
              would beat the layered lg:hidden utility and pin this visible. */}
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-blue-900/25 bg-white/75 px-3 py-1.5 text-sm font-bold text-blue-800 lg:hidden"
            data-testid="admin-shell-menu"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            Menu
          </button>
          <ol className="flex min-w-0 flex-1 items-center gap-1.5 text-sm" data-testid="admin-shell-breadcrumbs">
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-slate-400">
                    /
                  </span>
                ) : null}
                {crumb.href ? (
                  <Link className="font-semibold text-slate-500 hover:text-slate-800" href={crumb.href}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="truncate font-semibold text-slate-900">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <input
            type="search"
            className="admin-input hidden w-56 px-3 py-1.5 text-sm sm:block"
            placeholder="Search navigation…"
            aria-label="Search navigation"
            data-testid="admin-shell-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{account.displayName}</p>
              <p className="text-xs text-slate-500">{account.roleLabel}</p>
            </div>
            <Link className="admin-button admin-button-secondary px-3 py-1.5 text-sm" href="/login">
              Switch
            </Link>
          </div>
        </header>
        <div className="admin-shell-content flex-1 px-4 py-6 sm:px-6" data-testid="admin-shell-content">
          {children}
        </div>
      </div>
    </div>
  );
}
