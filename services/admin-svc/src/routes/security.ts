/**
 * Security posture: SOC 2 / Trust Services control register.
 *
 * Postgres-backed (security_controls / security_control_evidence in @aivo/db),
 * replacing the in-memory store the legacy web-v2 admin used. Surfaced in the
 * web-admin platform console.
 *
 *   GET   /api/admin-svc/security/controls          — list (ordered by code)
 *   GET   /api/admin-svc/security/controls/:id      — control + evidence
 *   POST  /api/admin-svc/security/controls          — create
 *   PATCH /api/admin-svc/security/controls/:id      — update status / fields
 *
 * Every write is hash-chained into admin_audit_log via appendAudit.
 */
import { FastifyInstance } from "fastify";
import { asc, desc, eq } from "drizzle-orm";
import { securityControls, securityControlEvidence, adminAuditLog, appendAudit } from "@aivo/db";
import { verifyJWT } from "@aivo/security";

const CRITERIA = new Set([
  "security",
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
]);
const STATUSES = new Set(["implemented", "partial", "not_started", "not_applicable"]);

async function requirePlatformAdmin(req: any, reply: any): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return false;
  }
  try {
    const payload = await verifyJWT<any>(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN") {
      reply.status(403).send({ error: "Platform admin access required" });
      return false;
    }
    req.user = payload;
    return true;
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return false;
  }
}

function mapControl(row: any) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description ?? "",
    criterion: row.criterion,
    owner: row.owner ?? "",
    status: row.status,
    lastReviewedAt: row.lastReviewedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

function mapEvidence(row: any) {
  return {
    id: row.id,
    controlId: row.controlId,
    kind: row.kind,
    summary: row.summary ?? "",
    uri: row.uri ?? null,
    collectedByUserId: row.collectedByUserId ?? null,
    collectedAt: row.collectedAt?.toISOString?.() ?? null,
  };
}

async function audit(db: any, action: string, actor: any, control: any, details: Record<string, any>) {
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    action,
    actorId: actor.impersonatedBy || actor.sub,
    actorEmail: actor.email || "",
    actorRole: actor.role,
    onBehalfOfId: actor.impersonatedBy ? actor.sub : null,
    resourceType: "security_control",
    resourceId: control.id,
    details,
    ipAddress: null,
    userAgent: null,
    tenantId: actor.tenantId ?? null,
  });
}

export function registerSecurityRoutes(app: FastifyInstance, db: any): void {
  app.get(
    "/api/admin-svc/security/controls",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const rows = await db.select().from(securityControls).orderBy(asc(securityControls.code));
      return { controls: rows.map(mapControl) };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/admin-svc/security/controls/:id",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const [control] = await db
        .select()
        .from(securityControls)
        .where(eq(securityControls.id, id))
        .limit(1);
      if (!control) return reply.code(404).send({ error: "control_not_found" });
      const evidence = await db
        .select()
        .from(securityControlEvidence)
        .where(eq(securityControlEvidence.controlId, id))
        .orderBy(desc(securityControlEvidence.collectedAt));
      return { control: mapControl(control), evidence: evidence.map(mapEvidence) };
    },
  );

  app.post<{
    Body: {
      code?: string;
      title?: string;
      description?: string;
      criterion?: string;
      owner?: string;
      status?: string;
    };
  }>(
    "/api/admin-svc/security/controls",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const body = req.body ?? {};
      const code = String(body.code ?? "").trim();
      const title = String(body.title ?? "").trim();
      if (!code || !title) {
        return reply.code(400).send({ error: "code and title are required" });
      }
      const criterion = CRITERIA.has(String(body.criterion)) ? String(body.criterion) : "security";
      const status = STATUSES.has(String(body.status)) ? String(body.status) : "not_started";
      const [created] = await db
        .insert(securityControls)
        .values({
          code,
          title,
          description: String(body.description ?? ""),
          criterion,
          owner: String(body.owner ?? ""),
          status,
        })
        .returning();
      await audit(db, "security_control_created", (req as any).user, created, {
        code,
        criterion,
        status,
      });
      return reply.code(201).send({ control: mapControl(created) });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { title?: string; description?: string; criterion?: string; owner?: string; status?: string };
  }>(
    "/api/admin-svc/security/controls/:id",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { lastReviewedAt: new Date(), updatedAt: new Date() };
      if (body.title !== undefined) patch.title = String(body.title);
      if (body.description !== undefined) patch.description = String(body.description);
      if (body.owner !== undefined) patch.owner = String(body.owner);
      if (body.criterion !== undefined) {
        if (!CRITERIA.has(String(body.criterion))) {
          return reply.code(400).send({ error: "invalid criterion" });
        }
        patch.criterion = String(body.criterion);
      }
      if (body.status !== undefined) {
        if (!STATUSES.has(String(body.status))) {
          return reply.code(400).send({ error: "invalid status" });
        }
        patch.status = String(body.status);
      }
      const [updated] = await db
        .update(securityControls)
        .set(patch)
        .where(eq(securityControls.id, id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "control_not_found" });
      await audit(db, "security_control_updated", (req as any).user, updated, {
        status: updated.status,
        criterion: updated.criterion,
      });
      return { control: mapControl(updated) };
    },
  );
}
