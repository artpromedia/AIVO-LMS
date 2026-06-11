/**
 * Per-route Fastify JSON Schema definitions for `tutor-svc`.
 *
 * Generated via /tmp/wire_schemas.py to give every route a typed
 * envelope for the api-client drift gate. Response payloads are
 * passthrough objects (`additionalProperties: true`) because handlers
 * mostly return drizzle row shapes that vary across queries; capturing
 * every column per route would explode the file without meaningfully
 * improving client typing.
 */

const errorResponse = {
  type: "object",
  required: ["error"],
  additionalProperties: true,
  properties: { error: { type: "string" } },
} as const;

const passthroughObject = {
  type: "object",
  additionalProperties: true,
} as const;

const passthroughArray = {
  type: "array",
  items: passthroughObject,
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
  operationId: "tutorHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;

export const sessionStartSchema = {
  tags: ["Tutor"],
  operationId: "sessionStart",
  summary: "POST /api/tutor/session/start",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const sessionBySessionIdMessageSchema = {
  tags: ["Tutor"],
  operationId: "sessionBySessionIdMessage",
  summary: "POST /api/tutor/session/:sessionId/message",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse, 503: errorResponse },
} as const;

export const sessionBySessionIdCompleteSchema = {
  tags: ["Tutor"],
  operationId: "sessionBySessionIdComplete",
  summary: "POST /api/tutor/session/:sessionId/complete",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getSessionsByLearnerIdSchema = {
  tags: ["Tutor"],
  operationId: "getSessionsByLearnerId",
  summary: "GET /api/tutor/sessions/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray },
} as const;

export const getSessionBySessionIdSchema = {
  tags: ["Tutor"],
  operationId: "getSessionBySessionId",
  summary: "GET /api/tutor/session/:sessionId",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const sessionBySessionIdCoLearnSchema = {
  tags: ["Tutor"],
  operationId: "sessionBySessionIdCoLearn",
  summary: "POST /api/tutor/session/:sessionId/co-learn",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const tutorsCurriculumParsePreviewSchema = {
  tags: ["Tutor"],
  operationId: "tutorsCurriculumParsePreview",
  summary: "POST /api/tutors/curriculum/parse-preview",
  body: passthroughObject,
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    413: errorResponse,
    415: errorResponse,
    502: errorResponse,
  },
} as const;

export const tutorsCurriculumUploadSchema = {
  tags: ["Tutor"],
  operationId: "tutorsCurriculumUpload",
  summary: "POST /api/tutors/curriculum/upload",
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    413: errorResponse,
    415: errorResponse,
    502: errorResponse,
  },
} as const;

export const getTutorsCurriculumLearnerByLearnerIdSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsCurriculumLearnerByLearnerId",
  summary: "GET /api/tutors/curriculum/learner/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const getTutorsCurriculumMineSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsCurriculumMine",
  summary: "GET /api/tutors/curriculum/mine",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 401: errorResponse },
} as const;

export const getTutorsCurriculumLearnerByLearnerIdActiveSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsCurriculumLearnerByLearnerIdActive",
  summary: "GET /api/tutors/curriculum/learner/:learnerId/active",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const deleteTutorsCurriculumByIdSchema = {
  tags: ["Tutor"],
  operationId: "deleteTutorsCurriculumById",
  summary: "DELETE /api/tutors/curriculum/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const tutorHealthRootSchema = {
  tags: ["Tutor"],
  operationId: "tutorHealthRoot",
  summary: "GET /health",
  response: { 200: passthroughObject },
} as const;

export const getTutorsHealthSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsHealth",
  summary: "GET /api/tutors/health",
  response: { 200: passthroughObject },
} as const;

export const tutorsHomeworkUploadSchema = {
  tags: ["Tutor"],
  operationId: "tutorsHomeworkUpload",
  summary: "POST /api/tutors/homework/upload",
  body: passthroughObject,
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    500: errorResponse,
    502: errorResponse,
  },
} as const;

export const getTutorsHomeworkLearnerByLearnerIdSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsHomeworkLearnerByLearnerId",
  summary: "GET /api/tutors/homework/learner/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const getTutorsHomeworkByAssignmentIdSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsHomeworkByAssignmentId",
  summary: "GET /api/tutors/homework/:assignmentId",
  params: {
    type: "object",
    required: ["assignmentId"],
    additionalProperties: true,
    properties: { assignmentId: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const tutorsHomeworkSessionStartSchema = {
  tags: ["Tutor"],
  operationId: "tutorsHomeworkSessionStart",
  summary: "POST /api/tutors/homework/session/start",
  body: passthroughObject,
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const getTutorsHomeworkSessionBySessionIdStateSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsHomeworkSessionBySessionIdState",
  summary: "GET /api/tutors/homework/session/:sessionId/state",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const tutorsHomeworkSessionBySessionIdMessageSchema = {
  tags: ["Tutor"],
  operationId: "tutorsHomeworkSessionBySessionIdMessage",
  summary: "POST /api/tutors/homework/session/:sessionId/message",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    503: errorResponse,
  },
} as const;

export const tutorsHomeworkSessionBySessionIdCompleteSchema = {
  tags: ["Tutor"],
  operationId: "tutorsHomeworkSessionBySessionIdComplete",
  summary: "POST /api/tutors/homework/session/:sessionId/complete",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const getTutorsHomeworkParentByParentIdSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsHomeworkParentByParentId",
  summary: "GET /api/tutors/homework/parent/:parentId",
  params: {
    type: "object",
    required: ["parentId"],
    additionalProperties: true,
    properties: { parentId: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const speechBuddySessionsSchema = {
  tags: ["Tutor"],
  operationId: "speechBuddySessions",
  summary: "POST /speech-buddy/sessions",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 502: errorResponse },
} as const;

export const speechBuddySessionsByIdTurnSchema = {
  tags: ["Tutor"],
  operationId: "speechBuddySessionsByIdTurn",
  summary: "POST /speech-buddy/sessions/:id/turn",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const speechBuddySessionsByIdEndSchema = {
  tags: ["Tutor"],
  operationId: "speechBuddySessionsByIdEnd",
  summary: "POST /speech-buddy/sessions/:id/end",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject },
} as const;

export const getSpeechBuddySessionsByIdStreamSchema = {
  tags: ["Tutor"],
  operationId: "getSpeechBuddySessionsByIdStream",
  summary: "GET /speech-buddy/sessions/:id/stream",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getTutorsCatalogSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsCatalog",
  summary: "GET /api/tutors/catalog",
  response: { 200: passthroughObject },
} as const;

export const getTutorsActiveByUserIdSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsActiveByUserId",
  summary: "GET /api/tutors/active/:userId",
  params: {
    type: "object",
    required: ["userId"],
    additionalProperties: true,
    properties: { userId: { type: "string" } },
  },
  response: { 200: passthroughArray },
} as const;

export const getTutorsEntitlementsByLearnerIdSchema = {
  tags: ["Tutor"],
  operationId: "getTutorsEntitlementsByLearnerId",
  summary: "GET /api/tutors/entitlements/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const tutorsSubscribeSchema = {
  tags: ["Tutor"],
  operationId: "tutorsSubscribe",
  summary: "POST /api/tutors/subscribe",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 409: errorResponse },
} as const;

export const tutorsSubscribeBundleSchema = {
  tags: ["Tutor"],
  operationId: "tutorsSubscribeBundle",
  summary: "POST /api/tutors/subscribe-bundle",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const tutorsUnsubscribeSchema = {
  tags: ["Tutor"],
  operationId: "tutorsUnsubscribe",
  summary: "POST /api/tutors/unsubscribe",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getTutorsSchema = {
  tags: ["Tutor"],
  operationId: "getTutors",
  summary: "GET /api/tutors",
  response: { 200: passthroughObject },
} as const;

export const getTutorsByTutorKeySchema = {
  tags: ["Tutor"],
  operationId: "getTutorsByTutorKey",
  summary: "GET /api/tutors/:tutorKey",
  params: {
    type: "object",
    required: ["tutorKey"],
    additionalProperties: true,
    properties: { tutorKey: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const tutorsByTutorKeyPlanSchema = {
  tags: ["Tutor"],
  operationId: "tutorsByTutorKeyPlan",
  summary: "POST /api/tutors/:tutorKey/plan",
  params: {
    type: "object",
    required: ["tutorKey"],
    additionalProperties: true,
    properties: { tutorKey: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse, 500: errorResponse },
} as const;

// ── Wave E (S9): tutor agent session routes ─────────────────────────────────

export const agentSessionOpenSchema = {
  tags: ["Tutor Agent"],
  operationId: "tutorAgentSessionOpen",
  summary: "POST /api/tutor/agent/session/open",
  body: {
    type: "object",
    required: ["learnerId", "tutorKey"],
    additionalProperties: true,
    properties: {
      learnerId: { type: "string" },
      tutorKey: { type: "string" },
      lessonRunId: { type: "string" },
      functioningLevel: { type: "string" },
      gradeBand: { type: "string" },
      deliveryLevel: { type: "string" },
    },
  },
  response: {
    200: passthroughObject,
    400: errorResponse,
    404: errorResponse,
    409: errorResponse,
  },
} as const;

export const agentSessionTurnSchema = {
  tags: ["Tutor Agent"],
  operationId: "tutorAgentSessionTurn",
  summary: "POST /api/tutor/agent/session/:sessionId/turn",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["learnerId", "observation"],
    additionalProperties: true,
    properties: {
      learnerId: { type: "string" },
      observation: passthroughObject,
    },
  },
  response: {
    200: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
  },
} as const;

export const agentSessionCloseSchema = {
  tags: ["Tutor Agent"],
  operationId: "tutorAgentSessionClose",
  summary: "POST /api/tutor/agent/session/:sessionId/close",
  params: {
    type: "object",
    required: ["sessionId"],
    additionalProperties: true,
    properties: { sessionId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const agentMemoriesListSchema = {
  tags: ["Tutor Agent"],
  operationId: "tutorAgentMemoriesList",
  summary: "GET /api/tutor/agent/memories/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject },
} as const;

export const agentMemoryDeleteSchema = {
  tags: ["Tutor Agent"],
  operationId: "tutorAgentMemoryDelete",
  summary: "DELETE /api/tutor/agent/memories/:learnerId/:memoryId",
  params: {
    type: "object",
    required: ["learnerId", "memoryId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" }, memoryId: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;
