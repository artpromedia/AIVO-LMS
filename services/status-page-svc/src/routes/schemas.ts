/**
 * Per-route Fastify JSON Schema definitions for `status-page-svc`.
 * See `services/learning-svc/src/routes/schemas.ts` for the 5.2 reference.
 */

const errorResponse = {
  type: "object",
  required: ["error"],
  additionalProperties: true,
  properties: { error: { type: "string" } },
} as const;

const serviceCheck = {
  type: "object",
  required: ["name", "status", "latencyMs", "statusCode"],
  additionalProperties: true,
  properties: {
    name: { type: "string" },
    status: { type: "string" },
    latencyMs: { type: "integer" },
    statusCode: { type: "integer" },
  },
} as const;

export const overviewSchema = {
  tags: ["Status"],
  operationId: "getStatusOverview",
  summary: "Aggregated health snapshot across all monitored services",
  response: {
    200: {
      type: "object",
      required: ["overall", "services", "checkedAt"],
      additionalProperties: true,
      properties: {
        overall: { type: "string" },
        services: { type: "array", items: serviceCheck },
        checkedAt: { type: "string", format: "date-time" },
        thresholds: {
          type: "object",
          additionalProperties: true,
          properties: {
            slowMs: { type: "integer" },
            downAlertAfter: { type: "integer" },
          },
        },
      },
    },
  },
} as const;

export const serviceStatusSchema = {
  tags: ["Status"],
  operationId: "getServiceStatus",
  summary: "Per-service health probe result",
  params: {
    type: "object",
    required: ["serviceName"],
    additionalProperties: true,
    properties: { serviceName: { type: "string" } },
  },
  response: {
    200: serviceCheck,
    404: errorResponse,
  },
} as const;

export const listIncidentsSchema = {
  tags: ["Status"],
  operationId: "listIncidents",
  summary: "List active and recent incidents",
  response: {
    200: {
      type: "object",
      required: ["incidents", "total"],
      additionalProperties: true,
      properties: {
        incidents: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        total: { type: "integer" },
      },
    },
  },
} as const;

export const createIncidentSchema = {
  tags: ["Status"],
  operationId: "createIncident",
  summary: "Open a new incident (admin only)",
  body: {
    type: "object",
    required: ["title"],
    additionalProperties: true,
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      severity: { type: "string" },
      affectedServices: { type: "array", items: { type: "string" } },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["id", "title", "status", "createdAt"],
      additionalProperties: true,
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        severity: { type: "string" },
        affectedServices: { type: "array", items: { type: "string" } },
        status: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const uptimeSchema = {
  tags: ["Status"],
  operationId: "getUptime",
  summary: "Aggregate uptime over a fixed period",
  response: {
    200: {
      type: "object",
      required: ["period", "uptime"],
      additionalProperties: true,
      properties: {
        period: { type: "string" },
        uptime: {
          type: "object",
          additionalProperties: true,
          properties: {
            overall: { type: "number" },
            byService: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
                properties: {
                  name: { type: "string" },
                  uptime: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const opsAlertsOutboxSchema = {
  tags: ["Status"],
  operationId: "getOpsAlertsOutbox",
  summary: "Aggregate ops-alerts outbox state across services",
  response: {
    200: {
      type: "object",
      required: ["tiles", "checkedAt"],
      additionalProperties: true,
      properties: {
        tiles: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        thresholds: {
          type: "object",
          additionalProperties: true,
          properties: {
            warningAfter: { type: "integer" },
            shutdownStaleMinutes: { type: "integer" },
          },
        },
        checkedAt: { type: "string", format: "date-time" },
      },
    },
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

export const healthRootSchema = {
  tags: ["Health"],
  operationId: "statusPageHealthRoot",
  summary: "Service health probe (root)",
  response: { 200: healthResponseSchema },
} as const;

export const healthSchema = {
  tags: ["Health"],
  operationId: "statusPageHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;
