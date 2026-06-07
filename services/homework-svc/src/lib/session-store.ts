import type { FastifyRequest } from "fastify";
import { homeworkAssignments, homeworkSessions } from "@aivo/db";
import { desc, eq } from "drizzle-orm";
import type { HomeworkStepState } from "../services/homework-step-engine.js";
import type {
  HomeworkProfile,
  adaptHomeworkForProfile,
} from "../services/homework-profile-adapter.js";

export interface HomeworkSessionRecord {
  id: string;
  assignmentId?: string;
  learnerId: string;
  tenantId: string;
  subject: string;
  topic?: string;
  profile?: HomeworkProfile;
  adaptation?: ReturnType<typeof adaptHomeworkForProfile>;
  stepState: HomeworkStepState;
  events: Array<{ at: string; eventType: string }>;
  problems: Array<{ id: string; prompt: string }>;
}

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
        runtimeState: {},
      })
      .returning();
    if (!session) return undefined;
    return { assignmentId: assignment.id, sessionId: session.id };
  } catch (err) {
    if (process.env.NODE_ENV === "production") throw err;
    request.log.warn(
      { learnerId: input.learnerId, subject: input.subject, err: (err as Error).message },
      "homework-svc DB persist failed; using non-production memory fallback",
    );
    return undefined;
  }
}

function isSessionRecord(value: unknown): value is HomeworkSessionRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HomeworkSessionRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.learnerId === "string" &&
    typeof candidate.tenantId === "string" &&
    typeof candidate.subject === "string" &&
    Boolean(candidate.stepState) &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.problems)
  );
}

export async function persistHomeworkSessionState(
  db: any | null | undefined,
  session: HomeworkSessionRecord,
): Promise<void> {
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("homework-svc cannot persist session state without a database");
    }
    return;
  }

  const [updated] = await db
    .update(homeworkSessions)
    .set({
      runtimeState: session,
      messages: session.events,
      problemsAttempted: session.stepState.history.length,
      problemsCompleted: session.stepState.currentStep === "complete" ? session.problems.length : 0,
      endedAt: session.stepState.currentStep === "complete" ? new Date() : null,
    })
    .where(eq(homeworkSessions.id, session.id))
    .returning({ id: homeworkSessions.id });

  if (!updated) {
    throw new Error(`homework-svc session row not found while persisting state: ${session.id}`);
  }

  if (session.assignmentId && session.stepState.currentStep === "complete") {
    await db
      .update(homeworkAssignments)
      .set({ status: "COMPLETED" })
      .where(eq(homeworkAssignments.id, session.assignmentId));
  }
}

export async function loadHomeworkSessionState(
  db: any | null | undefined,
  sessionId: string,
): Promise<HomeworkSessionRecord | undefined> {
  if (!db) return undefined;
  const [row] = await db
    .select({ runtimeState: homeworkSessions.runtimeState })
    .from(homeworkSessions)
    .where(eq(homeworkSessions.id, sessionId))
    .limit(1);
  return isSessionRecord(row?.runtimeState) ? row.runtimeState : undefined;
}

export async function listHomeworkSessionStates(
  db: any | null | undefined,
  learnerId: string,
): Promise<HomeworkSessionRecord[]> {
  if (!db) return [];
  const rows = await db
    .select({ runtimeState: homeworkSessions.runtimeState })
    .from(homeworkSessions)
    .where(eq(homeworkSessions.learnerId, learnerId))
    .orderBy(desc(homeworkSessions.startedAt))
    .limit(50);
  return rows
    .map((row: { runtimeState: unknown }) => row.runtimeState)
    .filter(isSessionRecord);
}
