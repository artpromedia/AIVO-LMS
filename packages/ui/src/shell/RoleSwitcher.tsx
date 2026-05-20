"use client";

/**
 * RoleSwitcher — popover-style switcher rendered in the command bar.
 *
 * Sensitive switches (parent / teacher / admin) are visually marked
 * `requires step-up` via the `RoleMeta.requiresStepUp` flag; the host
 * app handles the actual auth handshake in `onSelect`.
 */
import * as React from "react";
import clsx from "clsx";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { ROLE_META, type Role } from "@aivo/nav";
import type { RoleOption } from "./types.js";

export interface RoleSwitcherProps {
  current: Role;
  options: RoleOption[];
  /** Called when a user picks a different role. Host handles step-up. */
  onSelect: (role: Role) => void;
  /** Restrict to web vs mobile-available roles. Default `web`. */
  surface?: "web" | "mobile";
  className?: string;
}

export function RoleSwitcher({
  current,
  options,
  onSelect,
  surface = "web",
  className,
}: RoleSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const currentMeta = ROLE_META[current];

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = options.filter((o) =>
    surface === "web" ? ROLE_META[o.id].onWeb : ROLE_META[o.id].onMobile,
  );

  return (
    <div ref={wrapRef} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="iw-touch inline-flex items-center gap-2 rounded-iw-chip border border-iw-border bg-white px-3 py-1.5 text-sm font-medium text-iw-text-strong hover:bg-iw-card"
      >
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--aivo-color-aivoPurple-100,#ede9fe)] text-[10px] font-semibold text-[var(--aivo-color-aivoPurple-700,#6d28d9)]"
          aria-hidden
        >
          {currentMeta.label.slice(0, 1)}
        </span>
        <span className="hidden sm:inline">{currentMeta.label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Switch role"
          className="absolute right-0 z-40 mt-2 w-[280px] rounded-iw-card-lg border border-iw-border bg-white/95 backdrop-blur-md shadow-iw-floating p-1.5"
        >
          {visible.length === 0 ? (
            <p className="px-3 py-2 text-sm text-iw-text-muted">
              No other roles available.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {visible.map((opt) => {
                const meta = ROLE_META[opt.id];
                const isCurrent = opt.id === current;
                const disabled = !opt.available && !isCurrent;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      disabled={disabled}
                      onClick={() => {
                        setOpen(false);
                        if (!isCurrent) onSelect(opt.id);
                      }}
                      className={clsx(
                        "iw-touch flex w-full items-start gap-3 rounded-iw-control px-3 py-2 text-left",
                        isCurrent && "bg-iw-card",
                        !isCurrent && !disabled && "hover:bg-iw-card",
                        disabled && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-iw-control bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-xs font-semibold text-[var(--aivo-color-aivoPurple-700,#6d28d9)]">
                        {meta.label.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-iw-text-strong">
                          {meta.label}
                          {meta.requiresStepUp ? (
                            <ShieldCheck
                              className="h-3.5 w-3.5 text-iw-text-muted"
                              aria-label="Requires verification"
                            />
                          ) : null}
                        </span>
                        <span className="block text-xs text-iw-text-muted">
                          {meta.description}
                        </span>
                      </span>
                      {isCurrent ? (
                        <Check
                          className="mt-1 h-4 w-4 text-[var(--aivo-color-aivoPurple-600,#7c3aed)]"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
RoleSwitcher.displayName = "Shell/RoleSwitcher";
