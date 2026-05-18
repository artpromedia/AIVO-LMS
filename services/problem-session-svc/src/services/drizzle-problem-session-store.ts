/**
 * Drizzle-backed implementation of `ProblemSessionStore`. Wires the four
 * ledger tables defined in `@aivo/db` (problem_sessions,
 * problem_session_events, problem_session_surface_snapshots,
 * problem_session_attempts) behind the same interface the in-memory
 * store exposes, so the service code is unchanged.
 *
 * Production wires this when `DATABASE_URL` is set:
 *
 *   const db = createDb(process.env.DATABASE_URL);
 *   const store = new DrizzleProblemSessionStore(db);
 *   const app = await buildApp({ store });
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@aivo/db";
import {
  problemSessions,
  problemSessionEvents,
  problemSessionAttempts,
  problemSessionSurfaceSnapshots,
} from "@aivo/db";
import { redactSensitivePayload } from "./problem-session-redaction.js";
import type {
  AppendAttemptInput,
  AppendEventInput,
  AppendSnapshotInput,
  CreateProblemSessionInput,
  ProblemSessionAttemptRecord,
  ProblemSessionEventRecord,
  ProblemSessionRecord,
  ProblemSessionSnapshotRecord,
  ProblemSessionStore,
} from "./problem-session-store.js";
import { ProblemSessionNotFoundError } from "./problem-session-store.js";

function toIso(value: Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  return value.toISOString();
}

function toSessionRecord(row: typeof problemSessions.$inferSelect): ProblemSessionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    learnerId: row.learnerId,
    subject: row.subject,
    skillCode: row.skillCode ?? undefined,
    standardCode: row.standardCode ?? undefined,
    source: row.source as ProblemSessionRecord["source"],
    sourceSessionId: row.sourceSessionId ?? undefined,
    tutorSku: row.tutorSku ?? undefined,
    status: (row.status ?? "active") as ProblemSessionRecord["status"],
    startedAt: toIso(row.startedAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : undefined,
    metadata: (row.metadataJson as Record<string, unknown>) ?? {},
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function toEventRecord(row: typeof problemSessionEvents.$inferSelect): ProblemSessionEventRecord {
  return {
    id: row.id,
    problemSessionId: row.problemSessionId,
    tenantId: row.tenantId,
    learnerId: row.learnerId,
    eventType: row.eventType,
    eventPayload: (row.eventPayloadJson as Record<string, unknown>) ?? {},
    redactedPayload: (row.redactedPayloadJson as Record<string, unknown>) ?? {},
    occurredAt: toIso(row.occurredAt),
    createdAt: toIso(row.createdAt),
  };
}

function toAttemptRecord(
  row: typeof problemSessionAttempts.$inferSelect,
): ProblemSessionAttemptRecord {
  return {
    id: row.id,
    problemSessionId: row.problemSessionId,
    attemptNumber: row.attemptNumber,
    response: (row.responseJson as Record<string, unknown>) ?? {},
    correct: Boolean(row.correct),
    score: row.score ?? undefined,
    latencyMs: row.latencyMs ?? 0,
    hintCount: row.hintCount ?? 0,
    eraserCount: row.eraserCount ?? 0,
    toolChangeCount: row.toolChangeCount ?? 0,
    createdAt: toIso(row.createdAt),
  };
}

function toSnapshotRecord(
  row: typeof problemSessionSurfaceSnapshots.$inferSelect,
): ProblemSessionSnapshotRecord {
  return {
    id: row.id,
    problemSessionId: row.problemSessionId,
    surfaceId: row.surfaceId,
    snapshotType: row.snapshotType as ProblemSessionSnapshotRecord["snapshotType"],
    snapshot: (row.snapshotJson as Record<string, unknown>) ?? {},
    storageUrl: row.storageUrl ?? undefined,
    strokeCount: row.strokeCount ?? 0,
    createdAt: toIso(row.createdAt),
  };
}

export class DrizzleProblemSessionStore implements ProblemSessionStore {
  constructor(private readonly db: Database) {}

  async createSession(input: CreateProblemSessionInput): Promise<ProblemSessionRecord> {
    const [row] = await this.db
      .insert(problemSessions)
      .values({
        tenantId: input.tenantId,
        learnerId: input.learnerId,
        subject: input.subject,
        skillCode: input.skillCode,
        standardCode: input.standardCode,
        source: input.source,
        sourceSessionId: input.sourceSessionId,
        tutorSku: input.tutorSku,
        status: "active",
        metadataJson: input.metadata ?? {},
      })
      .returning();
    return toSessionRecord(row);
  }

  async getSession(id: string): Promise<ProblemSessionRecord | undefined> {
    const [row] = await this.db.select().from(problemSessions).where(eq(problemSessions.id, id));
    return row ? toSessionRecord(row) : undefined;
  }

  async completeSession(id: string): Promise<ProblemSessionRecord | undefined> {
    const [row] = await this.db
      .update(problemSessions)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(problemSessions.id, id))
      .returning();
    return row ? toSessionRecord(row) : undefined;
  }

  async appendEvent(input: AppendEventInput): Promise<ProblemSessionEventRecord> {
    const session = await this.getSession(input.problemSessionId);
    if (!session) throw new ProblemSessionNotFoundError(input.problemSessionId);
    const { redactedPayload } = redactSensitivePayload(input.payload ?? {});
    const [row] = await this.db
      .insert(problemSessionEvents)
      .values({
        problemSessionId: input.problemSessionId,
        tenantId: session.tenantId,
        learnerId: session.learnerId,
        eventType: input.eventType,
        eventPayloadJson: input.payload ?? {},
        redactedPayloadJson: redactedPayload,
      })
      .returning();
    return toEventRecord(row);
  }

  async appendAttempt(input: AppendAttemptInput): Promise<ProblemSessionAttemptRecord> {
    const session = await this.getSession(input.problemSessionId);
    if (!session) throw new ProblemSessionNotFoundError(input.problemSessionId);
    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(problemSessionAttempts)
      .where(eq(problemSessionAttempts.problemSessionId, input.problemSessionId));
    const attemptNumber = Number(countRow?.count ?? 0) + 1;
    const [row] = await this.db
      .insert(problemSessionAttempts)
      .values({
        problemSessionId: input.problemSessionId,
        attemptNumber,
        responseJson: input.response,
        correct: input.correct,
        score: input.score,
        latencyMs: input.latencyMs ?? 0,
        hintCount: input.hintCount ?? 0,
        eraserCount: input.eraserCount ?? 0,
        toolChangeCount: input.toolChangeCount ?? 0,
      })
      .returning();
    return toAttemptRecord(row);
  }

  async appendSnapshot(input: AppendSnapshotInput): Promise<ProblemSessionSnapshotRecord> {
    const session = await this.getSession(input.problemSessionId);
    if (!session) throw new ProblemSessionNotFoundError(input.problemSessionId);
    const [row] = await this.db
      .insert(problemSessionSurfaceSnapshots)
      .values({
        problemSessionId: input.problemSessionId,
        surfaceId: input.surfaceId,
        snapshotType: input.snapshotType,
        snapshotJson: input.snapshot,
        storageUrl: input.storageUrl,
        strokeCount: input.strokeCount ?? 0,
      })
      .returning();
    return toSnapshotRecord(row);
  }

  async listEventsForSession(problemSessionId: string): Promise<ProblemSessionEventRecord[]> {
    const rows = await this.db
      .select()
      .from(problemSessionEvents)
      .where(eq(problemSessionEvents.problemSessionId, problemSessionId))
      .orderBy(problemSessionEvents.occurredAt);
    return rows.map(toEventRecord);
  }

  async listAttemptsForSession(problemSessionId: string): Promise<ProblemSessionAttemptRecord[]> {
    const rows = await this.db
      .select()
      .from(problemSessionAttempts)
      .where(eq(problemSessionAttempts.problemSessionId, problemSessionId))
      .orderBy(problemSessionAttempts.attemptNumber);
    return rows.map(toAttemptRecord);
  }

  async listSnapshotsForSession(problemSessionId: string): Promise<ProblemSessionSnapshotRecord[]> {
    const rows = await this.db
      .select()
      .from(problemSessionSurfaceSnapshots)
      .where(eq(problemSessionSurfaceSnapshots.problemSessionId, problemSessionId))
      .orderBy(problemSessionSurfaceSnapshots.createdAt);
    return rows.map(toSnapshotRecord);
  }

  async listRecentForLearner(learnerId: string, limit = 20): Promise<ProblemSessionRecord[]> {
    const rows = await this.db
      .select()
      .from(problemSessions)
      .where(eq(problemSessions.learnerId, learnerId))
      .orderBy(desc(problemSessions.startedAt))
      .limit(Math.min(limit, 100));
    return rows.map(toSessionRecord);
  }
}
