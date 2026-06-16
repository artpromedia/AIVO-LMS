"use client";
import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { SENSORY_MODES_ORDERED, type SensoryMode } from "@/lib/sensory-mode";

const LABELS: Record<SensoryMode, string> = {
  standard: "Standard",
  calm: "Calm",
  "high-contrast": "High Contrast",
};

/**
 * Sensory-mode pill that appears in the marketing nav.
 *
 * - Lives in the navigation on every marketing page (top nav, legal nav,
 *   audience nav) so a visitor can switch standard → calm → high-contrast
 *   from anywhere on the site.
 * - Mirrors the choice to `<html data-sensory-mode>` immediately for a
 *   responsive feel, then POSTs to `/api/sensory-mode` so the choice
 *   persists across pages via cookie (read by the root layout on the
 *   next request, which prevents a flash on hard navigations).
 */
export function SensoryModeToggle({
  initialMode,
  compact = false,
}: Readonly<{ initialMode: SensoryMode; compact?: boolean }>) {
  const [mode, setMode] = useState<SensoryMode>(initialMode);
  const [, startTransition] = useTransition();

  function selectMode(next: SensoryMode) {
    if (next === mode) return;
    setMode(next);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-sensory-mode", next);
    }
    startTransition(() => {
      void fetch("/api/sensory-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
        credentials: "same-origin",
      }).catch(() => {
        // Cookie write is a nice-to-have for persistence; the UI is
        // already updated locally so a network failure is not fatal.
      });
    });
  }

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-iw-control bg-white/70 border border-iw-border shadow-soft-1 ${
        compact ? "" : "backdrop-blur"
      }`}
      role="group"
      aria-label="Sensory mode"
    >
      {!compact && (
        <span className="hidden md:inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-iw-ink-muted">
          <Eye className="w-3.5 h-3.5" aria-hidden="true" /> Mode
        </span>
      )}
      <div className="flex items-center bg-iw-raised/70 rounded-iw-control p-0.5">
        {SENSORY_MODES_ORDERED.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              onClick={() => selectMode(m)}
              aria-pressed={active}
              className={`px-3 py-1.5 text-xs font-semibold rounded-iw-control transition-colors min-h-[28px] whitespace-nowrap ${
                active ? "bg-white shadow-soft-1 text-iw-ink" : "text-iw-ink-muted hover:text-iw-ink"
              }`}
            >
              {LABELS[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
