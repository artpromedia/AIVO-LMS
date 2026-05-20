"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * States/OfflineBanner
 *
 * Slim, full-width banner that surfaces at the top of any page when
 * the client has lost connectivity or has pending sync items. Two
 * variants:
 *   offline       — "You're offline. Your work is saved on this device."
 *   sync_pending  — "Saving when you reconnect."
 *
 * The banner has role="status" + aria-live so screen readers announce
 * state changes. Pass an explicit `dismiss` action only when the
 * banner can be safely dismissed (e.g. sync_pending — never offline).
 */
export interface OfflineBannerProps {
  variant?: "offline" | "sync_pending";
  /** Override the headline. */
  message?: React.ReactNode;
  /** Optional retry action. */
  retry?: React.ReactNode;
  /** Optional dismiss action — only render for non-blocking variants. */
  dismiss?: React.ReactNode;
  className?: string;
}

export function OfflineBanner({
  variant = "offline",
  message,
  retry,
  dismiss,
  className,
}: OfflineBannerProps) {
  const isOffline = variant === "offline";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "w-full border-b",
        isOffline
          ? "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)] border-[var(--aivo-color-status-warning-default)]"
          : "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)] border-[var(--aivo-color-status-info-default)]",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-2 flex items-center gap-3 justify-between flex-wrap">
        <p className="text-xs font-semibold flex items-center gap-2">
          {isOffline ? (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
              <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
            </svg>
          )}
          {message ??
            (isOffline
              ? "You're offline. Your work is saved on this device — we'll sync when you reconnect."
              : "Sync pending. Your changes will save once we reconnect.")}
        </p>
        <div className="flex items-center gap-2">
          {retry}
          {dismiss}
        </div>
      </div>
    </div>
  );
}

OfflineBanner.displayName = "States/OfflineBanner";
