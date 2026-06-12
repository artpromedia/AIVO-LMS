"use client";

/**
 * Lesson-run network layer — every write the player makes, in one module.
 *
 * Replaces the player's six inline `fetch().catch(() => {})` sites with the
 * typed BFF client plus the existing idempotent offline outbox:
 *
 *   - step / start / telemetry: fire-and-queue. On any transport failure the
 *     payload lands in the outbox under its Idempotency-Key and replays on
 *     reconnect; the first queue event per run surfaces a calm toast so the
 *     learner knows their work is safe (never silent, never nagging).
 *   - complete: awaited. Online failure → inline error (existing UX);
 *     offline → queued + toast, and the learner continues home — mastery
 *     lands when the outbox drains.
 *
 * Agent-session calls stay in the player: they are explicitly
 * never-load-bearing (documented there) and time-box themselves.
 */
import { bffFetch, isNetworkError } from "@/lib/api/client";
import { enqueueOutbox, generateIdempotencyKey } from "@/lib/offline/outbox";

export interface LessonRunApiOptions {
  learnerId: string;
  lessonRunId: string;
  /** Already-translated copy for the offline-queued toast. */
  onQueuedOffline: (kind: "step" | "complete") => void;
}

export interface LessonRunApi {
  markStarted: () => void;
  postStep: (payload: Record<string, unknown>) => void;
  postSurfaceTelemetry: (payload: Record<string, unknown>) => void;
  /** Resolves true when the run is completed (or safely queued offline). */
  complete: (body: Record<string, unknown>) => Promise<{ done: boolean }>;
}

function queue(
  url: string,
  body: string,
  idemKey: string,
  label: string,
): void {
  void enqueueOutbox({
    id: idemKey,
    url,
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idemKey },
    body,
    label,
  }).catch(() => {
    // Storage unavailable (private mode quota). Nothing else to do client-
    // side; the server derives progress from prior recorded interactions.
  });
}

export function createLessonRunApi(opts: LessonRunApiOptions): LessonRunApi {
  const base = `/api/bff/learners/${opts.learnerId}/lesson-runs/${opts.lessonRunId}`;
  let queuedToastShown = false;

  const notifyQueued = (kind: "step" | "complete") => {
    if (kind === "step" && queuedToastShown) return;
    queuedToastShown = true;
    opts.onQueuedOffline(kind);
  };

  const fireAndQueue = (url: string, payload: Record<string, unknown>, label: string) => {
    const idemKey = generateIdempotencyKey(label);
    const body = JSON.stringify(payload);
    bffFetch(url, { method: "POST", body: payload, idempotencyKey: idemKey }).catch((e) => {
      queue(url, body, idemKey, label);
      if (isNetworkError(e)) notifyQueued("step");
      // Non-network BFF rejections (e.g. expired session) also queue: the
      // outbox replays with auth restored, and the server's idempotency key
      // keeps replays single-shot.
    });
  };

  return {
    markStarted() {
      fireAndQueue(`${base}/start`, {}, "lesson-start");
    },
    postStep(payload) {
      fireAndQueue(`${base}/step`, payload, "lesson-step");
    },
    postSurfaceTelemetry(payload) {
      fireAndQueue("/api/learning/surface-telemetry", payload, "surface-telemetry");
    },
    async complete(body) {
      const idemKey = generateIdempotencyKey("lesson-complete");
      try {
        await bffFetch(`${base}/complete`, {
          method: "POST",
          body,
          idempotencyKey: idemKey,
        });
        return { done: true };
      } catch (e) {
        if (isNetworkError(e)) {
          queue(`${base}/complete`, JSON.stringify(body), idemKey, "lesson-complete");
          notifyQueued("complete");
          return { done: true };
        }
        return { done: false };
      }
    },
  };
}
