"use client";

/**
 * Teacher assessment submit island (review screen).
 *
 * Owns the live elapsed timer and the submit → completion flow. On submit it
 * POSTs to the BFF with the wizard's `startedAtMs` (so elapsed reflects the
 * teacher's real session, not a server clock), then renders the completion
 * screen with the captured time, the honest visibility copy, and a graceful
 * "still syncing" note if the family-svc mirror deferred. The POST contract is
 * unchanged — it is what keeps the parent "Contributed" badge and brain-clone
 * collaborator fold in sync.
 *
 * Copy is hardcoded English (matches the rest of the rebuilt teacher flow).
 * Every state is designed: ready, submitting (busy), error (retry, answers
 * safe), success (completion hero). Reduced-motion friendly.
 */
import * as React from "react";
import Link from "next/link";
import { SubmittedHero } from "@aivo/ui";
import { SUCCESS_BTN, PRIMARY_BTN, SECONDARY_BTN, ClockIcon, ShieldIcon } from "@/components/teacher/assessment/shared";

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
        setErrorMsg(json.error?.userMessage ?? "Couldn't submit — your answers are safe. Please try again.");
        setPhase("error");
        return;
      }
      if (typeof json.data?.elapsedSeconds === "number") {
        setElapsedSeconds(json.data.elapsedSeconds);
      }
      setMirror(json.data?.mirror === "deferred" ? "deferred" : "written");
      setPhase("done");
    } catch {
      setErrorMsg("Couldn't submit — your answers are safe. Please try again.");
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <SubmittedHero
        eyebrow={`Thank you for sharing about ${learnerName}`}
        title={`Submitted in ${fmtClock(elapsedSeconds)}`}
        body={`Your classroom insights are now part of ${learnerName}'s plan. AIVO will use them to shape a learning experience that fits how ${learnerName} actually learns with you.`}
        next={[
          { label: `Feeds ${learnerName}'s brain-clone alongside the family's input` },
          { label: "Visible to the family and care team — never shared beyond the plan" },
          { label: "You can update your responses anytime" },
          ...(mirror === "deferred"
            ? [{ label: "Still syncing to the family view — it will appear shortly" }]
            : []),
        ]}
        primary={
          <Link href={backToLearnerHref} className={PRIMARY_BTN}>
            Back to {learnerName}
          </Link>
        }
        secondary={
          <Link href={rosterHref} className={SECONDARY_BTN}>
            Back to my learners
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm leading-relaxed text-iw-text-muted">
          When you submit, {learnerName}&rsquo;s family and care team will see that you
          contributed, and your insights join the brain-clone. You can come back and update
          your responses anytime.
        </p>
        <span
          className="inline-flex items-center gap-1.5 text-xs text-iw-text-muted"
          role="timer"
          aria-live="off"
        >
          <ClockIcon className="h-4 w-4" />
          <span className="tabular-nums">{fmtClock(elapsedSeconds)}</span>
        </span>
      </div>

      <p className="inline-flex items-center gap-1.5 text-xs text-iw-text-muted">
        <ShieldIcon className="h-4 w-4 text-[var(--aivo-sensory-primary)]" />
        Private to {learnerName}&rsquo;s family and care team.
      </p>

      {phase === "error" && errorMsg ? (
        <p
          role="alert"
          className="rounded-iw-card border border-[var(--aivo-color-status-error-default)] bg-[var(--aivo-color-status-error-subtle)] px-3 py-2 text-sm text-[var(--aivo-color-status-error-strong)]"
        >
          {errorMsg}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={phase === "submitting"}
          aria-busy={phase === "submitting"}
          className={SUCCESS_BTN}
        >
          {phase === "submitting"
            ? "Submitting…"
            : phase === "error"
              ? "Try again"
              : "Submit assessment"}
        </button>
      </div>
    </div>
  );
}
