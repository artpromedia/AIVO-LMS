/**
 * Sprint 6 — School notification-preference matrix (admin-svc).
 *
 * Stores a per-school matrix of event type × staff role → email on/off.
 * Persistence is delegated to a NotificationStore (Postgres in production,
 * in-memory for tests / local dev) following the dpa-store precedent in
 * data-governance-svc. The matrix survives restart and is auditable.
 *
 * RBAC: allowed for PLATFORM_ADMIN, DISTRICT_ADMIN, SCHOOL_ADMIN.
 * Note: finer school-ownership scoping is enforced at the BFF/identity layer.
 */
import type { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { logAuditEvent } from "./audit.js";
import {
  type NotificationMatrix,
  type NotificationStore,
  DEFAULT_STAFF_ROLES,
  InMemoryNotificationStore,
  selectNotificationStore,
} from "../stores/notification-store.js";
import {
  getAdminSchoolsNotificationsSchema,
  putAdminSchoolsNotificationsSchema,
} from "./schemas.js";

export type { NotificationMatrix };

// ---------------------------------------------------------------------------
// RBAC helper
// ---------------------------------------------------------------------------
const ALLOWED_ROLES = new Set(["PLATFORM_ADMIN", "DISTRICT_ADMIN", "SCHOOL_ADMIN"]);

async function requireSchoolAdmin(
  req: any,
  reply: any,
): Promise<{ sub: string; role: string; email?: string } | null> {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  try {
    const payload = (await verifyJWT(auth.slice(7).trim())) as {
      sub: string;
      role: string;
      email?: string;
    };
    if (!ALLOWED_ROLES.has(payload.role)) {
      reply.code(403).send({ error: "forbidden", required_roles: [...ALLOWED_ROLES] });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

// Test-only handle to the in-memory store, set when registerNotificationRoutes
// selects it (non-production, no DATABASE_URL).
let testStore: InMemoryNotificationStore | null = null;
export function clearNotificationStoreForTest(): void {
  testStore?.clear();
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export function registerNotificationRoutes(
  app: FastifyInstance,
  db: any,
  store: NotificationStore = selectNotificationStore(db),
): void {
  if (store instanceof InMemoryNotificationStore) testStore = store;

  // ------------------------------------------------------------------
  // GET /admin/schools/:schoolId/notifications
  // ------------------------------------------------------------------
  app.get<{ Params: { schoolId: string } }>(
    "/admin/schools/:schoolId/notifications",
    { schema: getAdminSchoolsNotificationsSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId } = req.params;
      const matrix = await store.get(schoolId);
      return { schoolId, matrix, eventTypes: Object.keys(matrix), staffRoles: DEFAULT_STAFF_ROLES };
    },
  );

  // ------------------------------------------------------------------
  // PUT /admin/schools/:schoolId/notifications
  // Replaces the entire matrix for the school.
  // ------------------------------------------------------------------
  app.put<{ Params: { schoolId: string }; Body: { matrix: NotificationMatrix } }>(
    "/admin/schools/:schoolId/notifications",
    { schema: putAdminSchoolsNotificationsSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId } = req.params;
      const { matrix } = req.body ?? {};

      if (!matrix || typeof matrix !== "object") {
        return reply.code(400).send({ error: "matrix is required and must be an object" });
      }

      const before = await store.getRaw(schoolId);
      await store.put(schoolId, matrix, actor.sub);

      void logAuditEvent(db, {
        action: "notification_matrix_updated",
        actorId: actor.sub,
        actorEmail: actor.email ?? "unknown",
        actorRole: actor.role,
        resourceType: "notification_preferences",
        resourceId: schoolId,
        details: {
          schoolId,
          eventTypeCount: Object.keys(matrix).length,
          previousMatrix: before,
          newMatrix: matrix,
        },
      }).catch(() => {});

      return { ok: true, schoolId, matrix };
    },
  );
}
