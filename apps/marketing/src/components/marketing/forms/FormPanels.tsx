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
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center"
    >
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="font-heading text-xl font-bold text-slate-900">{title}</h3>
      <div className="mt-2 font-body text-slate-700">{body}</div>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {primaryHref ? (
          <Link
            href={primaryHref}
            className="rounded-full bg-emerald-600 px-5 py-2 font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            {primaryLabel}
          </Link>
        ) : null}
        {onSecondary && secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondary}
            className="rounded-full border border-slate-300 bg-white px-5 py-2 font-bold text-slate-700 transition hover:border-slate-400"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FormErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
    >
      <p className="font-semibold">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 font-bold underline underline-offset-2 hover:text-rose-900"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
