/**
 * Zod schemas for the `learning-svc` HTTP surface used by the lesson
 * player (Sprint 1, Gap #3). These mirror the Fastify route schemas in
 * `services/learning-svc/src/routes/schemas.ts` so request/response
 * payloads are validated on the client side and we get inferred
 * TypeScript types without hand-writing them.
 *
 * Drift is caught by `__tests__/schema-pinning.test.ts`: it imports the
 * upstream JSON Schema definitions and asserts that every operation
 * we ship a Zod schema for still exists upstream with the same
 * required-field set. When sessions.ts changes shape, that test (and
 * therefore the package build) breaks.
 */
import { z } from "zod";

// ---- Shared primitives ---------------------------------------------------

export const ErrorEnvelope = z
  .object({
    error: z.string(),
  })
  .passthrough();
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export const SessionRow = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    learnerId: z.string(),
    tutorSku: z.string(),
    subject: z.string(),
    status: z.string(),
    contentType: z.string().optional(),
    functioningLevel: z.string().nullable().optional(),
    durationSeconds: z.number().int().optional(),
    xpEarned: z.number().nullable().optional(),
    startedAt: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    sessionData: z.record(z.unknown()).nullable().optional(),
    masteryAfter: z.record(z.unknown()).nullable().optional(),
    brainContextSnapshot: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();
export type SessionRow = z.infer<typeof SessionRow>;

export const GradebookEntryRow = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    learnerId: z.string(),
    subject: z.string().optional(),
    skill: z.string(),
    masteryScore: z.number().nullable().optional(),
    attemptsCount: z.number().int().nullable().optional(),
    trend: z.string().nullable().optional(),
    lastAssessedAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();
export type GradebookEntryRow = z.infer<typeof GradebookEntryRow>;

export const LearningPathRow = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    learnerId: z.string(),
    subject: z.string(),
    topicSequence: z.array(z.string()),
    completedTopics: z.array(z.string()),
    currentTopic: z.string().nullable().optional(),
    masteryMap: z.record(z.unknown()).optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();
export type LearningPathRow = z.infer<typeof LearningPathRow>;

// ---- POST /api/learning/sessions ----------------------------------------

export const CreateSessionRequest = z.object({
  learnerId: z.string().min(1),
  tutorSku: z.string().min(1),
  topic: z.string().optional(),
  contentType: z.string().optional(),
  sessionDate: z.string().optional(),
  durationMinutes: z.union([z.number(), z.string()]).optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

export const CreateSessionResponse = z
  .object({
    sessionId: z.string(),
    status: z.string(),
    content: z.string().nullable().optional(),
    qualityScore: z.number().nullable().optional(),
    degraded: z.boolean().optional(),
    degradedSubsystems: z.array(z.unknown()).optional(),
  })
  .passthrough();
export type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;

// ---- POST /api/learning/sessions/:sessionId/complete --------------------
// The `learning-svc` spec uses `sessionId` as the path param, but the
// route is documented as "advance" in the prompt — we keep both verbs
// available since the server only exposes `/complete`. Advance for the
// player is a no-op POST that just records progress; we model it as a
// client-side `advanceSession` helper that PATCHes the lesson run via
// the BFF (see ./client.ts).

export const CompleteSessionRequest = z
  .object({
    masteryUpdates: z.record(z.number()).optional(),
    xpEarned: z.number().optional(),
    beatsCompleted: z.number().int().optional(),
    beatsTotal: z.number().int().optional(),
    correctAnswers: z.number().int().optional(),
    attemptedAnswers: z.number().int().optional(),
    engagementBeats: z.number().int().optional(),
    breaksUsed: z.number().int().optional(),
    abandoned: z.boolean().optional(),
  })
  .passthrough();
export type CompleteSessionRequest = z.infer<typeof CompleteSessionRequest>;

export const CompleteSessionResponse = z
  .object({
    status: z.string(),
    sessionId: z.string(),
    xpEarned: z.number().optional(),
    completionQuality: z.number().nullable().optional(),
  })
  .passthrough();
export type CompleteSessionResponse = z.infer<typeof CompleteSessionResponse>;

// ---- Sessions list / fetch ----------------------------------------------

export const ListSessionsQuery = z.object({ learnerId: z.string() });
export type ListSessionsQuery = z.infer<typeof ListSessionsQuery>;

export const ListSessionsResponse = z.array(SessionRow);
export type ListSessionsResponse = z.infer<typeof ListSessionsResponse>;

export const GetSessionByIdResponse = z
  .object({
    sessionId: z.string(),
    learnerId: z.string(),
    tutorSku: z.string(),
    subject: z.string().optional(),
    functioningLevel: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    startedAt: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    xpEarned: z.number().nullable().optional(),
    stagePlan: z.object({
      beats: z.array(z.record(z.unknown())),
    }),
  })
  .passthrough();
export type GetSessionByIdResponse = z.infer<typeof GetSessionByIdResponse>;

// ---- Gradebook ----------------------------------------------------------

export const GetGradebookResponse = z.array(GradebookEntryRow);
export type GetGradebookResponse = z.infer<typeof GetGradebookResponse>;

export const UpdateGradebookRequest = z.object({
  learnerId: z.string().min(1),
  skill: z.string().min(1),
  masteryScore: z.number().optional(),
  sessionType: z.string().optional(),
  xpEarned: z.number().optional(),
});
export type UpdateGradebookRequest = z.infer<typeof UpdateGradebookRequest>;

export const UpdateGradebookResponse = z
  .object({
    status: z.string(),
    skill: z.string(),
    masteryScore: z.number().nullable().optional(),
  })
  .passthrough();
export type UpdateGradebookResponse = z.infer<typeof UpdateGradebookResponse>;

// ---- Learning path ------------------------------------------------------

export const GetLearningPathParams = z.object({
  learnerId: z.string(),
  subject: z.string(),
});
export type GetLearningPathParams = z.infer<typeof GetLearningPathParams>;

export const GetLearningPathResponse = LearningPathRow;
export type GetLearningPathResponse = z.infer<typeof GetLearningPathResponse>;

export const InitLearningPathResponse = z
  .object({
    status: z.enum(["already_exists", "created"]),
    path: LearningPathRow,
    personalized: z.boolean().optional(),
  })
  .passthrough();
export type InitLearningPathResponse = z.infer<typeof InitLearningPathResponse>;

export const AdvanceLearningPathResponse = z
  .object({
    status: z.string(),
    previousTopic: z.string().nullable().optional(),
    nextTopic: z.string().nullable().optional(),
    currentTopic: z.string().nullable().optional(),
    masteryScore: z.number().optional(),
    thresholdRequired: z.number().optional(),
    functioningLevel: z.string().optional(),
    subject: z.string().optional(),
    completedCount: z.number().int().optional(),
  })
  .passthrough();
export type AdvanceLearningPathResponse = z.infer<typeof AdvanceLearningPathResponse>;

// ---- Surface telemetry --------------------------------------------------
// POST /api/learning/surface-telemetry — flag-gated server-side, but the
// client always emits events. The relay returns 204 with no body so the
// response schema is `void`-ish.

export const SurfaceTelemetryRequest = z.object({
  learnerId: z.string().min(1),
  sessionId: z.string().optional(),
  eventType: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});
export type SurfaceTelemetryRequest = z.infer<typeof SurfaceTelemetryRequest>;

// ---- Operation ID registry ---------------------------------------------
// The schema-pinning test consumes this list to verify that every
// operation we model still exists upstream with the documented required
// body fields. New operations must be added here; old ones removed when
// the route disappears upstream.
export const KNOWN_OPERATIONS = [
  {
    operationId: "createLearningSession",
    method: "POST",
    path: "/api/learning/sessions",
    bodyRequired: ["learnerId", "tutorSku"],
  },
  {
    operationId: "completeLearningSession",
    method: "POST",
    path: "/api/learning/sessions/{sessionId}/complete",
    bodyRequired: [],
  },
  {
    operationId: "updateGradebook",
    method: "POST",
    path: "/api/learning/gradebook/update",
    bodyRequired: ["learnerId", "skill"],
  },
  {
    operationId: "listLearningSessions",
    method: "GET",
    path: "/api/learning/sessions",
    bodyRequired: [],
  },
  {
    operationId: "getLearningSessionById",
    method: "GET",
    path: "/api/learning/sessions/{sessionId}",
    bodyRequired: [],
  },
  {
    operationId: "getGradebook",
    method: "GET",
    path: "/api/learning/gradebook/{learnerId}",
    bodyRequired: [],
  },
  {
    operationId: "getLearningPath",
    method: "GET",
    path: "/api/learning/path/{learnerId}/{subject}",
    bodyRequired: [],
  },
  {
    operationId: "initLearningPath",
    method: "POST",
    path: "/api/learning/path/{learnerId}/{subject}/init",
    bodyRequired: [],
  },
  {
    operationId: "advanceLearningPath",
    method: "POST",
    path: "/api/learning/path/{learnerId}/{subject}/advance",
    bodyRequired: [],
  },
] as const;
