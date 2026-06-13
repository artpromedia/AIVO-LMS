"use client";

/**
 * Sprint C-15 — readiness-screen suggestion for switch/AAC learners.
 *
 * When the parent assessment recorded a switch or eye-gaze response method
 * (`shouldSuggestButtonFriendlyMode`), the readiness screen offers — gently —
 * to set up button-friendly (switch) steering. This is a SUGGESTION only:
 *
 *   - It NEVER auto-enables scanning. Activation is always an explicit choice
 *     on the learner a11y settings page; this card just links there.
 *   - It is dismissible and never blocks the "I'm ready" path — dismissing
 *     hides it for the session (sessionStorage) so it doesn't nag.
 *
 * Copy comes through i18n (child-readable, strengths-first). The card sits
 * above the readiness checklist as a calm, optional nudge.
 */
import { useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "aivo.baseline.buttonFriendly.dismissed";

export function ButtonFriendlySuggestion({
  title,
  body,
  cta,
  dismissLabel,
  settingsHref,
}: {
  title: string;
  body: string;
  cta: string;
  dismissLabel: string;
  settingsHref: string;
}) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  return (
    <section
      className="rounded-iw-card-lg border border-[var(--aivo-aivoPurple-200)] bg-[var(--aivo-aivoPurple-50)] p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 w-10 h-10 shrink-0 rounded-iw-control bg-white text-[var(--aivo-aivoPurple-700)] flex items-center justify-center"
          aria-hidden="true"
        >
          {/* A switch/button glyph. */}
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="8" width="18" height="8" rx="4" />
            <circle cx="8" cy="12" r="2" />
          </svg>
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-iw-text-strong">{title}</p>
          <p className="text-sm text-iw-text-muted leading-relaxed">{body}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={settingsHref}
          className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
        >
          {cta}
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              window.sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* sessionStorage unavailable — still hide for this render */
            }
            setDismissed(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
        >
          {dismissLabel}
        </button>
      </div>
    </section>
  );
}
