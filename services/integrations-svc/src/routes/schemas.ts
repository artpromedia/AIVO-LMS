/**
 * Per-route Fastify JSON Schema definitions for `integrations-svc`.
 * See `services/learning-svc/src/routes/schemas.ts` for the 5.2 reference.
 *
 * Connection / sync-log rows come straight from drizzle and are
 * declared as `additionalProperties: true` objects so all columns flow
 * through to the typed client without re-mapping every shape here.
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

const connector = {
  type: "object",
  required: ["id", "name", "status", "category"],
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    status: { type: "string" },
    category: { type: "string" },
    description: { type: "string" },
    icon: { type: "string" },
    features: { type: "array", items: { type: "string" } },
    authType: { type: "string" },
    docsUrl: { type: "string" },
  },
} as const;

const waitlistEntry = {
  type: "object",
  required: ["id", "connectorId", "districtId", "contactEmail", "createdAt"],
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    connectorId: { type: "string" },
    districtId: { type: "string" },
    contactEmail: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

export const listConnectorsSchema = {
  tags: ["Integrations"],
  operationId: "listConnectors",
  summary: "List all available integration connectors",
  response: {
    200: {
      type: "object",
      required: ["connectors"],
      additionalProperties: true,
      properties: { connectors: { type: "array", items: connector } },
    },
  },
} as const;

export const getConnectorSchema = {
  tags: ["Integrations"],
  operationId: "getConnector",
  summary: "Get connector metadata by id",
  params: {
    type: "object",
    required: ["connectorId"],
    additionalProperties: true,
    properties: { connectorId: { type: "string" } },
  },
  response: { 200: connector, 404: errorResponse },
} as const;

export const joinWaitlistSchema = {
  tags: ["Integrations"],
  operationId: "joinConnectorWaitlist",
  summary: "Sign up for a waitlist on a coming-soon connector",
  body: {
    type: "object",
    required: ["connectorId", "contactEmail"],
    additionalProperties: true,
    properties: {
      connectorId: { type: "string" },
      districtId: { type: "string" },
      contactEmail: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["entry"],
      additionalProperties: true,
      properties: {
        entry: waitlistEntry,
        deduped: { type: "boolean" },
      },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
  },
} as const;

export const listWaitlistSchema = {
  tags: ["Integrations"],
  operationId: "listWaitlistEntries",
  summary: "List waitlist signups for the caller's tenant (or all, for platform admin)",
  response: {
    200: {
      type: "object",
      required: ["entries", "total"],
      additionalProperties: true,
      properties: {
        entries: { type: "array", items: waitlistEntry },
        total: { type: "integer" },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const oauthAuthorizeSchema = {
  tags: ["Integrations"],
  operationId: "getOAuthAuthorizationUrl",
  summary: "Build the OAuth authorization URL for a connector",
  params: {
    type: "object",
    required: ["connectorId"],
    additionalProperties: true,
    properties: { connectorId: { type: "string" } },
  },
  querystring: {
    type: "object",
    additionalProperties: true,
    properties: {
      tenantId: { type: "string" },
      redirectUri: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["authorizationUrl"],
      additionalProperties: true,
      properties: { authorizationUrl: { type: "string" } },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    500: errorResponse,
  },
} as const;

export const oauthCallbackSchema = {
  tags: ["Integrations"],
  operationId: "handleOAuthCallback",
  summary: "OAuth provider redirect target — always responds 302",
  querystring: {
    type: "object",
    additionalProperties: true,
    properties: {
      code: { type: "string" },
      state: { type: "string" },
      error: { type: "string" },
    },
  },
  response: {
    302: { type: "null" },
  },
} as const;

export const connectIntegrationSchema = {
  tags: ["Integrations"],
  operationId: "connectIntegration",
  summary: "Establish a non-OAuth connection (or finalize a manual one)",
  body: {
    type: "object",
    required: ["tenantId", "connectorId"],
    additionalProperties: true,
    properties: {
      tenantId: { type: "string" },
      connectorId: { type: "string" },
      credentials: passthroughObject,
      config: passthroughObject,
    },
  },
  response: {
    200: {
      type: "object",
      required: ["connection"],
      additionalProperties: true,
      properties: { connection: passthroughObject },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
  },
} as const;

export const listConnectionsSchema = {
  tags: ["Integrations"],
  operationId: "listTenantConnections",
  summary: "List all integration connections for a tenant",
  params: {
    type: "object",
    required: ["tenantId"],
    additionalProperties: true,
    properties: { tenantId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["tenantId", "connections"],
      additionalProperties: true,
      properties: {
        tenantId: { type: "string" },
        connections: { type: "array", items: passthroughObject },
      },
    },
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const getConnectionSchema = {
  tags: ["Integrations"],
  operationId: "getConnection",
  summary: "Fetch a single connection by id (credentials redacted)",
  params: {
    type: "object",
    required: ["connectionId"],
    additionalProperties: true,
    properties: { connectionId: { type: "string" } },
  },
  response: {
    200: passthroughObject,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const disconnectIntegrationSchema = {
  tags: ["Integrations"],
  operationId: "disconnectIntegration",
  summary: "Mark a connection as disconnected and clear stored credentials",
  params: {
    type: "object",
    required: ["connectionId"],
    additionalProperties: true,
    properties: { connectionId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "connectionId"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        connectionId: { type: "string" },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const triggerSyncSchema = {
  tags: ["Integrations"],
  operationId: "triggerConnectionSync",
  summary: "Kick off a sync (full or incremental) on a connection",
  params: {
    type: "object",
    required: ["connectionId"],
    additionalProperties: true,
    properties: { connectionId: { type: "string" } },
  },
  body: {
    type: "object",
    additionalProperties: true,
    properties: { syncType: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["status", "connectionId", "syncId"],
      additionalProperties: true,
      properties: {
        status: { type: "string" },
        connectionId: { type: "string" },
        syncId: { type: "string" },
        startedAt: { type: ["string", "null"], format: "date-time" },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const listSyncLogsSchema = {
  tags: ["Integrations"],
  operationId: "listConnectionSyncLogs",
  summary: "List recent sync log entries for a connection",
  params: {
    type: "object",
    required: ["connectionId"],
    additionalProperties: true,
    properties: { connectionId: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["logs"],
      additionalProperties: true,
      properties: { logs: { type: "array", items: passthroughObject } },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const getSyncStatusSchema = {
  tags: ["Integrations"],
  operationId: "getSyncStatus",
  summary: "Get a single sync log entry",
  params: {
    type: "object",
    required: ["syncId"],
    additionalProperties: true,
    properties: { syncId: { type: "string" } },
  },
  response: {
    200: passthroughObject,
    401: errorResponse,
    404: errorResponse,
  },
} as const;

export const listRosterMappingsSchema = {
  tags: ["Integrations"],
  operationId: "listRosterMappings",
  summary: "List external→internal roster id mappings for a connection",
  params: {
    type: "object",
    required: ["connectionId"],
    additionalProperties: true,
    properties: { connectionId: { type: "string" } },
  },
  querystring: {
    type: "object",
    additionalProperties: true,
    properties: { type: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["mappings"],
      additionalProperties: true,
      properties: { mappings: { type: "array", items: passthroughObject } },
    },
    401: errorResponse,
    403: errorResponse,
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
  operationId: "integrationsHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;
