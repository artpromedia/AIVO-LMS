import { randomUUID } from "node:crypto";
import { redactSensitivePayload } from "./problem-session-redaction.js";

export interface ProblemSessionRecord {
  id: string;
  tenantId: string;
  learnerId: string;
  subject: string;
  skillCode?: string;
  standardCode?: string;
  source: "baseline" | "lesson" | "homework" | "tutor_chat" | "practice";
  sourceSessionId?: string;
  tutorSku?: string;
  status: "active" | "completed" | "abandoned";
  startedAt: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemSessionEventRecord {
  id: string;
  problemSessionId: string;
  tenantId: string;
  learnerId: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  redactedPayload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface ProblemSessionAttemptRecord {
  id: string;
  problemSessionId: string;
  attemptNumber: number;
  response: Record<string, unknown>;
  correct: boolean;
  score?: number;
  latencyMs: number;
  hintCount: number;
  eraserCount: number;
  toolChangeCount: number;
  createdAt: string;
}

export interface ProblemSessionSnapshotRecord {
  id: string;
  problemSessionId: string;
  surfaceId: string;
  snapshotType: "ink" | "diagram" | "annotation" | "text" | "answer";
  snapshot: Record<string, unknown>;
  storageUrl?: string;
  strokeCount: number;
  createdAt: string;
}

export interface CreateProblemSessionInput {
  tenantId: string;
  learnerId: string;
  subject: string;
  skillCode?: string;
  standardCode?: string;
  source: ProblemSessionRecord["source"];
  sourceSessionId?: string;
  tutorSku?: string;
  metadata?: Record<string, unknown>;
}

export interface AppendEventInput {
  problemSessionId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export interface AppendAttemptInput {
  problemSessionId: string;
  response: Record<string, unknown>;
  correct: boolean;
  score?: number;
  latencyMs?: number;
  hintCount?: number;
  eraserCount?: number;
  toolChangeCount?: number;
}

export interface AppendSnapshotInput {
  problemSessionId: string;
  surfaceId: string;
  snapshotType: ProblemSessionSnapshotRecord["snapshotType"];
  snapshot: Record<string, unknown>;
  storageUrl?: string;
  strokeCount?: number;
}

export interface ProblemSessionStore {
  createSession(input: CreateProblemSessionInput): Promise<ProblemSessionRecord>;
  getSession(id: string): Promise<ProblemSessionRecord | undefined>;
  completeSession(id: string): Promise<ProblemSessionRecord | undefined>;
  appendEvent(input: AppendEventInput): Promise<ProblemSessionEventRecord>;
  appendAttempt(input: AppendAttemptInput): Promise<ProblemSessionAttemptRecord>;
  appendSnapshot(input: AppendSnapshotInput): Promise<ProblemSessionSnapshotRecord>;
  listEventsForSession(problemSessionId: string): Promise<ProblemSessionEventRecord[]>;
  listAttemptsForSession(problemSessionId: string): Promise<ProblemSessionAttemptRecord[]>;
  listSnapshotsForSession(problemSessionId: string): Promise<ProblemSessionSnapshotRecord[]>;
  listRecentForLearner(learnerId: string, limit?: number): Promise<ProblemSessionRecord[]>;
}

export class ProblemSessionNotFoundError extends Error {
  constructor(id: string) {
    super(`Problem session not found: ${id}`);
    this.name = "ProblemSessionNotFoundError";
  }
}

export class InMemoryProblemSessionStore implements ProblemSessionStore {
  private readonly sessions = new Map<string, ProblemSessionRecord>();
  private readonly events = new Map<string, ProblemSessionEventRecord[]>();
  private readonly attempts = new Map<string, ProblemSessionAttemptRecord[]>();
  private readonly snapshots = new Map<string, ProblemSessionSnapshotRecord[]>();

  private requireSession(id: string): ProblemSessionRecord {
    const session = this.sessions.get(id);
    if (!session) {
      throw new ProblemSessionNotFoundError(id);
    }
    return session;
  }

  async createSession(input: CreateProblemSessionInput): Promise<ProblemSessionRecord> {
    const now = new Date().toISOString();
    const record: ProblemSessionRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      learnerId: input.learnerId,
      subject: input.subject,
      skillCode: input.skillCode,
      standardCode: input.standardCode,
      source: input.source,
      sourceSessionId: input.sourceSessionId,
      tutorSku: input.tutorSku,
      status: "active",
      startedAt: now,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(record.id, record);
    this.events.set(record.id, []);
    this.attempts.set(record.id, []);
    this.snapshots.set(record.id, []);
    return record;
  }

  async getSession(id: string): Promise<ProblemSessionRecord | undefined> {
    return this.sessions.get(id);
  }

  async completeSession(id: string): Promise<ProblemSessionRecord | undefined> {
    const existing = this.sessions.get(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const updated: ProblemSessionRecord = {
      ...existing,
      status: "completed",
      completedAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async appendEvent(input: AppendEventInput): Promise<ProblemSessionEventRecord> {
    const session = this.requireSession(input.problemSessionId);
    const { redactedPayload } = redactSensitivePayload(input.payload ?? {});
    const now = new Date().toISOString();
    const record: ProblemSessionEventRecord = {
      id: randomUUID(),
      problemSessionId: input.problemSessionId,
      tenantId: session.tenantId,
      learnerId: session.learnerId,
      eventType: input.eventType,
      eventPayload: input.payload ?? {},
      redactedPayload,
      occurredAt: now,
      createdAt: now,
    };
    const list = this.events.get(input.problemSessionId) ?? [];
    list.push(record);
    this.events.set(input.problemSessionId, list);
    return record;
  }

  async appendAttempt(input: AppendAttemptInput): Promise<ProblemSessionAttemptRecord> {
    this.requireSession(input.problemSessionId);
    const existing = this.attempts.get(input.problemSessionId) ?? [];
    const attemptNumber = existing.length + 1;
    const record: ProblemSessionAttemptRecord = {
      id: randomUUID(),
      problemSessionId: input.problemSessionId,
      attemptNumber,
      response: input.response,
      correct: input.correct,
      score: input.score,
      latencyMs: input.latencyMs ?? 0,
      hintCount: input.hintCount ?? 0,
      eraserCount: input.eraserCount ?? 0,
      toolChangeCount: input.toolChangeCount ?? 0,
      createdAt: new Date().toISOString(),
    };
    existing.push(record);
    this.attempts.set(input.problemSessionId, existing);
    return record;
  }

  async appendSnapshot(input: AppendSnapshotInput): Promise<ProblemSessionSnapshotRecord> {
    this.requireSession(input.problemSessionId);
    const record: ProblemSessionSnapshotRecord = {
      id: randomUUID(),
      problemSessionId: input.problemSessionId,
      surfaceId: input.surfaceId,
      snapshotType: input.snapshotType,
      snapshot: input.snapshot,
      storageUrl: input.storageUrl,
      strokeCount: input.strokeCount ?? 0,
      createdAt: new Date().toISOString(),
    };
    const existing = this.snapshots.get(input.problemSessionId) ?? [];
    existing.push(record);
    this.snapshots.set(input.problemSessionId, existing);
    return record;
  }

  async listEventsForSession(problemSessionId: string): Promise<ProblemSessionEventRecord[]> {
    return [...(this.events.get(problemSessionId) ?? [])];
  }

  async listAttemptsForSession(problemSessionId: string): Promise<ProblemSessionAttemptRecord[]> {
    return [...(this.attempts.get(problemSessionId) ?? [])];
  }

  async listSnapshotsForSession(problemSessionId: string): Promise<ProblemSessionSnapshotRecord[]> {
    return [...(this.snapshots.get(problemSessionId) ?? [])];
  }

  async listRecentForLearner(learnerId: string, limit = 20): Promise<ProblemSessionRecord[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session.learnerId === learnerId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }
}
