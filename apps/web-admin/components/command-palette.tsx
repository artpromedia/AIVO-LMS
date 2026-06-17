"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  GraduationCap,
  Loader2,
  Rocket,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Global ⌘K command palette. Opens from the shell header trigger or the
 * ⌘K / Ctrl+K shortcut, fans a single query across tenants / users /
 * learners / pilots via `/api/search` (RBAC-gated, real aggregates — pilots
 * from billing-svc), and deep-links the chosen result. Empty query shows
 * recent picks (localStorage). Fully keyboard-driven: ↑/↓ to move, ↵ to open,
 * Esc to dismiss.
 */

type EntityKind = "tenant" | "user" | "learner" | "pilot";

interface SearchHit {
  kind: EntityKind;
  id: string;
  label: string;
  sub: string;
  href: string;
}

interface ApiResults {
  tenants: { id: string; name: string; type: string; status: string }[];
  users: { id: string; name: string | null; email: string; role: string }[];
  learners: { id: string; name: string; tenantId: string }[];
  pilots: { tenantId: string; districtName: string; status: string; tier: string | null }[];
}

const KIND_ICON: Record<EntityKind, LucideIcon> = {
  tenant: Building2,
  user: Users,
  learner: GraduationCap,
  pilot: Rocket,
};

const KIND_LABEL: Record<EntityKind, string> = {
  tenant: "Tenants",
  user: "Users",
  learner: "Learners",
  pilot: "Pilots",
};

const RECENT_KEY = "aivo-admin-recent-search";
const RECENT_MAX = 6;

function tenantHref(id: string): string {
  return `/platform/tenants/${encodeURIComponent(id)}`;
}
function userHref(id: string): string {
  return `/platform/users/${encodeURIComponent(id)}`;
}
function learnerHref(name: string): string {
  return `/platform/learners?search=${encodeURIComponent(name)}`;
}
function pilotHref(tenantId: string): string {
  return `/platform/pilots/${encodeURIComponent(tenantId)}`;
}

function toHits(results: ApiResults): SearchHit[] {
  return [
    ...results.tenants.map((t) => ({
      kind: "tenant" as const,
      id: t.id,
      label: t.name || "Untitled tenant",
      sub: [t.type, t.status].filter(Boolean).join(" · "),
      href: tenantHref(t.id),
    })),
    ...results.users.map((u) => ({
      kind: "user" as const,
      id: u.id,
      label: u.name || u.email || "Unknown user",
      sub: [u.email, u.role].filter(Boolean).join(" · "),
      href: userHref(u.id),
    })),
    ...results.learners.map((l) => ({
      kind: "learner" as const,
      id: l.id,
      label: l.name || "Unnamed learner",
      sub: "Learner",
      href: learnerHref(l.name),
    })),
    ...results.pilots.map((p) => ({
      kind: "pilot" as const,
      id: p.tenantId,
      label: p.districtName || "District pilot",
      sub: [p.tier, p.status].filter(Boolean).join(" · ") || "Pilot",
      href: pilotHref(p.tenantId),
    })),
  ];
}

function readRecent(): SearchHit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (h): h is SearchHit =>
        h && typeof h.id === "string" && typeof h.href === "string" && typeof h.label === "string",
    );
  } catch {
    return [];
  }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const trimmed = query.trim();
  const showingRecent = trimmed.length < 2;
  const visible = showingRecent ? recent : hits;

  // Reset + focus on open; restore focus to the trigger on close (AA modal).
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    setQuery("");
    setHits([]);
    setErrored(false);
    setActive(0);
    setRecent(readRecent());
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      window.clearTimeout(id);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // Debounced, abortable fetch as the query changes.
  useEffect(() => {
    if (!open) return;
    if (trimmed.length < 2) {
      setHits([]);
      setLoading(false);
      setErrored(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ApiResults;
        setHits(toHits(data));
        setErrored(false);
        setActive(0);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setHits([]);
        setErrored(true);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [open, trimmed]);

  const select = useCallback(
    (hit: SearchHit) => {
      const next = [hit, ...readRecent().filter((h) => !(h.kind === hit.kind && h.id === hit.id))].slice(
        0,
        RECENT_MAX,
      );
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* private mode — recents are best-effort */
      }
      onClose();
      router.push(hit.href);
    },
    [onClose, router],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );
        const list = focusables
          ? Array.from(focusables).filter((el) => el.offsetParent !== null)
          : [];
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => (visible.length === 0 ? 0 : (i + 1) % visible.length));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => (visible.length === 0 ? 0 : (i - 1 + visible.length) % visible.length));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const hit = visible[active];
        if (hit) select(hit);
      }
    },
    [active, onClose, select, visible],
  );

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Group the flat visible list back into sections while preserving the flat
  // index used for keyboard navigation.
  const sections = useMemo(() => {
    const order: EntityKind[] = ["tenant", "user", "learner", "pilot"];
    let flat = 0;
    return order
      .map((kind) => {
        const rows = visible
          .map((hit, originalIndex) => ({ hit, originalIndex }))
          .filter((entry) => entry.hit.kind === kind);
        return { kind, rows };
      })
      .filter((section) => section.rows.length > 0)
      .map((section) => ({
        ...section,
        rows: section.rows.map((row) => ({ ...row, flatIndex: flat++ })),
      }));
  }, [visible]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="presentation"
      data-testid="admin-command-palette"
    >
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search tenants, users, learners, and pilots"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-slate-900/10 px-4">
          <Search aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            aria-autocomplete="list"
            aria-label="Search tenants, users, learners, and pilots"
            placeholder="Search tenants, users, learners, pilots…"
            className="w-full bg-transparent py-3.5 text-base text-slate-900 outline-none placeholder:text-slate-400"
            data-testid="admin-command-input"
          />
          {loading ? (
            <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-slate-400" />
          ) : (
            <kbd className="hidden shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 sm:inline">
              Esc
            </kbd>
          )}
        </div>

        <ul
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="Search results"
          className="max-h-[50vh] overflow-y-auto p-2"
        >
          {showingRecent && recent.length > 0 ? (
            <li className="px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent
            </li>
          ) : null}
          {sections.map((section) => (
            <li key={section.kind} role="presentation">
              {!showingRecent ? (
                <p className="px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {KIND_LABEL[section.kind]}
                </p>
              ) : null}
              <ul role="presentation">
                {section.rows.map(({ hit, flatIndex }) => {
                  const Icon = KIND_ICON[hit.kind];
                  const isActive = flatIndex === active;
                  return (
                    <li key={`${hit.kind}-${hit.id}`} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-index={flatIndex}
                        onClick={() => select(hit)}
                        onMouseMove={() => setActive(flatIndex)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${
                          isActive ? "bg-violet-600/10" : "hover:bg-slate-900/5"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            isActive ? "bg-violet-600/15 text-violet-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {hit.label}
                          </span>
                          {hit.sub ? (
                            <span className="block truncate text-xs text-slate-500">{hit.sub}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                          {KIND_LABEL[hit.kind].replace(/s$/, "")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}

          {visible.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-slate-500" role="presentation">
              {errored
                ? "Search is unavailable right now. Try again."
                : loading
                  ? "Searching…"
                  : trimmed.length >= 2
                    ? `No matches for “${trimmed}”.`
                    : "Type at least two characters to search tenants, users, learners, and pilots."}
            </li>
          ) : null}
        </ul>

        <div className="flex items-center justify-between border-t border-slate-900/10 px-4 py-2 text-[11px] text-slate-400">
          <span>Search across tenants, users, learners &amp; pilots</span>
          <span className="hidden items-center gap-2 sm:flex">
            <kbd className="rounded border border-slate-300 px-1 py-0.5 font-semibold">↑↓</kbd>
            navigate
            <kbd className="rounded border border-slate-300 px-1 py-0.5 font-semibold">↵</kbd>
            open
          </span>
        </div>
      </div>
    </div>
  );
}
