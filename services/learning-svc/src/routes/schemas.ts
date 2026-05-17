/**
 * Per-route Fastify JSON Schema definitions for `learning-svc`.
 *
 * Phase 5.2 reference implementation: every public route declares its
 * `body` / `querystring` / `params` shape *and* a typed response 200
 * envelope plus the shared error envelope. The dump shim
 * (`scripts/dump-openapi.mjs`) re-emits these via `app.swagger()` so the
 * generated client at `packages/api-client/src/learning-svc.ts` exposes
 * concrete `paths[...]['responses']['200']['content']['application/json']`
 * types instead of `unknown`.
 *
 * Conventions:
 *   - Every schema sets `tags: ["Learning"]` so the surface groups
 *     under one heading in the swagger UI.
 *   - Every schema sets a stable `operationId` so generated clients
 *     name things deterministically.
 *   - Every response object declares `additionalProperties: true` so
 *     `fast-json-stringify` does not silently strip fields the handler
 *     legitimately returns (drizzle row spreads, sessionData blobs,
 *     etc.). The declared `properties` document the minimum guaranteed
 *     shape.
 *   - The standard error envelope is `{ error: string, ... }`. Routes
 *     that surface extra diagnostic fields (e.g. `qualityScore`,
 *     `topicSequence`) declare them as optional on top of the envelope.
 */

const errorResponse = {
  type: "object",
  required: ["error"],
  additionalProperties: true,
  properties: { error: { type: "string" } },
} as const;

// Drizzle-shaped row for a lesson session. Declared loosely with
// additionalProperties:true so any column we don't list here still
// flows through to the client. The properties listed are the ones
// callers actually consume in apps/web + apps/mobile.
const sessionRow = {
  type: "object",
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    tenantId: { type: "string" },
    learnerId: { type: "string" },
    tutorSku: { type: "string" },
    subject: { type: "string" },
    status: { type: "string" },
    contentType: { type: "string" },
    functioningLevel: { type: ["string", "null"] },
    durationSeconds: { type: "integer" },
    xpEarned: { type: ["number", "null"] },
    startedAt: { type: "string", format: "date-time" },
    completedAt: { type: ["string", "null"], format: "date-time" },
    sessionData: { type: ["object", "null"], additionalProperties: true },
    masteryAfter: { type: ["object", "null"], additionalProperties: true },
    brainContextSnapshot: { type: ["object", "null"], additionalProperties: true },
  },
} as const;

const gradebookEntryRow = {
  type: "object",
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    tenantId: { type: "string" },
    learnerId: { type: "string" },
    subject: { type: "string" },
    skill: { type: "string" },
    masteryScore: { type: ["number", "null"] },
    attemptsCount: { type: ["integer", "null"] },
    trend: { type: ["string", "null"] },
    lastAssessedAt: { type: ["string", "null"], format: "date-time" },
    updatedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const;

const learningPathRow = {
  type: "object",
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    tenantId: { type: "string" },
    learnerId: { type: "string" },
    subject: { type: "string" },
    topicSequence: { type: "array", items: { type: "string" } },
    completedTopics: { type: "array", items: { type: "string" } },
    currentTopic: { type: ["string", "null"] },
    masteryMap: { type: "object", additionalProperties: true },
    updatedAt: { type: ["string", "null"], format: "date-time" },
  },
} as const;

export const createSessionSchema = {
  tags: ["Learning"],
  operationId: "createLearningSession",
  summary: "Start a learning session",
  description:
    "Creates a lesson session for a learner. When `contentType` is `THERAPY_SESSION` the row is short-circuited as a manual therapist log; otherwise content generation is invoked and the response carries the generated lesson body.",
  body: {
    type: "object",
    required: ["learnerId", "tutorSku"],
    additionalProperties: true,
    properties: {
      learnerId: { type: "string" },
      tutorSku: { type: "string" },
      topic: { type: "string" },
      contentType: { type: "string" },
      sessionDate: { type: "string" },
      durationMinutes: { type: ["number", "string"] },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["sessionId", "status"],
      additionalProperties: true,
      properties: {
        sessionId: { type: "string" },
        status: { type: "string" },
        content: { type: ["string", "null"] },
        qualityScore: { type: ["number", "null"] },
      },
    },
    400: errorResponse,
    422: {
      type: "object",
      required: ["error"],
      additionalProperties: true,
      properties: {
        error: { type: "string" },
        qualityScore: { type: ["number", "null"] },
        qualityGateLog: { type: ["object", "array", "null"], additionalProperties: true },
      },
    },
    503: errorResponse,
  },
} as const;

export const completeSessionSchema = {
  tags: ["Learning"],
  operationId: "completeLearningSession",
  summary: "Complete a learning session",
  description:
    "Marks a lesson session COMPLETED, computes XP and completion quality from per-beat signals, and rolls mastery updates into the gradebook.",
  params: {
    type: "object",
    required: ["sessionId"],
    properties: { sessionId: { type: "string" } },
  },
  body: {
    type: "object",
    additionalProperties: true,
    properties: {
      masteryUpdates: { type: "object", additionalProperties: { type: "number" } },
      xpEarned: { type: "number" },
      beatsCompleted: { type: "integer" },
      beatsTotal: { type: "integer" },
      correctAnswers: { type: "integer" },
      attemptedAnswers: { type: "integer" },
      engagementBeats: { type: "integer" },
      breaksUsed: { type: "integer" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "sessionId"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        sessionId: { type: "string" },
        xpEarned: { type: "number" },
        completionQuality: { type: ["number", "null"] },
      },
    },
    404: errorResponse,
  },
} as const;

export const updateGradebookSchema = {
  tags: ["Learning"],
  operationId: "updateGradebook",
  summary: "Upsert a single gradebook skill",
  body: {
    type: "object",
    required: ["learnerId", "skill"],
    additionalProperties: true,
    properties: {
      learnerId: { type: "string" },
      skill: { type: "string" },
      masteryScore: { type: "number" },
      sessionType: { type: "string" },
      xpEarned: { type: "number" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "skill"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        skill: { type: "string" },
        masteryScore: { type: ["number", "null"] },
      },
    },
    400: errorResponse,
  },
} as const;

export const listSessionsSchema = {
  tags: ["Learning"],
  operationId: "listLearningSessions",
  summary: "List recent sessions for a learner",
  querystring: {
    type: "object",
    required: ["learnerId"],
    properties: { learnerId: { type: "string" } },
  },
  response: {
    200: { type: "array", items: sessionRow },
    400: errorResponse,
  },
} as const;

export const getSessionByIdSchema = {
  tags: ["Learning"],
  operationId: "getLearningSessionById",
  summary: "Get a single learning session including its stage plan",
  params: {
    type: "object",
    required: ["sessionId"],
    properties: { sessionId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: true,
      required: ["sessionId", "learnerId", "tutorSku", "stagePlan"],
      properties: {
        sessionId: { type: "string" },
        learnerId: { type: "string" },
        tutorSku: { type: "string" },
        subject: { type: "string" },
        functioningLevel: { type: ["string", "null"] },
        status: { type: ["string", "null"] },
        startedAt: { type: ["string", "null"], format: "date-time" },
        completedAt: { type: ["string", "null"], format: "date-time" },
        xpEarned: { type: ["integer", "null"] },
        stagePlan: {
          type: "object",
          additionalProperties: true,
          required: ["beats"],
          properties: {
            beats: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const getGradebookSchema = {
  tags: ["Learning"],
  operationId: "getGradebook",
  summary: "Fetch gradebook entries for a learner",
  params: {
    type: "object",
    required: ["learnerId"],
    properties: { learnerId: { type: "string" } },
  },
  response: {
    200: { type: "array", items: gradebookEntryRow },
  },
} as const;

export const getLearningPathSchema = {
  tags: ["Learning"],
  operationId: "getLearningPath",
  summary: "Get (or initialize) a subject learning path",
  params: {
    type: "object",
    required: ["learnerId", "subject"],
    properties: {
      learnerId: { type: "string" },
      subject: { type: "string" },
    },
  },
  response: {
    200: learningPathRow,
  },
} as const;

export const initLearningPathSchema = {
  tags: ["Learning"],
  operationId: "initLearningPath",
  summary: "Initialize a subject learning path",
  description:
    "Idempotent: returns the existing path with `status: \"already_exists\"` if one is present, otherwise creates one with default topics and best-effort upgrades to LLM-personalized topics.",
  params: {
    type: "object",
    required: ["learnerId", "subject"],
    properties: {
      learnerId: { type: "string" },
      subject: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "path"],
      additionalProperties: true,
      properties: {
        status: { type: "string", enum: ["already_exists", "created"] },
        path: learningPathRow,
        personalized: { type: "boolean" },
      },
    },
  },
} as const;

export const refreshLearningPathTopicsSchema = {
  tags: ["Learning"],
  operationId: "refreshLearningPathTopics",
  summary: "Refresh a learning path's topic sequence from the curriculum engine",
  params: {
    type: "object",
    required: ["learnerId", "subject"],
    properties: {
      learnerId: { type: "string" },
      subject: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "path", "topicCount"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        path: learningPathRow,
        topicCount: { type: "integer" },
      },
    },
    404: errorResponse,
    503: {
      type: "object",
      required: ["error"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        error: { type: "string" },
        topicSequence: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

export const advanceLearningPathSchema = {
  tags: ["Learning"],
  operationId: "advanceLearningPath",
  summary: "Advance a learner along their subject learning path",
  description:
    "Returns one of `advanced`, `path_complete`, or `needs_practice` based on the learner's current mastery vs. the functioning-level threshold for the next topic.",
  params: {
    type: "object",
    required: ["learnerId", "subject"],
    properties: {
      learnerId: { type: "string" },
      subject: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["status"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        previousTopic: { type: ["string", "null"] },
        nextTopic: { type: ["string", "null"] },
        currentTopic: { type: ["string", "null"] },
        masteryScore: { type: "number" },
        thresholdRequired: { type: "number" },
        functioningLevel: { type: "string" },
        subject: { type: "string" },
        completedCount: { type: "integer" },
      },
    },
    404: errorResponse,
  },
} as const;

const healthResponseSchema = {
  type: "object",
  required: ["status", "service", "timestamp"],
  additionalProperties: true,
  properties: {
    status: { type: "string" },
    service: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

export const healthSchema = {
  tags: ["Health"],
  operationId: "learningHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;

export const healthRootSchema = {
  tags: ["Health"],
  operationId: "learningHealthRoot",
  summary: "Service health probe (root)",
  response: { 200: healthResponseSchema },
} as const;
