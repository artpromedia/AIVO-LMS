/**
 * Per-route Fastify JSON Schema definitions for `identity-svc`.
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
  operationId: "identityHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;

export const getAdminStatsSchema = {
  tags: ["Identity"],
  operationId: "getAdminStats",
  summary: "GET /api/admin/stats",
  response: { 200: passthroughObject },
} as const;

export const getAdminUsersSchema = {
  tags: ["Identity"],
  operationId: "getAdminUsers",
  summary: "GET /api/admin/users",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminUsersByIdSchema = {
  tags: ["Identity"],
  operationId: "getAdminUsersById",
  summary: "GET /api/admin/users/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const updateAdminUsersByIdSchema = {
  tags: ["Identity"],
  operationId: "updateAdminUsersById",
  summary: "PUT /api/admin/users/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const deleteAdminUsersByIdSchema = {
  tags: ["Identity"],
  operationId: "deleteAdminUsersById",
  summary: "DELETE /api/admin/users/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const adminUsersByIdReactivateSchema = {
  tags: ["Identity"],
  operationId: "adminUsersByIdReactivate",
  summary: "POST /api/admin/users/:id/reactivate",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const adminUsersByIdResetPasswordSchema = {
  tags: ["Identity"],
  operationId: "adminUsersByIdResetPassword",
  summary: "POST /api/admin/users/:id/reset-password",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getAdminLearnersSchema = {
  tags: ["Identity"],
  operationId: "getAdminLearners",
  summary: "GET /api/admin/learners",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminLearnersByIdSchema = {
  tags: ["Identity"],
  operationId: "getAdminLearnersById",
  summary: "GET /api/admin/learners/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getAdminTenantsSchema = {
  tags: ["Identity"],
  operationId: "getAdminTenants",
  summary: "GET /api/admin/tenants",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getAdminTenantsByIdSchema = {
  tags: ["Identity"],
  operationId: "getAdminTenantsById",
  summary: "GET /api/admin/tenants/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const updateAdminTenantsByIdSchema = {
  tags: ["Identity"],
  operationId: "updateAdminTenantsById",
  summary: "PUT /api/admin/tenants/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const adminImpersonateEndSchema = {
  tags: ["Identity"],
  operationId: "adminImpersonateEnd",
  summary: "POST /api/admin/impersonate/end",
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse, 404: errorResponse },
} as const;

export const getAuthPublicKeySchema = {
  tags: ["Identity"],
  operationId: "getAuthPublicKey",
  summary: "GET /api/auth/public-key",
  response: { 200: passthroughObject, 503: errorResponse },
} as const;

export const updateAuthSessionHeartbeatSchema = {
  tags: ["Identity"],
  operationId: "updateAuthSessionHeartbeat",
  summary: "PUT /api/auth/session/heartbeat",
  response: { 200: passthroughObject, 401: errorResponse },
} as const;

export const getBrandingPublicByTenantIdSchema = {
  tags: ["Identity"],
  operationId: "getBrandingPublicByTenantId",
  summary: "GET /api/branding/public/:tenantId",
  params: {
    type: "object",
    required: ["tenantId"],
    additionalProperties: true,
    properties: { tenantId: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getDistrictAdminsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictAdmins",
  summary: "GET /api/district/admins",
  response: { 200: passthroughObject },
} as const;

export const districtAdminsSchema = {
  tags: ["Identity"],
  operationId: "districtAdmins",
  summary: "POST /api/district/admins",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 409: errorResponse },
} as const;

export const districtAdminsInvitesByIdResendSchema = {
  tags: ["Identity"],
  operationId: "districtAdminsInvitesByIdResend",
  summary: "POST /api/district/admins/invites/:id/resend",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const deleteDistrictAdminsInvitesByIdSchema = {
  tags: ["Identity"],
  operationId: "deleteDistrictAdminsInvitesById",
  summary: "DELETE /api/district/admins/invites/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const districtAdminsByIdDeactivateSchema = {
  tags: ["Identity"],
  operationId: "districtAdminsByIdDeactivate",
  summary: "POST /api/district/admins/:id/deactivate",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const districtAdminsByIdReactivateSchema = {
  tags: ["Identity"],
  operationId: "districtAdminsByIdReactivate",
  summary: "POST /api/district/admins/:id/reactivate",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const districtAdminsByIdResetPasswordSchema = {
  tags: ["Identity"],
  operationId: "districtAdminsByIdResetPassword",
  summary: "POST /api/district/admins/:id/reset-password",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getDistrictAdminsMfaStatsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictAdminsMfaStats",
  summary: "GET /api/district/admins/mfa-stats",
  response: { 200: passthroughObject },
} as const;

export const updateDistrictAdminsForceMfaSchema = {
  tags: ["Identity"],
  operationId: "updateDistrictAdminsForceMfa",
  summary: "PUT /api/district/admins/force-mfa",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getDistrictStatsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictStats",
  summary: "GET /api/district/stats",
  response: { 200: passthroughObject },
} as const;

export const getDistrictTenantSchema = {
  tags: ["Identity"],
  operationId: "getDistrictTenant",
  summary: "GET /api/district/tenant",
  response: { 200: passthroughObject },
} as const;

export const getDistrictSchoolsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictSchools",
  summary: "GET /api/district/schools",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const districtSchoolsSchema = {
  tags: ["Identity"],
  operationId: "districtSchools",
  summary: "POST /api/district/schools",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getDistrictSchoolsByIdSchema = {
  tags: ["Identity"],
  operationId: "getDistrictSchoolsById",
  summary: "GET /api/district/schools/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const updateDistrictSchoolsByIdSchema = {
  tags: ["Identity"],
  operationId: "updateDistrictSchoolsById",
  summary: "PUT /api/district/schools/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getDistrictLearnersSchema = {
  tags: ["Identity"],
  operationId: "getDistrictLearners",
  summary: "GET /api/district/learners",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getDistrictLearnersByIdSchema = {
  tags: ["Identity"],
  operationId: "getDistrictLearnersById",
  summary: "GET /api/district/learners/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getDistrictStaffSchema = {
  tags: ["Identity"],
  operationId: "getDistrictStaff",
  summary: "GET /api/district/staff",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const districtStaffSchema = {
  tags: ["Identity"],
  operationId: "districtStaff",
  summary: "POST /api/district/staff",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 409: errorResponse },
} as const;

export const getDistrictStaffByIdSchema = {
  tags: ["Identity"],
  operationId: "getDistrictStaffById",
  summary: "GET /api/district/staff/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const updateDistrictStaffByIdSchema = {
  tags: ["Identity"],
  operationId: "updateDistrictStaffById",
  summary: "PUT /api/district/staff/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const deleteDistrictStaffByIdSchema = {
  tags: ["Identity"],
  operationId: "deleteDistrictStaffById",
  summary: "DELETE /api/district/staff/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 403: errorResponse, 404: errorResponse },
} as const;

export const getDistrictFamiliesSchema = {
  tags: ["Identity"],
  operationId: "getDistrictFamilies",
  summary: "GET /api/district/families",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getDistrictClassroomsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictClassrooms",
  summary: "GET /api/district/classrooms",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const districtClassroomsSchema = {
  tags: ["Identity"],
  operationId: "districtClassrooms",
  summary: "POST /api/district/classrooms",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const getDistrictUsageSchema = {
  tags: ["Identity"],
  operationId: "getDistrictUsage",
  summary: "GET /api/district/usage",
  response: { 200: passthroughObject },
} as const;

export const getDistrictSettingsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictSettings",
  summary: "GET /api/district/settings",
  response: { 200: passthroughObject },
} as const;

export const updateDistrictSettingsSchema = {
  tags: ["Identity"],
  operationId: "updateDistrictSettings",
  summary: "PUT /api/district/settings",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getDistrictSsoSchema = {
  tags: ["Identity"],
  operationId: "getDistrictSso",
  summary: "GET /api/district/sso",
  response: { 200: passthroughObject },
} as const;

export const updateDistrictSsoSchema = {
  tags: ["Identity"],
  operationId: "updateDistrictSso",
  summary: "PUT /api/district/sso",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getDistrictActivitySchema = {
  tags: ["Identity"],
  operationId: "getDistrictActivity",
  summary: "GET /api/district/activity",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getDistrictAnalyticsCohortsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictAnalyticsCohorts",
  summary: "GET /api/district/analytics/cohorts",
  response: { 200: passthroughObject },
} as const;

export const getDistrictAnalyticsEngagementSchema = {
  tags: ["Identity"],
  operationId: "getDistrictAnalyticsEngagement",
  summary: "GET /api/district/analytics/engagement",
  response: { 200: passthroughObject },
} as const;

export const getDistrictAnalyticsMasterySchema = {
  tags: ["Identity"],
  operationId: "getDistrictAnalyticsMastery",
  summary: "GET /api/district/analytics/mastery",
  response: { 200: passthroughObject },
} as const;

export const getDistrictIepSummarySchema = {
  tags: ["Identity"],
  operationId: "getDistrictIepSummary",
  summary: "GET /api/district/iep/summary",
  response: { 200: passthroughObject },
} as const;

export const getDistrictIepEvaluationsInProgressSchema = {
  tags: ["Identity"],
  operationId: "getDistrictIepEvaluationsInProgress",
  summary: "GET /api/district/iep/evaluations-in-progress",
  response: { 200: passthroughObject },
} as const;

export const getDistrictIepLearnersSchema = {
  tags: ["Identity"],
  operationId: "getDistrictIepLearners",
  summary: "GET /api/district/iep/learners",
  response: { 200: passthroughObject },
} as const;

export const getDistrictInterventionsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictInterventions",
  summary: "GET /api/district/interventions",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const districtIepSchema = {
  tags: ["Identity"],
  operationId: "districtIep",
  summary: "POST /api/district/iep",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const districtInterventionsSchema = {
  tags: ["Identity"],
  operationId: "districtInterventions",
  summary: "POST /api/district/interventions",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const districtSettingsBrandingLogoSchema = {
  tags: ["Identity"],
  operationId: "districtSettingsBrandingLogo",
  summary: "POST /api/district/settings/branding/logo",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const districtSeatsRequestSchema = {
  tags: ["Identity"],
  operationId: "districtSeatsRequest",
  summary: "POST /api/district/seats/request",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getDistrictRosterCsvSchema = {
  tags: ["Identity"],
  operationId: "getDistrictRosterCsv",
  summary: "GET /api/district/roster.csv",
  response: { 200: passthroughObject },
} as const;

export const getDistrictActivityExportSchema = {
  tags: ["Identity"],
  operationId: "getDistrictActivityExport",
  summary: "GET /api/district/activity/export",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getDistrictActivityVerifySchema = {
  tags: ["Identity"],
  operationId: "getDistrictActivityVerify",
  summary: "GET /api/district/activity/verify",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 400: errorResponse },
} as const;

export const getDistrictSeatsRequestsSchema = {
  tags: ["Identity"],
  operationId: "getDistrictSeatsRequests",
  summary: "GET /api/district/seats/requests",
  response: { 200: passthroughObject },
} as const;

export const getScimV2ServiceProviderConfigSchema = {
  tags: ["Identity"],
  operationId: "getScimV2ServiceProviderConfig",
  summary: "GET /scim/v2/ServiceProviderConfig",
  response: { 200: passthroughObject },
} as const;

export const getScimV2SchemasSchema = {
  tags: ["Identity"],
  operationId: "getScimV2Schemas",
  summary: "GET /scim/v2/Schemas",
  response: { 200: passthroughObject },
} as const;

export const getScimV2ResourceTypesSchema = {
  tags: ["Identity"],
  operationId: "getScimV2ResourceTypes",
  summary: "GET /scim/v2/ResourceTypes",
  response: { 200: passthroughObject },
} as const;

export const getScimV2UsersSchema = {
  tags: ["Identity"],
  operationId: "getScimV2Users",
  summary: "GET /scim/v2/Users",
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject },
} as const;

export const getScimV2UsersByIdSchema = {
  tags: ["Identity"],
  operationId: "getScimV2UsersById",
  summary: "GET /scim/v2/Users/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject },
} as const;

export const scimV2UsersSchema = {
  tags: ["Identity"],
  operationId: "scimV2Users",
  summary: "POST /scim/v2/Users",
  body: passthroughObject,
  response: { 200: passthroughObject, 201: passthroughObject },
} as const;

export const updateScimV2UsersByIdSchema = {
  tags: ["Identity"],
  operationId: "updateScimV2UsersById",
  summary: "PUT /scim/v2/Users/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject },
} as const;

export const patchScimV2UsersByIdSchema = {
  tags: ["Identity"],
  operationId: "patchScimV2UsersById",
  summary: "PATCH /scim/v2/Users/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  body: passthroughObject,
  response: { 200: passthroughObject },
} as const;

export const deleteScimV2UsersByIdSchema = {
  tags: ["Identity"],
  operationId: "deleteScimV2UsersById",
  summary: "DELETE /scim/v2/Users/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject, 204: errorResponse },
} as const;

export const getScimV2GroupsSchema = {
  tags: ["Identity"],
  operationId: "getScimV2Groups",
  summary: "GET /scim/v2/Groups",
  response: { 200: passthroughObject },
} as const;

export const getScimV2GroupsByIdSchema = {
  tags: ["Identity"],
  operationId: "getScimV2GroupsById",
  summary: "GET /scim/v2/Groups/:id",
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: true,
    properties: { id: { type: "string" } },
  },
  response: { 200: passthroughObject },
} as const;

export const getSsoSamlBySlugMetadataSchema = {
  tags: ["Identity"],
  operationId: "getSsoSamlBySlugMetadata",
  summary: "GET /api/sso/saml/:slug/metadata",
  params: {
    type: "object",
    required: ["slug"],
    additionalProperties: true,
    properties: { slug: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const getSsoSamlBySlugLoginSchema = {
  tags: ["Identity"],
  operationId: "getSsoSamlBySlugLogin",
  summary: "GET /api/sso/saml/:slug/login",
  params: {
    type: "object",
    required: ["slug"],
    additionalProperties: true,
    properties: { slug: { type: "string" } },
  },
  querystring: { type: "object", additionalProperties: true, properties: {} },
  response: { 200: passthroughObject, 404: errorResponse, 502: errorResponse },
} as const;

export const ssoSamlBySlugAcsSchema = {
  tags: ["Identity"],
  operationId: "ssoSamlBySlugAcs",
  summary: "POST /api/sso/saml/:slug/acs",
  params: {
    type: "object",
    required: ["slug"],
    additionalProperties: true,
    properties: { slug: { type: "string" } },
  },
  body: passthroughObject,
  response: {
    200: passthroughObject,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
  },
} as const;

export const getSsoSamlBySlugSloSchema = {
  tags: ["Identity"],
  operationId: "getSsoSamlBySlugSlo",
  summary: "GET /api/sso/saml/:slug/slo",
  params: {
    type: "object",
    required: ["slug"],
    additionalProperties: true,
    properties: { slug: { type: "string" } },
  },
  response: { 200: passthroughObject },
} as const;

export const ssoSamlBySlugSloSchema = {
  tags: ["Identity"],
  operationId: "ssoSamlBySlugSlo",
  summary: "POST /api/sso/saml/:slug/slo",
  params: {
    type: "object",
    required: ["slug"],
    additionalProperties: true,
    properties: { slug: { type: "string" } },
  },
  response: { 200: passthroughObject },
} as const;

export const authStepUpVerifyInternalSchema = {
  tags: ["Identity"],
  operationId: "authStepUpVerifyInternal",
  summary: "POST /api/auth/step-up/verify-internal",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 401: errorResponse, 403: errorResponse },
} as const;

export const getTestLastMfaCodeByEmailSchema = {
  tags: ["Identity"],
  operationId: "getTestLastMfaCodeByEmail",
  summary: "GET /api/__test__/last-mfa-code/:email",
  params: {
    type: "object",
    required: ["email"],
    additionalProperties: true,
    properties: { email: { type: "string" } },
  },
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const testSeedDistrictAdminSchema = {
  tags: ["Identity"],
  operationId: "testSeedDistrictAdmin",
  summary: "POST /api/__test__/seed-district-admin",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const testSeedIepTimelineFixtureSchema = {
  tags: ["Identity"],
  operationId: "testSeedIepTimelineFixture",
  summary: "POST /api/__test__/seed-iep-timeline-fixture",
  body: passthroughObject,
  response: { 200: passthroughObject, 400: errorResponse, 404: errorResponse },
} as const;

export const testSeedIepEvaluationFixtureSchema = {
  tags: ["Identity"],
  operationId: "testSeedIepEvaluationFixture",
  summary: "POST /api/__test__/seed-iep-evaluation-fixture",
  body: passthroughObject,
  response: { 200: passthroughObject, 404: errorResponse },
} as const;

export const testSeedIepAuthoringFixtureSchema = {
  tags: ["Identity"],
  operationId: "testSeedIepAuthoringFixture",
  summary: "POST /api/__test__/seed-iep-authoring-fixture",
  body: passthroughObject,
  response: { 200: passthroughObject, 404: errorResponse },
} as const;
