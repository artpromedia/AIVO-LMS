/**
 * homework-svc session persistence.
 *
 * The in-memory SESSIONS Map in routes/homework-sessions.ts holds
 * ephemeral state for an in-flight practice session (current step,
 * collected events, problems). This module ALSO writes the session
 * to the relational store (`homework_assignments` + `homework_sessions`
 * from `@aivo/db`) so:
 *
 *   1. Compliance audits can query who practiced what, when.
 *   2. Sessions survive a service restart (the relational row stays
 *      even if the in-memory replay state is dropped).
 *   3. Sibling services (admin-svc, teacher dashboards) can read the
 *      session record via SQL rather than reaching into homework-svc.
 *
 * Failures NEVER break the learner-facing flow: when the DB write
 * fails or the service is running without a DATABASE_URL, we fall
 * back to the in-memory-only path and log a warn breadcrumb.
 */
import type { FastifyRequest } from "fastify";
import { homeworkAssignments, homeworkSessions } from "@aivo/db";

export interface PersistedSession {
  assignmentId: string;
  sessionId: string;
}

export interface PersistSessionInput {
  learnerId: string;
  subject: string;
  topic?: string;
  homeworkMode?: "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC";
  tutorSku?: string;
}

/**
 * Best-effort persistence: returns the new assignment + session ids on
 * success, undefined on failure (caller continues with in-memory only).
 *
 * `db` is the drizzle client; pass `null` to disable DB writes (e.g.
 * for unit tests that don't have a database available). The function
 * never throws — DB errors are logged via the request logger and the
 * promise resolves to undefined.
 */
export async function persistHomeworkSessionStart(
  db: any | null | undefined,
  request: FastifyRequest,
  input: PersistSessionInput,
): Promise<PersistedSession | undefined> {
  if (!db) return undefined;
  try {
    const [assignment] = await db
      .insert(homeworkAssignments)
      .values({
        learnerId: input.learnerId,
        subject: input.subject,
        homeworkMode: input.homeworkMode ?? "STANDARD",
        status: "IN_PROGRESS",
        extractedProblems: [],
        adaptedProblems: [],
        detectedSubject: input.topic ?? null,
      })
      .returning();
    if (!assignment) return undefined;
    const [session] = await db
      .insert(homeworkSessions)
      .values({
        homeworkAssignmentId: assignment.id,
        learnerId: input.learnerId,
        tutorSku: input.tutorSku ?? null,
        messages: [],
      })
      .returning();
    if (!session) return undefined;
    return { assignmentId: assignment.id, sessionId: session.id };
  } catch (err) {
    request.log.warn(
      {
        learnerId: input.learnerId,
        subject: input.subject,
        err: (err as Error).message,
      },
      "homework-svc DB persist failed (continuing with in-memory state only)",
    );
    return undefined;
  }
}
