"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Primary CTA on the assessment/submitted screen.
 *
 * The destination (`/parent/learners/[id]/baseline/pending`) kicks off
 * `createBaseline` synchronously inside its server render before it
 * either redirects into the learner runner or renders the pending UI.
 * That call can take several seconds when brain-svc is cold, and with
 * a plain `<Link>` the App Router shows no feedback during that
 * window — the page just sits there and the parent quite reasonably
 * reports the button as "static / no clickthrough".
 *
 * Wrapping the navigation in `useTransition` lets us flip the button
 * into a disabled "Setting it up…" state immediately on click so the
 * parent always sees that the click was registered.
 *
 * Safety net: a transition can in principle stay pending indefinitely
 * if the destination RSC hangs (e.g. brain-svc unreachable). After
 * `STALL_MS` we surface a "still working…" message + a hard-refresh
 * link so the parent never gets stuck on an opaque spinner.
 */
const STALL_MS = 25_000;

export function SeeBaselineCta({ href }: { href: string }) {
  const router = useRouter();
  const t = useTranslations("parent.learner_assessment_submitted");
  const [isPending, startTransition] = useTransition();
  const [stalled, setStalled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPending) {
      setStalled(false);
      timerRef.current = setTimeout(() => setStalled(true), STALL_MS);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPending]);

  return (
    <div className="flex flex-col gap-2">
    <button
      type="button"
      onClick={() => {
        startTransition(() => {
          router.push(href);
        });
      }}
      disabled={isPending}
      aria-busy={isPending}
      className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_2px_6px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white disabled:cursor-progress disabled:opacity-80"
    >
      {isPending ? (
        <>
          <svg
            className="w-4 h-4 motion-safe:animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {t("setting_it_up")}
        </>
      ) : (
        <>
          {t("see_baseline_cta")}
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m13 5 7 7-7 7" />
          </svg>
        </>
      )}
    </button>
      {stalled ? (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-iw-text-muted leading-relaxed max-w-md"
        >
          This is taking longer than usual. Baseline generation can be slow on the first
          run.{" "}
          <a
            href={href}
            className="font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
          >
            Open the setup page directly
          </a>{" "}
          or try again in a minute.
        </p>
      ) : null}
    </div>
  );
}
