/**
 * Per-route Fastify JSON Schema definitions for `family-svc`.
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
  operationId: "familyHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;

export const getCollaborationByLearnerIdMembersSchema = {
  tags: ["Family"],
  operationId: "getCollaborationByLearnerIdMembers",
  summary: "GET /api/family/collaboration/:learnerId/members",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const collaborationByLearnerIdInviteTeacherSchema = {
  tags: ["Family"],
  operationId: "collaborationByLearnerIdInviteTeacher",
  summary: "POST /api/family/collaboration/:learnerId/invite/teacher",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
    429: errorResponse,
  },
} as const;

export const collaborationByLearnerIdInviteCaregiverSchema = {
  tags: ["Family"],
  operationId: "collaborationByLearnerIdInviteCaregiver",
  summary: "POST /api/family/collaboration/:learnerId/invite/caregiver",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
    429: errorResponse,
  },
} as const;

export const collaborationByLearnerIdInviteTherapistSchema = {
  tags: ["Family"],
  operationId: "collaborationByLearnerIdInviteTherapist",
  summary: "POST /api/family/collaboration/:learnerId/invite/therapist",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
    429: errorResponse,
  },
} as const;

export const deleteCollaborationByLearnerIdMemberByMemberIdSchema = {
  tags: ["Family"],
  operationId: "deleteCollaborationByLearnerIdMemberByMemberId",
  summary: "DELETE /api/family/collaboration/:learnerId/member/:memberId",
  params: {
    type: "object",
    required: ["learnerId", "memberId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" }, memberId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse },
} as const;

export const collaborationByLearnerIdInsightSchema = {
  tags: ["Family"],
  operationId: "collaborationByLearnerIdInsight",
  summary: "POST /api/family/collaboration/:learnerId/insight",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    403: errorResponse,
  },
} as const;

export const getCollaborationByLearnerIdBrainTeacherSchema = {
  tags: ["Family"],
  operationId: "getCollaborationByLearnerIdBrainTeacher",
  summary: "GET /api/family/collaboration/:learnerId/brain/teacher",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getCollaborationByLearnerIdBrainCaregiverSchema = {
  tags: ["Family"],
  operationId: "getCollaborationByLearnerIdBrainCaregiver",
  summary: "GET /api/family/collaboration/:learnerId/brain/caregiver",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getCollaborationByLearnerIdBrainTherapistSchema = {
  tags: ["Family"],
  operationId: "getCollaborationByLearnerIdBrainTherapist",
  summary: "GET /api/family/collaboration/:learnerId/brain/therapist",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getCollaborationConnectedLearnersSchema = {
  tags: ["Family"],
  operationId: "getCollaborationConnectedLearners",
  summary: "GET /api/family/collaboration/connected-learners",
  response: { 200: passthroughArray },
} as const;

export const collaborationAcceptInviteSchema = {
  tags: ["Family"],
  operationId: "collaborationAcceptInvite",
  summary: "POST /api/family/collaboration/accept-invite",
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getCollaborationPendingInvitesSchema = {
  tags: ["Family"],
  operationId: "getCollaborationPendingInvites",
  summary: "GET /api/family/collaboration/pending-invites",
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

// Sprint 3 (invite-flows): teacher → parent invites.
export const collaborationInviteParentSchema = {
  tags: ["Family"],
  operationId: "collaborationInviteParent",
  summary: "POST /api/family/collaboration/invite-parent",
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
    429: errorResponse,
  },
} as const;

export const collaborationInviteParentResendSchema = {
  tags: ["Family"],
  operationId: "collaborationInviteParentResend",
  summary: "POST /api/family/collaboration/invite-parent/:id/resend",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const collaborationInviteParentRevokeSchema = {
  tags: ["Family"],
  operationId: "collaborationInviteParentRevoke",
  summary: "DELETE /api/family/collaboration/invite-parent/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const getCollaborationInviteParentByTeacherSchema = {
  tags: ["Family"],
  operationId: "getCollaborationInviteParentByTeacher",
  summary: "GET /api/family/collaboration/invite-parent (teacher's outgoing invites)",
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

// Sprint 5 (invite-flows): generic resend/revoke for any of the four
// invite kinds (teacher, caregiver, therapist, teacher_parent). The
// :kind param picks the table; :id picks the row.
export const collaborationInviteResendSchema = {
  tags: ["Family"],
  operationId: "collaborationInviteResend",
  summary: "POST /api/family/collaboration/invites/:kind/:id/resend",
  params: {
    type: "object",
    required: ["kind", "id"],
    additionalProperties: true,
    properties: { kind: { type: "string" }, id: { type: "string" } },
  },
  response: {
    200: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
    429: errorResponse,
  },
} as const;

export const collaborationInviteRevokeSchema = {
  tags: ["Family"],
  operationId: "collaborationInviteRevoke",
  summary: "DELETE /api/family/collaboration/invites/:kind/:id",
  params: {
    type: "object",
    required: ["kind", "id"],
    additionalProperties: true,
    properties: { kind: { type: "string" }, id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

// Sprint 4 (invite-flows): unified teacher roster.
export const getTeacherRosterSchema = {
  tags: ["Family"],
  operationId: "getTeacherRoster",
  summary: "GET /api/teacher/roster",
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const getDataExportByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getDataExportByLearnerId",
  summary: "GET /api/family/data-export/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepGoalsSchema = {
  tags: ["Family"],
  operationId: "getIepGoals",
  summary: "GET /api/family/iep-goals",
  response: { 200: passthroughObject },
} as const;

export const getTherapyGoalsSchema = {
  tags: ["Family"],
  operationId: "getTherapyGoals",
  summary: "GET /api/family/therapy-goals",
  response: { 200: passthroughObject },
} as const;

export const createTherapyGoalSchema = {
  tags: ["Family"],
  operationId: "createTherapyGoal",
  summary: "POST /api/family/therapy-goals",
  body: {
    type: "object",
    required: ["learnerId", "goalText"],
    additionalProperties: true,
    properties: {
      learnerId: { type: "string" },
      goalText: { type: "string", minLength: 1 },
      domain: { type: "string" },
    },
  },
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse, 403: errorResponse },
} as const;

export const familyHealthRootSchema = {
  tags: ["Family"],
  operationId: "familyHealthRoot",
  summary: "GET /health",
  response: { 200: passthroughObject },
} as const;

export const getHealth2Schema = {
  tags: ["Family"],
  operationId: "getHealth2",
  summary: "GET /api/family/health",
  response: { 200: passthroughObject },
} as const;

export const getIepByLearnerIdGoalsSchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdGoals",
  summary: "GET /api/family/iep/:learnerId/goals",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const getIepByLearnerIdGoalsByGoalIdSchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdGoalsByGoalId",
  summary: "GET /api/family/iep/:learnerId/goals/:goalId",
  params: {
    type: "object",
    required: ["learnerId", "goalId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" }, goalId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepByLearnerIdProfileSchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdProfile",
  summary: "GET /api/family/iep/:learnerId/profile",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getIepByLearnerIdDocumentsSchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdDocuments",
  summary: "GET /api/family/iep/:learnerId/documents",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const getIepByLearnerIdProgressSchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdProgress",
  summary: "GET /api/family/iep/:learnerId/progress",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getIepByLearnerIdReportSchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdReport",
  summary: "GET /api/family/iep/:learnerId/report",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepByLearnerIdDapeProfileSchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdDapeProfile",
  summary: "GET /api/family/iep/:learnerId/dape/profile",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getIepByLearnerIdDapeActivitySchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdDapeActivity",
  summary: "GET /api/family/iep/:learnerId/dape/activity",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getIepByLearnerIdDapeProgressSchema = {
  tags: ["Family"],
  operationId: "getIepByLearnerIdDapeProgress",
  summary: "GET /api/family/iep/:learnerId/dape/progress",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getInterestsByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getInterestsByLearnerId",
  summary: "GET /api/family/interests/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const interestsByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "interestsByLearnerId",
  summary: "POST /api/family/interests/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    429: errorResponse,
  },
} as const;

export const deleteInterestsByLearnerIdBySignalIdSchema = {
  tags: ["Family"],
  operationId: "deleteInterestsByLearnerIdBySignalId",
  summary: "DELETE /api/family/interests/:learnerId/:signalId",
  params: {
    type: "object",
    required: ["learnerId", "signalId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" }, signalId: { type: "string" } },
  },
  response: { 200: passthroughObject, 204: errorResponse, 403: errorResponse, 429: errorResponse },
} as const;

export const languageProfileByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "languageProfileByLearnerId",
  summary: "POST /api/family/language-profile/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse },
} as const;

export const getLanguageProfileByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getLanguageProfileByLearnerId",
  summary: "GET /api/family/language-profile/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const languageProfileByLearnerIdCoughdropSyncSchema = {
  tags: ["Family"],
  operationId: "languageProfileByLearnerIdCoughdropSync",
  summary: "POST /api/family/language-profile/:learnerId/coughdrop-sync",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: {
    200: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    500: errorResponse,
    502: errorResponse,
  },
} as const;

export const getLanguageProfileByLearnerIdCoughdropSyncStatusSchema = {
  tags: ["Family"],
  operationId: "getLanguageProfileByLearnerIdCoughdropSyncStatus",
  summary: "GET /api/family/language-profile/:learnerId/coughdrop-sync/status",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getObservationsSchema = {
  tags: ["Family"],
  operationId: "getObservations",
  summary: "GET /api/family/observations",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse },
} as const;

export const observationsSchema = {
  tags: ["Family"],
  operationId: "observations",
  summary: "POST /api/family/observations",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 403: errorResponse },
} as const;

export const getLearnerSettingsByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getLearnerSettingsByLearnerId",
  summary: "GET /api/family/learner-settings/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const updateLearnerSettingsByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "updateLearnerSettingsByLearnerId",
  summary: "PUT /api/family/learner-settings/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getInboxByParentIdSchema = {
  tags: ["Family"],
  operationId: "getInboxByParentId",
  summary: "GET /api/family/inbox/:parentId",
  params: {
    type: "object",
    required: ["parentId"],
    additionalProperties: true,
    properties: { parentId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const updateInboxByNotificationIdReadSchema = {
  tags: ["Family"],
  operationId: "updateInboxByNotificationIdRead",
  summary: "PUT /api/family/inbox/:notificationId/read",
  params: {
    type: "object",
    required: ["notificationId"],
    additionalProperties: true,
    properties: { notificationId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const updateInboxByNotificationIdDismissSchema = {
  tags: ["Family"],
  operationId: "updateInboxByNotificationIdDismiss",
  summary: "PUT /api/family/inbox/:notificationId/dismiss",
  params: {
    type: "object",
    required: ["notificationId"],
    additionalProperties: true,
    properties: { notificationId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getActivityFeedByParentIdSchema = {
  tags: ["Family"],
  operationId: "getActivityFeedByParentId",
  summary: "GET /api/family/activity-feed/:parentId",
  params: {
    type: "object",
    required: ["parentId"],
    additionalProperties: true,
    properties: { parentId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getMilestonesByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getMilestonesByLearnerId",
  summary: "GET /api/family/milestones/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getStreaksByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getStreaksByLearnerId",
  summary: "GET /api/family/streaks/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getSummaryByParentIdSchema = {
  tags: ["Family"],
  operationId: "getSummaryByParentId",
  summary: "GET /api/family/summary/:parentId",
  params: {
    type: "object",
    required: ["parentId"],
    additionalProperties: true,
    properties: { parentId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getRecommendationsByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getRecommendationsByLearnerId",
  summary: "GET /api/family/recommendations/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughArray, 403: errorResponse },
} as const;

export const recommendationsByLearnerIdByRecIdRespondSchema = {
  tags: ["Family"],
  operationId: "recommendationsByLearnerIdByRecIdRespond",
  summary: "POST /api/family/recommendations/:learnerId/:recId/respond",
  params: {
    type: "object",
    required: ["learnerId", "recId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" }, recId: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    400: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
    500: errorResponse,
  },
} as const;

export const getRecommendationsByLearnerIdHistorySchema = {
  tags: ["Family"],
  operationId: "getRecommendationsByLearnerIdHistory",
  summary: "GET /api/family/recommendations/:learnerId/history",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getRecommendationsByLearnerIdConflictsSchema = {
  tags: ["Family"],
  operationId: "getRecommendationsByLearnerIdConflicts",
  summary: "GET /api/family/recommendations/:learnerId/conflicts",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const internalSpeechBuddyConsentVerifySchema = {
  tags: ["Family"],
  operationId: "internalSpeechBuddyConsentVerify",
  summary: "POST /api/family/internal/speech-buddy/consent/verify",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse, 404: errorResponse },
} as const;

const learnerIdParam = {
  type: "object",
  required: ["learnerId"],
  additionalProperties: true,
  properties: { learnerId: { type: "string" } },
} as const;

export const getSpeechBuddyConsentSchema = {
  tags: ["Family"],
  operationId: "getSpeechBuddyConsent",
  summary: "GET /api/family/speech-buddy/consent/:learnerId",
  params: learnerIdParam,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const grantSpeechBuddyConsentSchema = {
  tags: ["Family"],
  operationId: "grantSpeechBuddyConsent",
  summary: "POST /api/family/speech-buddy/consent/:learnerId",
  params: learnerIdParam,
  body: passthroughObject,
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const revokeSpeechBuddyConsentSchema = {
  tags: ["Family"],
  operationId: "revokeSpeechBuddyConsent",
  summary: "POST /api/family/speech-buddy/consent/:learnerId/revoke",
  params: learnerIdParam,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const transitionByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "transitionByLearnerId",
  summary: "POST /api/family/transition/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse },
} as const;

export const getTransitionByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getTransitionByLearnerId",
  summary: "GET /api/family/transition/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getWhatsWorkingByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "getWhatsWorkingByLearnerId",
  summary: "GET /api/family/whats-working/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 403: errorResponse, 429: errorResponse },
} as const;

export const whatsWorkingByLearnerIdSchema = {
  tags: ["Family"],
  operationId: "whatsWorkingByLearnerId",
  summary: "POST /api/family/whats-working/:learnerId",
  params: {
    type: "object",
    required: ["learnerId"],
    additionalProperties: true,
    properties: { learnerId: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 403: errorResponse, 413: errorResponse, 429: errorResponse },
} as const;
