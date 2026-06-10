/**
 * Per-route Fastify JSON Schema definitions for `admin-svc`.
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
  operationId: "adminHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;

export const getAdminSvcApiKeysSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcApiKeys",
  summary: "GET /api/admin-svc/api-keys",
  response: { 200: passthroughObject },
} as const;

export const adminSvcApiKeysSchema = {
  tags: ["Admin"],
  operationId: "adminSvcApiKeys",
  summary: "POST /api/admin-svc/api-keys",
  body: passthroughObject,
  response: { 200: passthroughObject, 201: passthroughObject, 400: errorResponse },
} as const;

export const adminSvcApiKeysByIdRotateSchema = {
  tags: ["Admin"],
  operationId: "adminSvcApiKeysByIdRotate",
  summary: "POST /api/admin-svc/api-keys/:id/rotate",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    404: errorResponse,
  },
} as const;

export const adminSvcApiKeysByIdRevokeSchema = {
  tags: ["Admin"],
  operationId: "adminSvcApiKeysByIdRevoke",
  summary: "POST /api/admin-svc/api-keys/:id/revoke",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getAdminSvcAuditLogVerifySchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcAuditLogVerify",
  summary: "GET /api/admin-svc/audit-log/verify",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcAuditLogSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcAuditLog",
  summary: "GET /api/admin-svc/audit-log",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcActivitySchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcActivity",
  summary: "GET /api/admin-svc/activity",
  response: { 200: passthroughArray },
} as const;

export const getAdminSvcComplianceControlsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcComplianceControls",
  summary: "GET /api/admin-svc/compliance/controls",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcComplianceEvidenceSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcComplianceEvidence",
  summary: "GET /api/admin-svc/compliance/evidence",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcComplianceEvidenceByDateSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcComplianceEvidenceByDate",
  summary: "GET /api/admin-svc/compliance/evidence/:date",
  params: {
    type: "object",
    required: ["date"],
    additionalProperties: true,
    properties: { date: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse, 410: errorResponse },
} as const;

export const adminSvcComplianceEvidenceRunSchema = {
  tags: ["Admin"],
  operationId: "adminSvcComplianceEvidenceRun",
  summary: "POST /api/admin-svc/compliance/evidence/run",
  response: { 200: passthroughObject },
} as const;

export const adminHealthRootSchema = {
  tags: ["Admin"],
  operationId: "adminHealthRoot",
  summary: "GET /health",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcHealthSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcHealth",
  summary: "GET /api/admin-svc/health",
  response: { 200: passthroughObject },
} as const;

export const internalJobsByJobNameRunNowSchema = {
  tags: ["Admin"],
  operationId: "internalJobsByJobNameRunNow",
  summary: "POST /internal/jobs/:jobName/run-now",
  params: {
    type: "object",
    required: ["jobName"],
    additionalProperties: true,
    properties: { jobName: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 404: errorResponse },
} as const;

export const getAdminSvcJobsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcJobs",
  summary: "GET /api/admin-svc/jobs",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcJobsByJobNameRunsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcJobsByJobNameRuns",
  summary: "GET /api/admin-svc/jobs/:jobName/runs",
  params: {
    type: "object",
    required: ["jobName"],
    additionalProperties: true,
    properties: { jobName: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcJobsByJobNameRunsCsvSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcJobsByJobNameRunsCsv",
  summary: "GET /api/admin-svc/jobs/:jobName/runs.csv",
  params: {
    type: "object",
    required: ["jobName"],
    additionalProperties: true,
    properties: { jobName: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcJobsRunsCsvSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcJobsRunsCsv",
  summary: "GET /api/admin-svc/jobs/runs.csv",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const adminSvcJobsByJobNameRunNowSchema = {
  tags: ["Admin"],
  operationId: "adminSvcJobsByJobNameRunNow",
  summary: "POST /api/admin-svc/jobs/:jobName/run-now",
  params: {
    type: "object",
    required: ["jobName"],
    additionalProperties: true,
    properties: { jobName: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse, 502: errorResponse },
} as const;

export const getAdminSvcJobsFreshnessSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcJobsFreshness",
  summary: "GET /api/admin-svc/jobs/freshness",
  response: { 200: passthroughObject },
} as const;

export const deleteAdminSvcJobsDiscoveryByJobNameSchema = {
  tags: ["Admin"],
  operationId: "deleteAdminSvcJobsDiscoveryByJobName",
  summary: "DELETE /api/admin-svc/jobs/discovery/:jobName",
  params: {
    type: "object",
    required: ["jobName"],
    additionalProperties: true,
    properties: { jobName: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const adminSvcLeadsSchema = {
  tags: ["Admin"],
  operationId: "adminSvcLeads",
  summary: "POST /api/admin-svc/leads",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const adminSvcNewsletterSchema = {
  tags: ["Admin"],
  operationId: "adminSvcNewsletter",
  summary: "POST /api/admin-svc/newsletter",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const adminSvcInternalModerationSchema = {
  tags: ["Admin"],
  operationId: "adminSvcInternalModeration",
  summary: "POST /api/admin-svc/internal/moderation",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getAdminSvcModerationSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcModeration",
  summary: "GET /api/admin-svc/moderation",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcModerationByIdSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcModerationById",
  summary: "GET /api/admin-svc/moderation/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const patchAdminSvcModerationByIdSchema = {
  tags: ["Admin"],
  operationId: "patchAdminSvcModerationById",
  summary: "PATCH /api/admin-svc/moderation/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const getAdminSvcModerationStatsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcModerationStats",
  summary: "GET /api/admin-svc/moderation/stats",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcStatsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcStats",
  summary: "GET /api/admin-svc/stats",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcPlatformSystemHealthSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcPlatformSystemHealth",
  summary: "GET /api/admin-svc/platform/system-health",
  response: { 200: passthroughObject, 503: passthroughObject },
} as const;

export const getAdminSvcPlatformUsageTrendsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcPlatformUsageTrends",
  summary: "GET /api/admin-svc/platform/usage-trends",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcPlatformAiActivitySchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcPlatformAiActivity",
  summary: "GET /api/admin-svc/platform/ai-activity",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcPlatformAiCostsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcPlatformAiCosts",
  summary: "GET /api/admin-svc/platform/ai-costs",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcUsersSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcUsers",
  summary: "GET /api/admin-svc/users",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcUsersByIdSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcUsersById",
  summary: "GET /api/admin-svc/users/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcLearnersSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcLearners",
  summary: "GET /api/admin-svc/learners",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcLearnersByIdSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcLearnersById",
  summary: "GET /api/admin-svc/learners/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcTenantsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcTenants",
  summary: "GET /api/admin-svc/tenants",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcTenantsByIdSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcTenantsById",
  summary: "GET /api/admin-svc/tenants/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcBillingAccountsSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcBillingAccounts",
  summary: "GET /api/admin-svc/billing/accounts",
  response: { 200: passthroughObject },
} as const;

export const adminSvcAiPlaygroundSchema = {
  tags: ["Admin"],
  operationId: "adminSvcAiPlayground",
  summary: "POST /api/admin-svc/ai/playground",
  body: passthroughObject,
  response: { 200: passthroughObject, 502: errorResponse },
} as const;

export const getAdminSvcConfigSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcConfig",
  summary: "GET /api/admin-svc/config",
  response: { 200: passthroughObject },
} as const;

export const updateAdminSvcConfigSchema = {
  tags: ["Admin"],
  operationId: "updateAdminSvcConfig",
  summary: "PUT /api/admin-svc/config",
  body: passthroughObject,
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcConfigHistorySchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcConfigHistory",
  summary: "GET /api/admin-svc/config/history",
  response: { 200: passthroughObject },
} as const;

export const getAdminSvcScimTokensSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcScimTokens",
  summary: "GET /api/admin-svc/scim-tokens",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const adminSvcScimTokensSchema = {
  tags: ["Admin"],
  operationId: "adminSvcScimTokens",
  summary: "POST /api/admin-svc/scim-tokens",
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    403: errorResponse,
  },
} as const;

export const adminSvcScimTokensByIdRevokeSchema = {
  tags: ["Admin"],
  operationId: "adminSvcScimTokensByIdRevoke",
  summary: "POST /api/admin-svc/scim-tokens/:id/revoke",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getAdminSvcSearchSchema = {
  tags: ["Admin"],
  operationId: "getAdminSvcSearch",
  summary: "GET /api/admin-svc/search",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

// ---------------------------------------------------------------------------
// Sprint 6: Learner Import schemas
// ---------------------------------------------------------------------------

const schoolIdParam = {
  type: "object",
  required: ["schoolId"],
  additionalProperties: true,
  properties: { schoolId: { type: "string" } },
} as const;

export const postAdminSchoolsLearnerImportValidateSchema = {
  tags: ["LearnerImport"],
  operationId: "postAdminSchoolsLearnerImportValidate",
  summary: "POST /admin/schools/:schoolId/learners/import/validate",
  params: schoolIdParam,
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse, 403: errorResponse },
} as const;

export const postAdminSchoolsLearnerImportRunSchema = {
  tags: ["LearnerImport"],
  operationId: "postAdminSchoolsLearnerImportRun",
  summary: "POST /admin/schools/:schoolId/learners/import/run",
  params: schoolIdParam,
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse, 403: errorResponse },
} as const;

export const getAdminSchoolsLearnerImportJobSchema = {
  tags: ["LearnerImport"],
  operationId: "getAdminSchoolsLearnerImportJob",
  summary: "GET /admin/schools/:schoolId/learners/import/:jobId",
  params: {
    type: "object",
    required: ["schoolId", "jobId"],
    additionalProperties: true,
    properties: { schoolId: { type: "string" }, jobId: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const getAdminSchoolsLearnerImportTemplateSchema = {
  tags: ["LearnerImport"],
  operationId: "getAdminSchoolsLearnerImportTemplate",
  summary: "GET /admin/schools/:schoolId/learners/import/template",
  params: schoolIdParam,
  response: { 200: { type: "string" }, 401: errorResponse, 403: errorResponse },
} as const;

// ---------------------------------------------------------------------------
// Sprint 6: Classroom schemas
// ---------------------------------------------------------------------------

export const getAdminSchoolsClassroomsSchema = {
  tags: ["Classrooms"],
  operationId: "getAdminSchoolsClassrooms",
  summary: "GET /admin/schools/:schoolId/classrooms",
  params: schoolIdParam,
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const postAdminSchoolsClassroomsSchema = {
  tags: ["Classrooms"],
  operationId: "postAdminSchoolsClassrooms",
  summary: "POST /admin/schools/:schoolId/classrooms",
  params: schoolIdParam,
  body: passthroughObject,
  response: {
    200: passthroughObject,
    201: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const getAdminSchoolsClassroomByIdSchema = {
  tags: ["Classrooms"],
  operationId: "getAdminSchoolsClassroomById",
  summary: "GET /admin/schools/:schoolId/classrooms/:id",
  params: {
    type: "object",
    required: ["schoolId", "id"],
    additionalProperties: true,
    properties: { schoolId: { type: "string" }, id: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const patchAdminSchoolsClassroomByIdSchema = {
  tags: ["Classrooms"],
  operationId: "patchAdminSchoolsClassroomById",
  summary: "PATCH /admin/schools/:schoolId/classrooms/:id",
  params: {
    type: "object",
    required: ["schoolId", "id"],
    additionalProperties: true,
    properties: { schoolId: { type: "string" }, id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const deleteAdminSchoolsClassroomByIdSchema = {
  tags: ["Classrooms"],
  operationId: "deleteAdminSchoolsClassroomById",
  summary: "DELETE /admin/schools/:schoolId/classrooms/:id",
  params: {
    type: "object",
    required: ["schoolId", "id"],
    additionalProperties: true,
    properties: { schoolId: { type: "string" }, id: { type: "string" } },
  },
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

export const postAdminSchoolsClassroomRosterSchema = {
  tags: ["Classrooms"],
  operationId: "postAdminSchoolsClassroomRoster",
  summary: "POST /admin/schools/:schoolId/classrooms/:id/roster",
  params: {
    type: "object",
    required: ["schoolId", "id"],
    additionalProperties: true,
    properties: { schoolId: { type: "string" }, id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

// ---------------------------------------------------------------------------
// Sprint 6: Reports schemas
// ---------------------------------------------------------------------------

export const getAdminSchoolsReportsSchema = {
  tags: ["Reports"],
  operationId: "getAdminSchoolsReports",
  summary: "GET /admin/schools/:schoolId/reports",
  params: schoolIdParam,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const postAdminSchoolsReportRunSchema = {
  tags: ["Reports"],
  operationId: "postAdminSchoolsReportRun",
  summary: "POST /admin/schools/:schoolId/reports/:reportId/run",
  params: {
    type: "object",
    required: ["schoolId", "reportId"],
    additionalProperties: true,
    properties: { schoolId: { type: "string" }, reportId: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  body: passthroughObject,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse, 404: errorResponse },
} as const;

// ---------------------------------------------------------------------------
// Sprint 6: Notifications schemas
// ---------------------------------------------------------------------------

export const getAdminSchoolsNotificationsSchema = {
  tags: ["Notifications"],
  operationId: "getAdminSchoolsNotifications",
  summary: "GET /admin/schools/:schoolId/notifications",
  params: schoolIdParam,
  response: { 200: passthroughObject, 401: errorResponse, 403: errorResponse },
} as const;

export const putAdminSchoolsNotificationsSchema = {
  tags: ["Notifications"],
  operationId: "putAdminSchoolsNotifications",
  summary: "PUT /admin/schools/:schoolId/notifications",
  params: schoolIdParam,
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse, 403: errorResponse },
} as const;
