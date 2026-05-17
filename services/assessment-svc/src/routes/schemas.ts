/**
 * Per-route Fastify JSON Schema definitions for `assessment-svc`.
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
  operationId: "assessmentHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;

export const getIepDraftsByIdTeamSchema = {
  tags: ["Assessment"],
  operationId: "getIepDraftsByIdTeam",
  summary: "GET /api/iep/drafts/:id/team",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughArray, 403: errorResponse, 404: errorResponse },
} as const;

export const deleteIepDraftsByIdTeamByMemberIdSchema = {
  tags: ["Assessment"],
  operationId: "deleteIepDraftsByIdTeamByMemberId",
  summary: "DELETE /api/iep/drafts/:id/team/:memberId",
  params: { type: "object", required: ["id", "memberId"], additionalProperties: true, properties: { id: { type: "string" }, memberId: { type: "string" } } },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepDraftsByIdCommentsSchema = {
  tags: ["Assessment"],
  operationId: "getIepDraftsByIdComments",
  summary: "GET /api/iep/drafts/:id/comments",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughArray, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepDraftsByIdRevisionsSchema = {
  tags: ["Assessment"],
  operationId: "getIepDraftsByIdRevisions",
  summary: "GET /api/iep/drafts/:id/revisions",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughArray, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepDraftsByIdSignaturesSchema = {
  tags: ["Assessment"],
  operationId: "getIepDraftsByIdSignatures",
  summary: "GET /api/iep/drafts/:id/signatures",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const iepDraftsByIdNotifyInReviewSchema = {
  tags: ["Assessment"],
  operationId: "iepDraftsByIdNotifyInReview",
  summary: "POST /api/iep/drafts/:id/notify-in-review",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse, 409: errorResponse },
} as const;

export const getIepEvaluationsLearnerByLearnerIdSchema = {
  tags: ["Assessment"],
  operationId: "getIepEvaluationsLearnerByLearnerId",
  summary: "GET /api/iep/evaluations/learner/:learnerId",
  params: { type: "object", required: ["learnerId"], additionalProperties: true, properties: { learnerId: { type: "string" } } },
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const getIepEvaluationsByIdSchema = {
  tags: ["Assessment"],
  operationId: "getIepEvaluationsById",
  summary: "GET /api/iep/evaluations/:id",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const patchIepEvaluationsByIdSchema = {
  tags: ["Assessment"],
  operationId: "patchIepEvaluationsById",
  summary: "PATCH /api/iep/evaluations/:id",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse },
} as const;

export const iepEvaluationsByIdSuggestSchema = {
  tags: ["Assessment"],
  operationId: "iepEvaluationsByIdSuggest",
  summary: "POST /api/iep/evaluations/:id/suggest",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse, 502: errorResponse },
} as const;

export const iepEvaluationsByIdSubmitSchema = {
  tags: ["Assessment"],
  operationId: "iepEvaluationsByIdSubmit",
  summary: "POST /api/iep/evaluations/:id/submit",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse },
} as const;

export const getIepDraftsByIdNotesSchema = {
  tags: ["Assessment"],
  operationId: "getIepDraftsByIdNotes",
  summary: "GET /api/iep/drafts/:id/notes",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughArray, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepDraftsByIdReportsSchema = {
  tags: ["Assessment"],
  operationId: "getIepDraftsByIdReports",
  summary: "GET /api/iep/drafts/:id/reports",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughArray, 403: errorResponse, 404: errorResponse },
} as const;

export const iepDraftsByIdReportsByRidSendSchema = {
  tags: ["Assessment"],
  operationId: "iepDraftsByIdReportsByRidSend",
  summary: "POST /api/iep/drafts/:id/reports/:rid/send",
  params: { type: "object", required: ["id", "rid"], additionalProperties: true, properties: { id: { type: "string" }, rid: { type: "string" } } },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepDraftsByIdAmendmentsSchema = {
  tags: ["Assessment"],
  operationId: "getIepDraftsByIdAmendments",
  summary: "GET /api/iep/drafts/:id/amendments",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughArray, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepLearnersByLearnerIdTimelineSchema = {
  tags: ["Assessment"],
  operationId: "getIepLearnersByLearnerIdTimeline",
  summary: "GET /api/iep/learners/:learnerId/timeline",
  params: { type: "object", required: ["learnerId"], additionalProperties: true, properties: { learnerId: { type: "string" } } },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepPreferencesSchema = {
  tags: ["Assessment"],
  operationId: "getIepPreferences",
  summary: "GET /api/iep/preferences",
  response: { 200: passthroughObject },
} as const;

export const getIepInternalUnreadParentUpdatesSchema = {
  tags: ["Assessment"],
  operationId: "getIepInternalUnreadParentUpdates",
  summary: "GET /api/iep/internal/unread-parent-updates",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse },
} as const;

export const iepInternalRunReviewRemindersSchema = {
  tags: ["Assessment"],
  operationId: "iepInternalRunReviewReminders",
  summary: "POST /api/iep/internal/run-review-reminders",
  response: { 200: passthroughObject, 401: errorResponse },
} as const;

export const getIepDraftsByIdReportsSeedSchema = {
  tags: ["Assessment"],
  operationId: "getIepDraftsByIdReportsSeed",
  summary: "GET /api/iep/drafts/:id/reports/seed",
  params: { type: "object", required: ["id"], additionalProperties: true, properties: { id: { type: "string" } } },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const assessmentsSensoryProfileSchema = {
  tags: ["Assessment"],
  operationId: "assessmentsSensoryProfile",
  summary: "POST /api/assessments/sensory-profile",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse },
} as const;

export const getAssessmentsSensoryProfileByLearnerIdSchema = {
  tags: ["Assessment"],
  operationId: "getAssessmentsSensoryProfileByLearnerId",
  summary: "GET /api/assessments/sensory-profile/:learnerId",
  params: { type: "object", required: ["learnerId"], additionalProperties: true, properties: { learnerId: { type: "string" } } },
  response: { 200: passthroughObject, 401: errorResponse, 404: errorResponse },
} as const;
