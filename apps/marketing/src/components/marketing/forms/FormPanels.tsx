"use client";
import Link from "next/link";
import type { ReactNode } from "react";

export function FormSuccessPanel({
  title = "Thanks — we got it.",
  body,
  primaryHref,
  primaryLabel = "Back to home",
  onSecondary,
  secondaryLabel,
}: {
  title?: string;
  body: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-iw-card border border-iw-success bg-iw-success-subtle p-8 text-center"
    >
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-iw-success-subtle text-iw-success-strong">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="font-heading text-xl font-bold text-iw-ink">{title}</h3>
      <div className="mt-2 font-body text-iw-ink">{body}</div>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {primaryHref ? (
          <Link
            href={primaryHref}
            className="rounded-iw-control bg-iw-success px-5 py-2 font-bold text-white shadow-soft-1 transition hover:bg-iw-success-strong"
          >
            {primaryLabel}
          </Link>
        ) : null}
        {onSecondary && secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondary}
            className="rounded-iw-control border border-iw-border bg-white px-5 py-2 font-bold text-iw-ink transition hover:border-iw-border"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FormErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-iw-card border border-iw-error bg-iw-error-subtle p-4 text-sm text-iw-error-strong"
    >
      <p className="font-semibold">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 font-bold underline underline-offset-2 hover:text-iw-error-strong"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
