import { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { eq, and, desc } from "drizzle-orm";
import { integrationConnections, integrationSyncLogs, integrationRosterMappings } from "@aivo/db";
import {
  listConnectorsSchema,
  getConnectorSchema,
  joinWaitlistSchema,
  listWaitlistSchema,
  oauthAuthorizeSchema,
  oauthCallbackSchema,
  connectIntegrationSchema,
  listConnectionsSchema,
  getConnectionSchema,
  disconnectIntegrationSchema,
  triggerSyncSchema,
  listSyncLogsSchema,
  getSyncStatusSchema,
  listRosterMappingsSchema,
} from "./connectors-schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`integrations-svc: ${name} must be set in production`);
  return devDefault;
}
const APP_URL = requireUrl("APP_URL", "http://localhost:5000");

export const CONNECTORS = [
  {
    id: "google_classroom",
    name: "Google Classroom",
    status: "available",
    category: "lms",
    description: "Sync rosters, classes, and assignments from Google Classroom.",
    icon: "google_classroom",
    features: ["roster_sync", "class_sync", "teacher_sync", "grade_passback"],
    authType: "oauth2",
    docsUrl: "https://developers.google.com/classroom",
  },
  {
    id: "clever",
    name: "Clever",
    status: "available",
    category: "sis",
    description: "Automatic roster sync via Clever's secure data platform.",
    icon: "clever",
    features: ["roster_sync", "school_sync", "teacher_sync", "section_sync"],
    authType: "oauth2",
    docsUrl: "https://dev.clever.com",
  },
  {
    id: "classlink",
    name: "ClassLink",
    status: "available",
    category: "sso",
    description: "OneRoster-compatible roster sync and single sign-on via ClassLink.",
    icon: "classlink",
    features: ["roster_sync", "sso", "teacher_sync", "org_sync"],
    authType: "oauth2",
    docsUrl: "https://developer.classlink.com",
  },
  {
    id: "canvas_lms",
    name: "Canvas LMS",
    status: "available",
    category: "lms",
    description: "Connect with Instructure Canvas for class and roster management.",
    icon: "canvas",
    features: ["roster_sync", "class_sync", "assignment_sync"],
    authType: "api_key",
    docsUrl: "https://canvas.instructure.com/doc/api",
  },
  {
    id: "schoology",
    name: "Schoology",
    status: "available",
    category: "lms",
    description: "Roster and class sync via Schoology/PowerSchool Learning.",
    icon: "schoology",
    features: ["roster_sync", "class_sync", "teacher_sync"],
    authType: "oauth2",
    docsUrl: "https://developers.schoology.com",
  },
  {
    id: "powerschool",
    name: "PowerSchool SIS",
    status: "available",
    category: "sis",
    description: "Direct PowerSchool SIS integration for student demographics and rosters.",
    icon: "powerschool",
    features: ["roster_sync", "demographics", "teacher_sync", "section_sync"],
    authType: "oauth2",
    docsUrl: "https://support.powerschool.com",
  },
];

async function requireAuth(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

async function requireAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(payload.role as string)) {
      return reply.status(403).send({ error: "Admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

function assertTenantAccess(user: any, targetTenantId: string): boolean {
  if (user.role === "PLATFORM_ADMIN") return true;
  return user.tenantId === targetTenantId;
}

async function assertConnectionAccess(db: any, user: any, connectionId: string) {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1);
  if (!connection) return null;
  if (!assertTenantAccess(user, connection.tenantId)) return null;
  return connection;
}

function getOAuthConfig(connectorId: string) {
  const configs: Record<string, any> = {
    google_classroom: {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.rosters.readonly",
        "https://www.googleapis.com/auth/classroom.profile.emails",
        "https://www.googleapis.com/auth/classroom.profile.photos",
      ],
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    clever: {
      authUrl: "https://clever.com/oauth/authorize",
      tokenUrl: "https://clever.com/oauth/tokens",
      scopes: [],
      clientId: process.env.CLEVER_CLIENT_ID || "",
      clientSecret: process.env.CLEVER_CLIENT_SECRET || "",
      apiBase: "https://api.clever.com/v3.0",
    },
    classlink: {
      authUrl: "https://launchpad.classlink.com/oauth2/v2/auth",
      tokenUrl: "https://launchpad.classlink.com/oauth2/v2/token",
      scopes: ["oneroster", "profile"],
      clientId: process.env.CLASSLINK_CLIENT_ID || "",
      clientSecret: process.env.CLASSLINK_CLIENT_SECRET || "",
      apiBase: "https://nodeapi.classlink.com",
    },
  };
  return configs[connectorId] || null;
}

interface WaitlistEntry {
  id: string;
  connectorId: string;
  districtId: string;
  contactEmail: string;
  createdAt: string;
}
const waitlistStore: WaitlistEntry[] = [];

export function getWaitlistStore() {
  return waitlistStore;
}

export function registerConnectorRoutes(app: FastifyInstance, db: any) {
  app.get("/api/integrations/connectors", { schema: listConnectorsSchema }, async () => {
    return { connectors: CONNECTORS };
  });

  app.post(
    "/api/integrations/waitlist",
    { schema: joinWaitlistSchema, preHandler: requireAuth },
    async (request, reply) => {
      const user = (request as any).user;
      const { connectorId, districtId: bodyDistrictId, contactEmail } = (request.body as any) || {};
      const districtId =
        user.role === "PLATFORM_ADMIN" ? bodyDistrictId || user.tenantId : user.tenantId;
      if (!connectorId || !districtId || !contactEmail) {
        return reply.code(400).send({ error: "connectorId, contactEmail required" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return reply.code(400).send({ error: "Invalid contactEmail" });
      }
      const connector = CONNECTORS.find((c) => c.id === connectorId);
      if (!connector) return reply.code(404).send({ error: "Connector not found" });
      if (connector.status !== "coming_soon") {
        return reply.code(400).send({ error: "This connector is already available" });
      }

      const existing = waitlistStore.find(
        (e) =>
          e.connectorId === connectorId &&
          e.districtId === districtId &&
          e.contactEmail.toLowerCase() === contactEmail.toLowerCase(),
      );
      if (existing) return { entry: existing, deduped: true };

      const entry: WaitlistEntry = {
        id: crypto.randomUUID(),
        connectorId,
        districtId,
        contactEmail,
        createdAt: new Date().toISOString(),
      };
      waitlistStore.push(entry);
      app.log.info({ connectorId, districtId }, "waitlist_signup");
      return { entry };
    },
  );

  app.get(
    "/api/integrations/waitlist",
    { schema: listWaitlistSchema, preHandler: requireAdmin },
    async (request) => {
      const user = (request as any).user;
      const entries =
        user.role === "PLATFORM_ADMIN"
          ? waitlistStore
          : waitlistStore.filter((e) => e.districtId === user.tenantId);
      return { entries, total: entries.length };
    },
  );

  app.get(
    "/api/integrations/connectors/:connectorId",
    { schema: getConnectorSchema },
    async (request, reply) => {
      const { connectorId } = request.params as any;
      const connector = CONNECTORS.find((c) => c.id === connectorId);
      if (!connector) return reply.code(404).send({ error: "Connector not found" });
      return connector;
    },
  );

  app.get(
    "/api/integrations/oauth/:connectorId/authorize",
    { schema: oauthAuthorizeSchema, preHandler: requireAdmin },
    async (request, reply) => {
      const { connectorId } = request.params as any;
      const { tenantId, redirectUri } = request.query as any;
      const config = getOAuthConfig(connectorId);
      if (!config) return reply.code(400).send({ error: "OAuth not supported for this connector" });
      if (!config.clientId)
        return reply.code(500).send({
          error: `OAuth client not configured for ${connectorId}. Set environment variables.`,
        });

      const state = Buffer.from(JSON.stringify({ tenantId, connectorId })).toString("base64url");
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri || `${APP_URL}/api/integrations/oauth/callback`,
        response_type: "code",
        scope: config.scopes.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
      });

      return { authorizationUrl: `${config.authUrl}?${params.toString()}` };
    },
  );

  app.get(
    "/api/integrations/oauth/callback",
    { schema: oauthCallbackSchema },
    async (request, reply) => {
      const { code, state, error: oauthError } = request.query as any;
      if (oauthError) return reply.redirect(`/dashboard/district/integrations?error=${oauthError}`);

      try {
        const { tenantId, connectorId } = JSON.parse(Buffer.from(state, "base64url").toString());
        const config = getOAuthConfig(connectorId);
        if (!config)
          return reply.redirect("/dashboard/district/integrations?error=invalid_connector");

        const tokenRes = await fetch(config.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: `${APP_URL}/api/integrations/oauth/callback`,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.text();
          app.log.error(`OAuth token exchange failed for ${connectorId}: ${err}`);
          return reply.redirect(`/dashboard/district/integrations?error=token_exchange_failed`);
        }

        const tokens = (await tokenRes.json()) as any;
        const connector = CONNECTORS.find((c) => c.id === connectorId);

        const [connection] = await db
          .insert(integrationConnections)
          .values({
            tenantId,
            connectorId,
            connectorName: connector?.name || connectorId,
            connectorType: connector?.category || "lms",
            status: "authorized",
            credentials: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                : null,
              tokenType: tokens.token_type,
            },
            connectedAt: new Date(),
          })
          .returning();

        return reply.redirect(`/dashboard/district/integrations?connected=${connection.id}`);
      } catch (err: any) {
        app.log.error(`OAuth callback error: ${err.message}`);
        return reply.redirect(`/dashboard/district/integrations?error=callback_failed`);
      }
    },
  );

  app.post(
    "/api/integrations/connect",
    { schema: connectIntegrationSchema, preHandler: requireAdmin },
    async (request, reply) => {
      const { tenantId, connectorId, credentials, config: connConfig } = request.body as any;
      if (!tenantId || !connectorId)
        return reply.code(400).send({ error: "tenantId and connectorId required" });

      const user = (request as any).user;
      if (!assertTenantAccess(user, tenantId)) {
        return reply
          .status(403)
          .send({ error: "You can only manage integrations for your own tenant" });
      }

      const connector = CONNECTORS.find((c) => c.id === connectorId);
      if (!connector) return reply.code(404).send({ error: "Connector not found" });
      if (connector.status === "coming_soon")
        return reply.code(400).send({ error: "This connector is not yet available" });

      const existing = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.tenantId, tenantId),
            eq(integrationConnections.connectorId, connectorId),
            eq(integrationConnections.status, "active"),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return reply
          .code(409)
          .send({ error: "This integration is already connected for this tenant" });
      }

      const [connection] = await db
        .insert(integrationConnections)
        .values({
          tenantId,
          connectorId,
          connectorName: connector.name,
          connectorType: connector.category,
          status: connector.authType === "api_key" ? "active" : "pending",
          credentials: credentials || {},
          config: connConfig || {},
          connectedBy: user.sub || user.userId,
          connectedAt: new Date(),
        })
        .returning();

      return { connection };
    },
  );

  app.get(
    "/api/integrations/connections/:tenantId",
    { schema: listConnectionsSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { tenantId } = request.params as any;
      const user = (request as any).user;
      if (user.tenantId !== tenantId && !["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(user.role)) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const connections = await db
        .select()
        .from(integrationConnections)
        .where(eq(integrationConnections.tenantId, tenantId))
        .orderBy(desc(integrationConnections.createdAt));

      const safeConnections = connections.map((c: any) => ({
        ...c,
        credentials: undefined,
        hasCredentials: !!c.credentials && Object.keys(c.credentials).length > 0,
      }));

      return { tenantId, connections: safeConnections };
    },
  );

  app.get(
    "/api/integrations/connection/:connectionId",
    { schema: getConnectionSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { connectionId } = request.params as any;
      const [connection] = await db
        .select()
        .from(integrationConnections)
        .where(eq(integrationConnections.id, connectionId))
        .limit(1);

      if (!connection) return reply.code(404).send({ error: "Connection not found" });

      const user = (request as any).user;
      if (
        user.tenantId !== connection.tenantId &&
        !["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(user.role)
      ) {
        return reply.status(403).send({ error: "Access denied" });
      }

      return {
        ...connection,
        credentials: undefined,
        hasCredentials:
          !!connection.credentials && Object.keys(connection.credentials as any).length > 0,
      };
    },
  );

  app.delete(
    "/api/integrations/disconnect/:connectionId",
    { schema: disconnectIntegrationSchema, preHandler: requireAdmin },
    async (request, reply) => {
      const { connectionId } = request.params as any;
      const user = (request as any).user;

      const connection = await assertConnectionAccess(db, user, connectionId);
      if (!connection)
        return reply.code(404).send({ error: "Connection not found or access denied" });

      await db
        .update(integrationConnections)
        .set({
          status: "disconnected",
          disconnectedAt: new Date(),
          updatedAt: new Date(),
          credentials: {},
        })
        .where(eq(integrationConnections.id, connectionId));

      return { status: "disconnected", connectionId };
    },
  );

  app.post(
    "/api/integrations/sync/:connectionId",
    { schema: triggerSyncSchema, preHandler: requireAdmin },
    async (request, reply) => {
      const { connectionId } = request.params as any;
      const { syncType = "full" } = (request.body as any) || {};
      const user = (request as any).user;

      const connection = await assertConnectionAccess(db, user, connectionId);
      if (!connection)
        return reply.code(404).send({ error: "Connection not found or access denied" });
      if (connection.status !== "active" && connection.status !== "authorized") {
        return reply
          .code(400)
          .send({ error: `Cannot sync connection with status: ${connection.status}` });
      }
      const [syncLog] = await db
        .insert(integrationSyncLogs)
        .values({
          connectionId,
          syncType,
          status: "running",
          triggeredBy: user.sub || user.userId,
        })
        .returning();

      await db
        .update(integrationConnections)
        .set({ status: "syncing", updatedAt: new Date() })
        .where(eq(integrationConnections.id, connectionId));

      runSyncInBackground(db, connection, syncLog.id).catch((err: any) => {
        app.log.error(`Sync failed for ${connectionId}: ${err.message}`);
      });

      return {
        status: "sync_started",
        connectionId,
        syncId: syncLog.id,
        startedAt: syncLog.startedAt,
      };
    },
  );

  app.get(
    "/api/integrations/sync-logs/:connectionId",
    { schema: listSyncLogsSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { connectionId } = request.params as any;
      const user = (request as any).user;

      const connection = await assertConnectionAccess(db, user, connectionId);
      if (!connection)
        return reply.code(404).send({ error: "Connection not found or access denied" });

      const logs = await db
        .select()
        .from(integrationSyncLogs)
        .where(eq(integrationSyncLogs.connectionId, connectionId))
        .orderBy(desc(integrationSyncLogs.startedAt))
        .limit(20);

      return { logs };
    },
  );

  app.get(
    "/api/integrations/sync/:syncId/status",
    { schema: getSyncStatusSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { syncId } = request.params as any;
      const [log] = await db
        .select()
        .from(integrationSyncLogs)
        .where(eq(integrationSyncLogs.id, syncId))
        .limit(1);

      if (!log) return reply.code(404).send({ error: "Sync log not found" });
      return log;
    },
  );

  app.get(
    "/api/integrations/roster-mappings/:connectionId",
    { schema: listRosterMappingsSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { connectionId } = request.params as any;
      const { type } = request.query as any;
      const user = (request as any).user;

      const connection = await assertConnectionAccess(db, user, connectionId);
      if (!connection)
        return reply.code(404).send({ error: "Connection not found or access denied" });

      let query = db
        .select()
        .from(integrationRosterMappings)
        .where(eq(integrationRosterMappings.connectionId, connectionId));

      if (type) {
        query = db
          .select()
          .from(integrationRosterMappings)
          .where(
            and(
              eq(integrationRosterMappings.connectionId, connectionId),
              eq(integrationRosterMappings.externalType, type),
            ),
          );
      }

      const mappings = await query.orderBy(desc(integrationRosterMappings.lastSyncedAt)).limit(100);
      return { mappings };
    },
  );
}

async function runSyncInBackground(db: any, connection: any, syncLogId: string) {
  const startTime = Date.now();
  let recordsSynced = 0;
  let recordsFailed = 0;
  let recordsSkipped = 0;
  const errors: any[] = [];

  try {
    const creds = connection.credentials as any;

    switch (connection.connectorId) {
      case "google_classroom":
        const gcResult = await syncGoogleClassroom(db, connection, creds);
        recordsSynced = gcResult.synced;
        recordsFailed = gcResult.failed;
        recordsSkipped = gcResult.skipped;
        errors.push(...gcResult.errors);
        break;

      case "clever":
        const cleverResult = await syncClever(db, connection, creds);
        recordsSynced = cleverResult.synced;
        recordsFailed = cleverResult.failed;
        recordsSkipped = cleverResult.skipped;
        errors.push(...cleverResult.errors);
        break;

      case "classlink":
        const clResult = await syncClassLink(db, connection, creds);
        recordsSynced = clResult.synced;
        recordsFailed = clResult.failed;
        recordsSkipped = clResult.skipped;
        errors.push(...clResult.errors);
        break;

      case "canvas_lms":
        const canvasResult = await syncCanvasLMS(db, connection, creds);
        recordsSynced = canvasResult.synced;
        recordsFailed = canvasResult.failed;
        recordsSkipped = canvasResult.skipped;
        errors.push(...canvasResult.errors);
        break;

      case "schoology":
        const schoologyResult = await syncSchoology(db, connection, creds);
        recordsSynced = schoologyResult.synced;
        recordsFailed = schoologyResult.failed;
        recordsSkipped = schoologyResult.skipped;
        errors.push(...schoologyResult.errors);
        break;

      case "powerschool":
        const psResult = await syncPowerSchool(db, connection, creds);
        recordsSynced = psResult.synced;
        recordsFailed = psResult.failed;
        recordsSkipped = psResult.skipped;
        errors.push(...psResult.errors);
        break;

      default:
        errors.push({ message: `No sync handler for connector: ${connection.connectorId}` });
    }

    const durationMs = Date.now() - startTime;
    const finalStatus =
      errors.length > 0 && recordsSynced === 0
        ? "failed"
        : errors.length > 0
          ? "partial"
          : "completed";

    await db
      .update(integrationSyncLogs)
      .set({
        status: finalStatus,
        recordsSynced,
        recordsFailed,
        recordsSkipped,
        errors,
        completedAt: new Date(),
        durationMs,
      })
      .where(eq(integrationSyncLogs.id, syncLogId));

    await db
      .update(integrationConnections)
      .set({
        status: "active",
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connection.id));
  } catch (err: any) {
    await db
      .update(integrationSyncLogs)
      .set({
        status: "failed",
        errors: [{ message: err.message }],
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      })
      .where(eq(integrationSyncLogs.id, syncLogId));

    await db
      .update(integrationConnections)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(integrationConnections.id, connection.id));
  }
}

async function syncGoogleClassroom(db: any, connection: any, creds: any) {
  const result = { synced: 0, failed: 0, skipped: 0, errors: [] as any[] };

  try {
    const coursesRes = await fetch(
      "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE",
      {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      },
    );

    if (!coursesRes.ok) {
      if (coursesRes.status === 401) {
        result.errors.push({
          message: "Google Classroom access token expired. Re-authorize the connection.",
        });
        return result;
      }
      result.errors.push({ message: `Failed to fetch courses: ${coursesRes.status}` });
      return result;
    }

    const coursesData = (await coursesRes.json()) as any;
    const courses = coursesData.courses || [];

    for (const course of courses) {
      try {
        await db
          .insert(integrationRosterMappings)
          .values({
            connectionId: connection.id,
            externalId: course.id,
            externalType: "class",
            aivoType: "class",
            externalData: {
              name: course.name,
              section: course.section,
              descriptionHeading: course.descriptionHeading,
              courseState: course.courseState,
            },
            lastSyncedAt: new Date(),
          })
          .onConflictDoNothing();
        result.synced++;

        const studentsRes = await fetch(
          `https://classroom.googleapis.com/v1/courses/${course.id}/students`,
          {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
          },
        );

        if (studentsRes.ok) {
          const studentsData = (await studentsRes.json()) as any;
          for (const student of studentsData.students || []) {
            try {
              await db
                .insert(integrationRosterMappings)
                .values({
                  connectionId: connection.id,
                  externalId: student.userId,
                  externalType: "student",
                  aivoType: "learner",
                  externalData: {
                    name: student.profile?.name?.fullName,
                    email: student.profile?.emailAddress,
                    courseId: course.id,
                    courseName: course.name,
                  },
                  lastSyncedAt: new Date(),
                })
                .onConflictDoNothing();
              result.synced++;
            } catch {
              result.failed++;
            }
          }
        }

        const teachersRes = await fetch(
          `https://classroom.googleapis.com/v1/courses/${course.id}/teachers`,
          {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
          },
        );

        if (teachersRes.ok) {
          const teachersData = (await teachersRes.json()) as any;
          for (const teacher of teachersData.teachers || []) {
            try {
              await db
                .insert(integrationRosterMappings)
                .values({
                  connectionId: connection.id,
                  externalId: teacher.userId,
                  externalType: "teacher",
                  aivoType: "teacher",
                  externalData: {
                    name: teacher.profile?.name?.fullName,
                    email: teacher.profile?.emailAddress,
                    courseId: course.id,
                    courseName: course.name,
                  },
                  lastSyncedAt: new Date(),
                })
                .onConflictDoNothing();
              result.synced++;
            } catch {
              result.failed++;
            }
          }
        }
      } catch (err: any) {
        result.errors.push({ message: `Error syncing course ${course.id}: ${err.message}` });
        result.failed++;
      }
    }
  } catch (err: any) {
    result.errors.push({ message: `Google Classroom sync error: ${err.message}` });
  }

  return result;
}

async function syncClever(db: any, connection: any, creds: any) {
  const result = { synced: 0, failed: 0, skipped: 0, errors: [] as any[] };
  const apiBase = "https://api.clever.com/v3.0";

  try {
    const meRes = await fetch(`${apiBase}/me`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (!meRes.ok) {
      result.errors.push({ message: `Clever API auth failed: ${meRes.status}` });
      return result;
    }

    const studentsRes = await fetch(`${apiBase}/users?role=student&limit=1000`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (studentsRes.ok) {
      const studentsData = (await studentsRes.json()) as any;
      for (const student of studentsData.data || []) {
        try {
          await db
            .insert(integrationRosterMappings)
            .values({
              connectionId: connection.id,
              externalId: student.data?.id || student.id,
              externalType: "student",
              aivoType: "learner",
              externalData: {
                name: `${student.data?.name?.first || ""} ${student.data?.name?.last || ""}`.trim(),
                email: student.data?.email,
                grade: student.data?.grade,
                school: student.data?.school,
                sisId: student.data?.sis_id,
              },
              lastSyncedAt: new Date(),
            })
            .onConflictDoNothing();
          result.synced++;
        } catch {
          result.failed++;
        }
      }
    }

    const teachersRes = await fetch(`${apiBase}/users?role=teacher&limit=1000`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (teachersRes.ok) {
      const teachersData = (await teachersRes.json()) as any;
      for (const teacher of teachersData.data || []) {
        try {
          await db
            .insert(integrationRosterMappings)
            .values({
              connectionId: connection.id,
              externalId: teacher.data?.id || teacher.id,
              externalType: "teacher",
              aivoType: "teacher",
              externalData: {
                name: `${teacher.data?.name?.first || ""} ${teacher.data?.name?.last || ""}`.trim(),
                email: teacher.data?.email,
                school: teacher.data?.school,
                sisId: teacher.data?.sis_id,
              },
              lastSyncedAt: new Date(),
            })
            .onConflictDoNothing();
          result.synced++;
        } catch {
          result.failed++;
        }
      }
    }

    const sectionsRes = await fetch(`${apiBase}/sections?limit=1000`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (sectionsRes.ok) {
      const sectionsData = (await sectionsRes.json()) as any;
      for (const section of sectionsData.data || []) {
        try {
          await db
            .insert(integrationRosterMappings)
            .values({
              connectionId: connection.id,
              externalId: section.data?.id || section.id,
              externalType: "section",
              aivoType: "class",
              externalData: {
                name: section.data?.name,
                subject: section.data?.subject,
                course: section.data?.course,
                grade: section.data?.grade,
                students: section.data?.students,
                teacher: section.data?.teacher,
              },
              lastSyncedAt: new Date(),
            })
            .onConflictDoNothing();
          result.synced++;
        } catch {
          result.failed++;
        }
      }
    }
  } catch (err: any) {
    result.errors.push({ message: `Clever sync error: ${err.message}` });
  }

  return result;
}

async function syncClassLink(db: any, connection: any, creds: any) {
  const result = { synced: 0, failed: 0, skipped: 0, errors: [] as any[] };
  const apiBase = "https://nodeapi.classlink.com";

  try {
    const usersRes = await fetch(`${apiBase}/v2/my/users`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (!usersRes.ok) {
      result.errors.push({ message: `ClassLink API failed: ${usersRes.status}` });
      return result;
    }

    const users = (await usersRes.json()) as any[];
    for (const user of Array.isArray(users) ? users : []) {
      try {
        const role =
          user.Role === "Student" ? "student" : user.Role === "Teacher" ? "teacher" : "other";
        if (role === "other") {
          result.skipped++;
          continue;
        }

        await db
          .insert(integrationRosterMappings)
          .values({
            connectionId: connection.id,
            externalId: user.UserId || user.SourcedId,
            externalType: role,
            aivoType: role === "student" ? "learner" : "teacher",
            externalData: {
              name: `${user.FirstName || ""} ${user.LastName || ""}`.trim(),
              email: user.Email,
              role: user.Role,
              org: user.OrgName,
              grade: user.Grade,
            },
            lastSyncedAt: new Date(),
          })
          .onConflictDoNothing();
        result.synced++;
      } catch {
        result.failed++;
      }
    }

    const classesRes = await fetch(`${apiBase}/v2/my/classes`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (classesRes.ok) {
      const classes = (await classesRes.json()) as any[];
      for (const cls of Array.isArray(classes) ? classes : []) {
        try {
          await db
            .insert(integrationRosterMappings)
            .values({
              connectionId: connection.id,
              externalId: cls.SourcedId || cls.ClassId,
              externalType: "class",
              aivoType: "class",
              externalData: {
                name: cls.Title || cls.ClassName,
                subject: cls.Subject,
                grade: cls.Grade,
                course: cls.CourseTitle,
              },
              lastSyncedAt: new Date(),
            })
            .onConflictDoNothing();
          result.synced++;
        } catch {
          result.failed++;
        }
      }
    }
  } catch (err: any) {
    result.errors.push({ message: `ClassLink sync error: ${err.message}` });
  }

  return result;
}

async function syncCanvasLMS(db: any, connection: any, creds: any) {
  const result = { synced: 0, failed: 0, skipped: 0, errors: [] as any[] };
  const baseUrl = (connection.config as any)?.canvasUrl;
  const apiToken = creds.apiToken || creds.accessToken;

  if (!baseUrl) {
    result.errors.push({
      message: "Canvas URL not configured. Set the Canvas instance URL in connection config.",
    });
    return result;
  }

  try {
    const coursesRes = await fetch(
      `${baseUrl}/api/v1/courses?enrollment_state=active&per_page=100`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );

    if (!coursesRes.ok) {
      result.errors.push({ message: `Canvas API failed: ${coursesRes.status}` });
      return result;
    }

    const courses = (await coursesRes.json()) as any[];
    for (const course of courses) {
      try {
        await db
          .insert(integrationRosterMappings)
          .values({
            connectionId: connection.id,
            externalId: String(course.id),
            externalType: "class",
            aivoType: "class",
            externalData: {
              name: course.name,
              courseCode: course.course_code,
              enrollments: course.total_students,
            },
            lastSyncedAt: new Date(),
          })
          .onConflictDoNothing();
        result.synced++;

        const enrollmentsRes = await fetch(
          `${baseUrl}/api/v1/courses/${course.id}/enrollments?per_page=100`,
          {
            headers: { Authorization: `Bearer ${apiToken}` },
          },
        );

        if (enrollmentsRes.ok) {
          const enrollments = (await enrollmentsRes.json()) as any[];
          for (const enrollment of enrollments) {
            const type =
              enrollment.type === "StudentEnrollment"
                ? "student"
                : enrollment.type === "TeacherEnrollment"
                  ? "teacher"
                  : null;
            if (!type) {
              result.skipped++;
              continue;
            }

            try {
              await db
                .insert(integrationRosterMappings)
                .values({
                  connectionId: connection.id,
                  externalId: String(enrollment.user_id),
                  externalType: type,
                  aivoType: type === "student" ? "learner" : "teacher",
                  externalData: {
                    name: enrollment.user?.name,
                    email: enrollment.user?.login_id,
                    courseId: String(course.id),
                    courseName: course.name,
                    enrollmentState: enrollment.enrollment_state,
                  },
                  lastSyncedAt: new Date(),
                })
                .onConflictDoNothing();
              result.synced++;
            } catch {
              result.failed++;
            }
          }
        }
      } catch (err: any) {
        result.errors.push({ message: `Error syncing Canvas course ${course.id}: ${err.message}` });
        result.failed++;
      }
    }
  } catch (err: any) {
    result.errors.push({ message: `Canvas sync error: ${err.message}` });
  }

  return result;
}

type FetchLike = (url: string, init?: any) => Promise<any>;

/**
 * Schoology roster sync (REST API v1).
 *
 * Pulls students, teachers, and sections and maps them into
 * integration_roster_mappings. `fetchImpl` is injectable for tests; production
 * uses the global fetch with the connection's OAuth2 access token.
 *
 * @see https://developers.schoology.com/api-documentation/rest-api-v1
 */
export async function syncSchoology(
  db: any,
  connection: any,
  creds: any,
  fetchImpl: FetchLike = fetch,
) {
  const result = { synced: 0, failed: 0, skipped: 0, errors: [] as any[] };
  const apiBase = (connection.config as any)?.schoologyApiBase || "https://api.schoology.com/v1";
  const token = creds.accessToken || creds.apiToken;

  if (!token) {
    result.errors.push({ message: "Schoology access token missing from credentials." });
    return result;
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const upsert = async (
    externalId: string,
    externalType: string,
    aivoType: string,
    externalData: Record<string, unknown>,
  ) => {
    try {
      await db
        .insert(integrationRosterMappings)
        .values({
          connectionId: connection.id,
          externalId,
          externalType,
          aivoType,
          externalData,
          lastSyncedAt: new Date(),
        })
        .onConflictDoNothing();
      result.synced++;
    } catch {
      result.failed++;
    }
  };

  try {
    // Users (students + teachers). Schoology paginates with start/limit and
    // exposes the role via `role_id`; the `users` collection is under `user`.
    const usersRes = await fetchImpl(`${apiBase}/users?limit=200`, { headers });
    if (!usersRes.ok) {
      result.errors.push({ message: `Schoology users fetch failed: ${usersRes.status}` });
      return result;
    }
    const usersData = (await usersRes.json()) as any;
    for (const u of usersData.user || []) {
      const isTeacher = u.role_id != null && String(u.role_id) === String(usersData.teacher_role_id);
      const type = isTeacher ? "teacher" : "student";
      await upsert(String(u.uid ?? u.id), type, type === "student" ? "learner" : "teacher", {
        name: u.name_display || `${u.name_first || ""} ${u.name_last || ""}`.trim(),
        email: u.primary_email,
        gradeLevel: u.grad_year,
        schoolId: u.school_id,
        username: u.username,
      });
    }

    // Sections (classes).
    const sectionsRes = await fetchImpl(`${apiBase}/sections?limit=200`, { headers });
    if (sectionsRes.ok) {
      const sectionsData = (await sectionsRes.json()) as any;
      for (const s of sectionsData.section || []) {
        await upsert(String(s.id), "section", "class", {
          name: s.section_title || s.course_title,
          courseTitle: s.course_title,
          gradeLevel: s.grade_level_range,
          schoolId: s.school_id,
        });
      }
    }
  } catch (err: any) {
    result.errors.push({ message: `Schoology sync error: ${err.message}` });
  }

  return result;
}

/**
 * PowerSchool SIS roster sync (PowerQuery / core resources under /ws/v1).
 *
 * Pulls students, staff, and sections for the configured server. The server
 * host comes from the connection config; the OAuth2 client-credentials access
 * token comes from the stored credentials. `fetchImpl` is injectable for tests.
 *
 * @see https://support.powerschool.com/developer/
 */
export async function syncPowerSchool(
  db: any,
  connection: any,
  creds: any,
  fetchImpl: FetchLike = fetch,
) {
  const result = { synced: 0, failed: 0, skipped: 0, errors: [] as any[] };
  const host = ((connection.config as any)?.powerschoolUrl || creds.host || "").replace(/\/$/, "");
  const token = creds.accessToken;

  if (!host) {
    result.errors.push({ message: "PowerSchool server URL not configured in connection config." });
    return result;
  }
  if (!token) {
    result.errors.push({ message: "PowerSchool access token missing from credentials." });
    return result;
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const upsert = async (
    externalId: string,
    externalType: string,
    aivoType: string,
    externalData: Record<string, unknown>,
  ) => {
    try {
      await db
        .insert(integrationRosterMappings)
        .values({
          connectionId: connection.id,
          externalId,
          externalType,
          aivoType,
          externalData,
          lastSyncedAt: new Date(),
        })
        .onConflictDoNothing();
      result.synced++;
    } catch {
      result.failed++;
    }
  };

  try {
    // Students: /ws/v1/district/student returns { students: { student: [...] } }.
    const studentsRes = await fetchImpl(`${host}/ws/v1/district/student?pagesize=200`, { headers });
    if (!studentsRes.ok) {
      result.errors.push({ message: `PowerSchool student fetch failed: ${studentsRes.status}` });
      return result;
    }
    const studentsData = (await studentsRes.json()) as any;
    const students = studentsData.students?.student || [];
    for (const s of Array.isArray(students) ? students : [students]) {
      const name = s.name || {};
      await upsert(String(s.id ?? s.local_id), "student", "learner", {
        name: `${name.first_name || ""} ${name.last_name || ""}`.trim(),
        gradeLevel: s.school_enrollment?.grade_level,
        schoolId: s.school_enrollment?.school_number,
        studentNumber: s.local_id,
        dob: s.demographics?.birth_date,
      });
    }

    // Staff: /ws/v1/district/staff.
    const staffRes = await fetchImpl(`${host}/ws/v1/district/staff?pagesize=200`, { headers });
    if (staffRes.ok) {
      const staffData = (await staffRes.json()) as any;
      const staff = staffData.staffs?.staff || [];
      for (const t of Array.isArray(staff) ? staff : [staff]) {
        const name = t.name || {};
        await upsert(String(t.id ?? t.local_id), "teacher", "teacher", {
          name: `${name.first_name || ""} ${name.last_name || ""}`.trim(),
          email: t.emails?.work_email,
          schoolId: t.school_affiliations?.school_affiliation?.[0]?.school_number,
        });
      }
    }

    // Sections: /ws/v1/district/section.
    const sectionsRes = await fetchImpl(`${host}/ws/v1/district/section?pagesize=200`, { headers });
    if (sectionsRes.ok) {
      const sectionsData = (await sectionsRes.json()) as any;
      const sections = sectionsData.sections?.section || [];
      for (const sec of Array.isArray(sections) ? sections : [sections]) {
        await upsert(String(sec.id), "section", "class", {
          name: sec.section_number,
          courseId: sec.course_id,
          termId: sec.term_id,
          teacherId: sec.staff_id,
          schoolId: sec.school_id,
        });
      }
    }
  } catch (err: any) {
    result.errors.push({ message: `PowerSchool sync error: ${err.message}` });
  }

  return result;
}
