/**
 * Sprint 6 — School notification-preference matrix (admin-svc).
 *
 * Stores a per-school matrix of event type × staff role → email on/off.
 * The in-memory Map mirrors the deletion-requests.ts precedent.
 *
 * // TODO(sprint6): Replace in-memory store with Postgres persistence,
 * //   following the existing dpa-store pattern in data-governance-svc.
 *
 * RBAC: allowed for PLATFORM_ADMIN, DISTRICT_ADMIN, SCHOOL_ADMIN.
 * Note: finer school-ownership scoping is enforced at the BFF/identity layer.
 */
import type { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { logAuditEvent } from "./audit.js";
import {
  getAdminSchoolsNotificationsSchema,
  putAdminSchoolsNotificationsSchema,
} from "./schemas.js";

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

// ---------------------------------------------------------------------------
// Notification-preference types and store
// ---------------------------------------------------------------------------

/** Each cell: event type × staff role → whether email is enabled. */
export type NotificationMatrix = Record<string, Record<string, boolean>>;

// Default event types and roles for the matrix template.
const DEFAULT_EVENT_TYPES = [
  "learner_import_completed",
  "classroom_created",
  "classroom_roster_changed",
  "report_generated",
  "account_suspended",
  "intervention_alert",
];

const DEFAULT_STAFF_ROLES = ["school_admin", "district_admin", "teacher", "co_teacher"];

function buildDefaultMatrix(): NotificationMatrix {
  const matrix: NotificationMatrix = {};
  for (const evt of DEFAULT_EVENT_TYPES) {
    matrix[evt] = {};
    for (const role of DEFAULT_STAFF_ROLES) {
      // Admins get email on by default; teachers off by default.
      matrix[evt][role] = role.includes("admin");
    }
  }
  return matrix;
}

// In-memory store: schoolId -> NotificationMatrix
// TODO(sprint6): Replace with Postgres persistence (dpa-store pattern).
const NOTIFICATION_PREFS = new Map<string, NotificationMatrix>();

function getMatrix(schoolId: string): NotificationMatrix {
  let matrix = NOTIFICATION_PREFS.get(schoolId);
  if (!matrix) {
    matrix = buildDefaultMatrix();
    NOTIFICATION_PREFS.set(schoolId, matrix);
  }
  return matrix;
}

// Exported for tests.
export function clearNotificationStoreForTest(): void {
  NOTIFICATION_PREFS.clear();
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export function registerNotificationRoutes(app: FastifyInstance, db: any): void {
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
      const matrix = getMatrix(schoolId);
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

      const before = NOTIFICATION_PREFS.get(schoolId) ?? null;
      NOTIFICATION_PREFS.set(schoolId, matrix);

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
