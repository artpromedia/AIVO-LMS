"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * States/StateCard
 *
 * Catch-all calm state card for every dead-end the app can hit:
 * permission-blocked, locked-role, consent-required, payment-failed,
 * curriculum-alignment-missing, upload-failed, safety-blocked.
 *
 * Sprint 19 spec: no dead-end screens — every state has a clear next
 * action. The `kind` prop drives the icon tint + ribbon copy; the
 * host page is responsible for the `action` slot.
 */
export type StateKind =
  | "blocked_permission"
  | "blocked_role"
  | "blocked_safety"
  | "consent_required"
  | "payment_failed"
  | "alignment_missing"
  | "upload_failed"
  | "offline"
  | "sync_pending"
  | "rate_limited"
  | "unavailable";

export interface StateCardProps {
  kind: StateKind;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Primary action (typically a Link or button). */
  action?: React.ReactNode;
  /** Optional secondary action. */
  secondary?: React.ReactNode;
  /** Optional support hint at the bottom. */
  support?: React.ReactNode;
  className?: string;
}

const KIND_TINT: Record<StateKind, { ribbon: string; halo: string; label: string }> = {
  blocked_permission: {
    ribbon:
      "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)] border-[var(--aivo-color-status-warning-default)]",
    halo: "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)]",
    label: "Permission needed",
  },
  blocked_role: {
    ribbon: "bg-[var(--aivo-color-surface-muted)] text-iw-text-strong border-iw-border",
    halo: "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted",
    label: "Not in this role",
  },
  blocked_safety: {
    ribbon:
      "bg-[var(--aivo-color-status-error-subtle)] text-[var(--aivo-color-status-error-strong)] border-[var(--aivo-color-status-error-default)]",
    halo: "bg-[var(--aivo-color-status-error-subtle)] text-[var(--aivo-color-status-error-strong)]",
    label: "Safety hold",
  },
  consent_required: {
    ribbon:
      "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]",
    halo: "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)]",
    label: "Consent needed",
  },
  payment_failed: {
    ribbon:
      "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)] border-[var(--aivo-color-status-warning-default)]",
    halo: "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)]",
    label: "Payment needs a touch",
  },
  alignment_missing: {
    ribbon:
      "bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] border-[var(--aivo-color-aivoOrange-100)]",
    halo: "bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)]",
    label: "Curriculum alignment",
  },
  upload_failed: {
    ribbon:
      "bg-[var(--aivo-color-status-error-subtle)] text-[var(--aivo-color-status-error-strong)] border-[var(--aivo-color-status-error-default)]",
    halo: "bg-[var(--aivo-color-status-error-subtle)] text-[var(--aivo-color-status-error-strong)]",
    label: "Upload didn't go through",
  },
  offline: {
    ribbon:
      "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)] border-[var(--aivo-color-status-info-default)]",
    halo: "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)]",
    label: "Offline",
  },
  sync_pending: {
    ribbon:
      "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)] border-[var(--aivo-color-status-info-default)]",
    halo: "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)]",
    label: "Sync pending",
  },
  rate_limited: {
    ribbon: "bg-[var(--aivo-color-surface-muted)] text-iw-text-strong border-iw-border",
    halo: "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted",
    label: "Easy does it",
  },
  unavailable: {
    ribbon: "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted border-iw-border",
    halo: "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted",
    label: "Temporarily unavailable",
  },
};

const KIND_ICON: Record<StateKind, React.ReactNode> = {
  blocked_permission: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  blocked_role: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  blocked_safety: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  consent_required: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <path d="M9 11l3 3 8-8" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  payment_failed: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  alignment_missing: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  upload_failed: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  offline: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  sync_pending: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  ),
  rate_limited: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  unavailable: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

export function StateCard({
  kind,
  title,
  body,
  action,
  secondary,
  support,
  className,
}: StateCardProps) {
  const tint = KIND_TINT[kind];
  return (
    <section
      role={
        kind === "blocked_safety" || kind === "upload_failed" || kind === "payment_failed"
          ? "alert"
          : "status"
      }
      aria-live={
        kind === "blocked_safety" || kind === "upload_failed" || kind === "payment_failed"
          ? "assertive"
          : "polite"
      }
      className={cn(
        "rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-5 md:p-8 flex flex-col gap-4",
        className,
      )}
    >
      <header className="flex items-start gap-4">
        <span
          className={cn(
            "shrink-0 w-12 h-12 rounded-iw-control flex items-center justify-center",
            tint.halo,
          )}
          aria-hidden="true"
        >
          {KIND_ICON[kind]}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <span
            className={cn(
              "inline-flex items-center self-start px-2.5 py-0.5 rounded-iw-chip border text-[10px] font-semibold uppercase tracking-wide",
              tint.ribbon,
            )}
          >
            {tint.label}
          </span>
          <h3 className="text-xl md:text-2xl font-semibold text-iw-text-strong leading-snug">
            {title}
          </h3>
          {body ? (
            <p className="text-sm md:text-base text-iw-text-muted leading-relaxed max-w-2xl">
              {body}
            </p>
          ) : null}
        </div>
      </header>
      {(action || secondary) && (
        <footer className="flex items-center gap-3 flex-wrap pt-2 border-t border-iw-border">
          {action}
          {secondary}
        </footer>
      )}
      {support ? <p className="text-xs text-iw-text-muted leading-relaxed">{support}</p> : null}
    </section>
  );
}

StateCard.displayName = "States/StateCard";
