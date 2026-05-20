"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /parent/home-v2 — error boundary.
 *
 * Calm by default. Never blames the parent. Never says "exception"
 * or "stack trace". Offers one clear primary action (retry) and one
 * secondary (go to legacy home).
 */
export default function ParentHomeV2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[parent/home-v2]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas,#f4f6f5)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-iw-card-lg bg-white border border-iw-border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)] p-8 flex flex-col gap-4 text-center">
        <div className="self-center inline-flex items-center justify-center h-14 w-14 rounded-full bg-[var(--aivo-status-warning-subtle,#fef3c7)] text-[var(--aivo-status-warning-strong,#b45309)]">
          <AivoIcon name="safetyFlag" size={28} />
        </div>
        <h1 className="text-xl font-semibold text-iw-text-strong">
          We couldn't load your home just now.
        </h1>
        <p className="text-sm text-iw-text-muted">
          Nothing has changed for your learner. Try again — and if it
          keeps happening, the legacy home is still available.
        </p>
        {error.digest ? (
          <p className="text-xs text-iw-text-muted">
            Reference: <code className="px-1 rounded bg-iw-card">{error.digest}</code>
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold hover:opacity-95"
          >
            Try again
          </button>
          <Link
            href="/parent/home"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-iw-control bg-white text-iw-text-strong font-semibold border border-iw-border hover:border-iw-text-muted"
          >
            Open legacy home
          </Link>
        </div>
      </div>
    </main>
  );
}
