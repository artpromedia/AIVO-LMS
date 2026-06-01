import { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { teacherLessonAssignments } from "@aivo/db";
import { resolveTenantId } from "../lib/tenant.js";

/**
 * Teacher assignments.
 *
 *   GET  /api/learning/assignments  → the caller's assignments (newest first)
 *   POST /api/learning/assignments  → create an assignment
 *
 * Scoped to the authenticated teacher (token subject) within their
 * tenant. Backed by the `teacher_assignments` table.
 */

interface CreateBody {
  title?: string;
  subject?: string;
  dueDate?: string | null;
  learnerIds?: string[];
}

function rowView(r: typeof teacherLessonAssignments.$inferSelect) {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    status: r.status,
    dueDate: r.dueDate,
    learnerIds: Array.isArray(r.learnerIds) ? r.learnerIds : [],
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

export function registerAssignmentRoutes(app: FastifyInstance, db: any) {
  app.get("/api/learning/assignments", async (request, reply) => {
    const auth = (request as any).auth;
    const teacherId = auth?.sub;
    if (!teacherId || teacherId === "service") {
      return reply.code(401).send({ error: "Authentication required" });
    }
    const tenantId = auth?.tenantId || (await resolveTenantId(request, db));
    if (!tenantId) return reply.code(400).send({ error: "tenant could not be resolved" });

    const rows = await db
      .select()
      .from(teacherLessonAssignments)
      .where(
        and(
          eq(teacherLessonAssignments.teacherId, teacherId),
          eq(teacherLessonAssignments.tenantId, tenantId),
        ),
      )
      .orderBy(desc(teacherLessonAssignments.createdAt))
      .limit(100);
    return rows.map(rowView);
  });

  app.post("/api/learning/assignments", async (request, reply) => {
    const auth = (request as any).auth;
    const teacherId = auth?.sub;
    if (!teacherId || teacherId === "service") {
      return reply.code(401).send({ error: "Authentication required" });
    }
    const tenantId = auth?.tenantId || (await resolveTenantId(request, db));
    if (!tenantId) return reply.code(400).send({ error: "tenant could not be resolved" });

    const body = (request.body as CreateBody) || {};
    const title = (body.title ?? "").trim();
    const subject = (body.subject ?? "").trim();
    if (!title || !subject) {
      return reply.code(400).send({ error: "title and subject required" });
    }
    const [inserted] = await db
      .insert(teacherLessonAssignments)
      .values({
        tenantId,
        teacherId,
        title,
        subject,
        status: "active",
        dueDate: body.dueDate ?? null,
        learnerIds: Array.isArray(body.learnerIds) ? body.learnerIds : [],
      })
      .returning();
    return reply.code(201).send(rowView(inserted));
  });
}
