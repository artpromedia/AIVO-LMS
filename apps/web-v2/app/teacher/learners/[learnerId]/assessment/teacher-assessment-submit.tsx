"use client";

/**
 * Sprint C-07 — Teacher assessment submit island (review screen).
 *
 * Owns the live elapsed timer and the submit → completion flow. On submit
 * it POSTs to the BFF with the wizard's `startedAtMs` (so elapsed reflects
 * the teacher's real session, not a server clock), then renders the
 * completion screen with the captured time, the honest visibility copy,
 * and a graceful "still syncing" note if the family-svc mirror deferred.
 *
 * Every state is designed: submitting (busy), error (retry, answers safe),
 * success (completion hero). Reduced-motion friendly — the only animation
 * is the SubmittedHero's motion-safe halo pulse.
 */
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SubmittedHero } from "@aivo/ui";

type Phase = "ready" | "submitting" | "error" | "done";

function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function TeacherAssessmentSubmit({
  learnerId,
  learnerName,
  startedAtMs,
  backToLearnerHref,
  rosterHref,
}: {
  learnerId: string;
  learnerName: string;
  startedAtMs: number;
  backToLearnerHref: string;
  rosterHref: string;
}) {
  const t = useTranslations("teacher.learner_assessment");
  const [phase, setPhase] = React.useState<Phase>("ready");
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(() =>
    Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)),
  );
  const [mirror, setMirror] = React.useState<"written" | "deferred">("written");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Live timer while the teacher is still on the review screen. Stops once
  // submitted (the captured elapsed value is frozen from the server).
  React.useEffect(() => {
    if (phase === "done") return;
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, startedAtMs]);

  async function submit() {
    setPhase("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/bff/learners/${learnerId}/teacher-assessment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startedAtMs }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { elapsedSeconds?: number; mirror?: "written" | "deferred" };
        error?: { userMessage?: string };
      };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error?.userMessage ?? t("review_submit_error"));
        setPhase("error");
        return;
      }
      if (typeof json.data?.elapsedSeconds === "number") {
        setElapsedSeconds(json.data.elapsedSeconds);
      }
      setMirror(json.data?.mirror === "deferred" ? "deferred" : "written");
      setPhase("done");
    } catch {
      setErrorMsg(t("review_submit_error"));
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <SubmittedHero
        eyebrow={t("done_eyebrow", { name: learnerName })}
        title={t("done_title", { time: fmtClock(elapsedSeconds) })}
        body={t("done_body", { name: learnerName })}
        next={[
          { label: t("done_next_clone_label", { name: learnerName }) },
          { label: t("done_next_visible_label") },
          { label: t("done_next_update_label") },
          ...(mirror === "deferred" ? [{ label: t("done_mirror_deferred") }] : []),
        ]}
        primary={
          <Link
            href={backToLearnerHref}
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2"
          >
            {t("done_back_to_learner", { name: learnerName })}
          </Link>
        }
        secondary={
          <Link
            href={rosterHref}
            className="inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2"
          >
            {t("done_back_to_roster")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-iw-text-muted leading-relaxed">
        {t("review_what_happens", { name: learnerName })}
      </p>

      <div
        className="flex items-center gap-2 text-xs text-iw-text-muted"
        aria-live="off"
        role="timer"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span className="tabular-nums">{fmtClock(elapsedSeconds)}</span>
      </div>

      {phase === "error" && errorMsg ? (
        <p
          role="alert"
          className="rounded-iw-card border border-[var(--aivo-color-status-error-default)] bg-[var(--aivo-color-status-error-subtle)] px-3 py-2 text-sm text-[var(--aivo-color-status-error-strong)]"
        >
          {errorMsg}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={phase === "submitting"}
        aria-busy={phase === "submitting"}
        className="inline-flex w-fit items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 active:brightness-95 shadow-[0_2px_6px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:pointer-events-none"
      >
        {phase === "submitting"
          ? t("review_submitting")
          : phase === "error"
            ? t("review_retry")
            : t("review_submit")}
      </button>
    </div>
  );
}
