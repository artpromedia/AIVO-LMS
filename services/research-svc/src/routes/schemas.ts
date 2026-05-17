/**
 * Per-route Fastify JSON Schema definitions for `research-svc`.
 *
 * See `services/learning-svc/src/routes/schemas.ts` for the canonical
 * 5.2 reference. Conventions:
 *   - `tags: ["Research"]` on every public route, `["Health"]` on probes.
 *   - Stable `operationId` so the generated client names things deterministically.
 *   - `additionalProperties: true` on response objects so any extra fields
 *     (drizzle row spreads, future additions) flow through to the client.
 */

const errorResponse = {
  type: "object",
  required: ["error"],
  additionalProperties: true,
  properties: { error: { type: "string" } },
} as const;

const cohortRow = {
  type: "object",
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    count: { type: "integer" },
  },
} as const;

export const listCohortsSchema = {
  tags: ["Research"],
  operationId: "listResearchCohorts",
  summary: "List learner cohorts with counts",
  response: {
    200: {
      type: "object",
      required: ["cohorts"],
      additionalProperties: true,
      properties: { cohorts: { type: "array", items: cohortRow } },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const engagementMetricsSchema = {
  tags: ["Research"],
  operationId: "getEngagementMetrics",
  summary: "Aggregate engagement metrics for the configured period",
  response: {
    200: {
      type: "object",
      required: ["period", "totalSessions"],
      additionalProperties: true,
      properties: {
        period: { type: "string" },
        totalSessions: { type: "integer" },
        avgSessionDurationMin: { type: "number" },
        avgSessionsPerLearnerPerWeek: { type: "number" },
        completionRate: { type: "number" },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const masteryMetricsSchema = {
  tags: ["Research"],
  operationId: "getMasteryMetrics",
  summary: "Aggregate mastery metrics with per-subject breakdown",
  response: {
    200: {
      type: "object",
      required: ["period"],
      additionalProperties: true,
      properties: {
        period: { type: "string" },
        avgMasteryGrowth: { type: "number" },
        subjectBreakdown: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: true,
            properties: {
              avgMastery: { type: "number" },
              growth: { type: "number" },
            },
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const exportAnonymizedSchema = {
  tags: ["Research"],
  operationId: "exportAnonymizedDataset",
  summary: "Download an anonymized research dataset",
  querystring: {
    type: "object",
    additionalProperties: true,
    properties: { format: { type: "string", enum: ["json"] } },
  },
  response: {
    200: {
      type: "object",
      required: ["format", "exportedAt", "participants"],
      additionalProperties: true,
      properties: {
        format: { type: "string" },
        exportedAt: { type: "string", format: "date-time" },
        participants: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              participantId: { type: "string" },
              functioningLevel: { type: "string" },
              enrolledAt: { type: ["string", "null"], format: "date-time" },
            },
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const listReportsSchema = {
  tags: ["Research"],
  operationId: "listResearchReports",
  summary: "List saved research reports",
  response: {
    200: {
      type: "object",
      required: ["reports"],
      additionalProperties: true,
      properties: {
        reports: { type: "array", items: { type: "object", additionalProperties: true } },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const healthSchema = {
  tags: ["Health"],
  operationId: "researchHealth",
  summary: "Service health probe",
  response: {
    200: {
      type: "object",
      required: ["status", "service", "timestamp"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        service: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  },
} as const;
