/**
 * Sprint 6 — Classroom CRUD routes (admin-svc).
 *
 * Full CRUD for classrooms scoped by school, including a roster management
 * endpoint for adding/removing learners and co-teachers.
 *
 * Persistence is delegated to a ClassroomStore (Postgres in production,
 * in-memory for tests / local dev) following the dpa-store precedent in
 * data-governance-svc. State survives restart and scales horizontally.
 *
 * RBAC: allowed for PLATFORM_ADMIN, DISTRICT_ADMIN, SCHOOL_ADMIN.
 * Note: finer school-ownership scoping is enforced at the BFF/identity layer.
 */
import type { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { logAuditEvent } from "./audit.js";
import {
  type Classroom,
  type ClassroomStore,
  InMemoryClassroomStore,
  selectClassroomStore,
} from "../stores/classroom-store.js";
import {
  getAdminSchoolsClassroomsSchema,
  postAdminSchoolsClassroomsSchema,
  getAdminSchoolsClassroomByIdSchema,
  patchAdminSchoolsClassroomByIdSchema,
  deleteAdminSchoolsClassroomByIdSchema,
  postAdminSchoolsClassroomRosterSchema,
} from "./schemas.js";

export type { Classroom };

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

function generateId(): string {
  return `cls_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Test-only handle to the in-memory store, set when registerClassroomRoutes
// selects it (non-production, no DATABASE_URL). Lets existing test helpers
// reset state between cases without reaching into the route internals.
let testStore: InMemoryClassroomStore | null = null;
export function clearClassroomStoreForTest(): void {
  testStore?.clear();
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export function registerClassroomRoutes(
  app: FastifyInstance,
  db: any,
  store: ClassroomStore = selectClassroomStore(db),
): void {
  if (store instanceof InMemoryClassroomStore) testStore = store;
  // ------------------------------------------------------------------
  // GET /admin/schools/:schoolId/classrooms
  // Optional query: ?grade=&teacherId=
  // ------------------------------------------------------------------
  app.get<{ Params: { schoolId: string }; Querystring: { grade?: string; teacherId?: string } }>(
    "/admin/schools/:schoolId/classrooms",
    { schema: getAdminSchoolsClassroomsSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId } = req.params;
      const { grade, teacherId } = req.query;

      const classrooms = await store.list(schoolId, { grade, teacherId });
      return { classrooms, total: classrooms.length };
    },
  );

  // ------------------------------------------------------------------
  // POST /admin/schools/:schoolId/classrooms
  // ------------------------------------------------------------------
  app.post<{
    Params: { schoolId: string };
    Body: { name: string; grade?: string; teacherIds?: string[] };
  }>(
    "/admin/schools/:schoolId/classrooms",
    { schema: postAdminSchoolsClassroomsSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId } = req.params;
      const { name, grade, teacherIds } = req.body ?? {};

      if (!name) {
        return reply.code(400).send({ error: "name is required" });
      }

      const now = new Date().toISOString();
      const classroom: Classroom = {
        id: generateId(),
        schoolId,
        name,
        grade: grade ?? null,
        teacherIds: teacherIds ?? [],
        coTeacherIds: [],
        learnerIds: [],
        createdAt: now,
        updatedAt: now,
      };
      await store.insert(classroom);

      void logAuditEvent(db, {
        action: "classroom_created",
        actorId: actor.sub,
        actorEmail: actor.email ?? "unknown",
        actorRole: actor.role,
        resourceType: "classroom",
        resourceId: classroom.id,
        details: { schoolId, name, grade },
      }).catch(() => {});

      return reply.code(201).send(classroom);
    },
  );

  // ------------------------------------------------------------------
  // GET /admin/schools/:schoolId/classrooms/:id
  // ------------------------------------------------------------------
  app.get<{ Params: { schoolId: string; id: string } }>(
    "/admin/schools/:schoolId/classrooms/:id",
    { schema: getAdminSchoolsClassroomByIdSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId, id } = req.params;
      const classroom = await store.get(id);
      if (!classroom || classroom.schoolId !== schoolId) {
        return reply.code(404).send({ error: "classroom_not_found", id });
      }
      return classroom;
    },
  );

  // ------------------------------------------------------------------
  // PATCH /admin/schools/:schoolId/classrooms/:id
  // ------------------------------------------------------------------
  app.patch<{
    Params: { schoolId: string; id: string };
    Body: { name?: string; grade?: string; teacherIds?: string[] };
  }>(
    "/admin/schools/:schoolId/classrooms/:id",
    { schema: patchAdminSchoolsClassroomByIdSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId, id } = req.params;
      const classroom = await store.get(id);
      if (!classroom || classroom.schoolId !== schoolId) {
        return reply.code(404).send({ error: "classroom_not_found", id });
      }

      const { name, grade, teacherIds } = req.body ?? {};
      const before = { ...classroom };

      if (name !== undefined) classroom.name = name;
      if (grade !== undefined) classroom.grade = grade;
      if (teacherIds !== undefined) classroom.teacherIds = teacherIds;
      classroom.updatedAt = new Date().toISOString();

      await store.replace(classroom);

      void logAuditEvent(db, {
        action: "classroom_updated",
        actorId: actor.sub,
        actorEmail: actor.email ?? "unknown",
        actorRole: actor.role,
        resourceType: "classroom",
        resourceId: id,
        details: {
          schoolId,
          before: { name: before.name, grade: before.grade },
          after: { name: classroom.name, grade: classroom.grade },
        },
      }).catch(() => {});

      return classroom;
    },
  );

  // ------------------------------------------------------------------
  // DELETE /admin/schools/:schoolId/classrooms/:id
  // ------------------------------------------------------------------
  app.delete<{ Params: { schoolId: string; id: string } }>(
    "/admin/schools/:schoolId/classrooms/:id",
    { schema: deleteAdminSchoolsClassroomByIdSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId, id } = req.params;
      const classroom = await store.get(id);
      if (!classroom || classroom.schoolId !== schoolId) {
        return reply.code(404).send({ error: "classroom_not_found", id });
      }
      await store.remove(id);

      void logAuditEvent(db, {
        action: "classroom_deleted",
        actorId: actor.sub,
        actorEmail: actor.email ?? "unknown",
        actorRole: actor.role,
        resourceType: "classroom",
        resourceId: id,
        details: { schoolId, name: classroom.name },
      }).catch(() => {});

      return { ok: true, id };
    },
  );

  // ------------------------------------------------------------------
  // POST /admin/schools/:schoolId/classrooms/:id/roster
  // Body: { addLearnerIds?, removeLearnerIds?, addCoTeacherIds?, removeCoTeacherIds? }
  // ------------------------------------------------------------------
  app.post<{
    Params: { schoolId: string; id: string };
    Body: {
      addLearnerIds?: string[];
      removeLearnerIds?: string[];
      addCoTeacherIds?: string[];
      removeCoTeacherIds?: string[];
    };
  }>(
    "/admin/schools/:schoolId/classrooms/:id/roster",
    { schema: postAdminSchoolsClassroomRosterSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId, id } = req.params;
      const classroom = await store.get(id);
      if (!classroom || classroom.schoolId !== schoolId) {
        return reply.code(404).send({ error: "classroom_not_found", id });
      }

      const {
        addLearnerIds = [],
        removeLearnerIds = [],
        addCoTeacherIds = [],
        removeCoTeacherIds = [],
      } = req.body ?? {};

      const removeSet = new Set(removeLearnerIds);
      const removeCTSet = new Set(removeCoTeacherIds);

      classroom.learnerIds = [
        ...classroom.learnerIds.filter((lid) => !removeSet.has(lid)),
        ...addLearnerIds.filter((lid) => !classroom.learnerIds.includes(lid)),
      ];
      classroom.coTeacherIds = [
        ...classroom.coTeacherIds.filter((cid) => !removeCTSet.has(cid)),
        ...addCoTeacherIds.filter((cid) => !classroom.coTeacherIds.includes(cid)),
      ];
      classroom.updatedAt = new Date().toISOString();
      await store.replace(classroom);

      void logAuditEvent(db, {
        action: "classroom_roster_changed",
        actorId: actor.sub,
        actorEmail: actor.email ?? "unknown",
        actorRole: actor.role,
        resourceType: "classroom",
        resourceId: id,
        details: {
          schoolId,
          addLearnerIds,
          removeLearnerIds,
          addCoTeacherIds,
          removeCoTeacherIds,
          learnerCount: classroom.learnerIds.length,
          coTeacherCount: classroom.coTeacherIds.length,
        },
      }).catch(() => {});

      return {
        ok: true,
        classroom: {
          id: classroom.id,
          learnerIds: classroom.learnerIds,
          coTeacherIds: classroom.coTeacherIds,
          updatedAt: classroom.updatedAt,
        },
      };
    },
  );
}
