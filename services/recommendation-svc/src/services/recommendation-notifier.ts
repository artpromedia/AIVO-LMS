/**
 * Guardian notification for newly-persisted PENDING recommendations
 * (adaptive-learning E2E Sprint 5).
 *
 * recommendation-svc resolves the learner's guardian (learners.parent_id →
 * users) and hands delivery to comms-svc's internal recommendation-pending
 * endpoint, which owns the email + in-app fan-out AND the 24h-per-learner
 * digest suppression (durable, against its own notification table).
 * Fire-and-forget by contract: the candidate pipeline must never fail
 * because notification delivery hiccuped.
 */
import { eq } from "drizzle-orm";
import { learners, users } from "@aivo/db";
import type { ProfileRecommendation } from "./types.js";

const COMMS_SVC_URL = process.env.COMMS_SVC_URL ?? "http://localhost:3007";

interface LogLike {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
}

interface DbLike {
  select: (...args: never[]) => unknown;
}

export async function notifyGuardianOfPending(
  dbLike: DbLike,
  log: LogLike,
  input: { learnerId: string; recommendations: ProfileRecommendation[] },
): Promise<void> {
  if (input.recommendations.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = dbLike as any;
  try {
    const [learner] = await db
      .select({ id: learners.id, name: learners.name, parentId: learners.parentId })
      .from(learners)
      .where(eq(learners.id, input.learnerId));
    if (!learner?.parentId) {
      log.warn(
        { event: "recommendation.notify_skipped", learnerId: input.learnerId },
        "[recommendation-notifier] learner or guardian not found; no notification sent",
      );
      return;
    }
    const [guardian] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, learner.parentId));

    const res = await fetch(`${COMMS_SVC_URL}/api/comms/internal/recommendation-pending`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key":
          process.env.INTERNAL_SERVICE_KEY ||
          (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key"),
      },
      body: JSON.stringify({
        parentId: learner.parentId,
        parentEmail: guardian?.email ?? null,
        learnerId: learner.id,
        learnerName: learner.name,
        count: input.recommendations.length,
        topTitle: input.recommendations[0]!.title,
      }),
    });
    const outcome = (await res.json().catch(() => ({}))) as { status?: string };
    log.info(
      {
        event: "recommendation.notify",
        learnerId: input.learnerId,
        count: input.recommendations.length,
        outcome: outcome.status ?? res.status,
      },
      "[recommendation-notifier] guardian notification dispatched",
    );
  } catch (err) {
    log.warn(
      {
        event: "recommendation.notify_failed",
        learnerId: input.learnerId,
        err: err instanceof Error ? err.message : String(err),
      },
      "[recommendation-notifier] notification failed (non-fatal)",
    );
  }
}
