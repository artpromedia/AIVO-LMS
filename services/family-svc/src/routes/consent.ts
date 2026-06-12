import { FastifyInstance } from "fastify";
import { and, desc, eq, isNull } from "drizzle-orm";
import { consentRecords } from "@aivo/db";
import { authenticateRequest } from "../auth.js";
import { emitFamilyAudit } from "../lib/audit.js";

/**
 * Parent consent records (mobile + web consent center).
 *
 *   GET  /api/family/consent            → all of the parent's records
 *   GET  /api/family/consent?learnerId= → records scoped to one learner
 *   POST /api/family/consent            → grant/revoke a consent type
 *
 * Backed by the canonical `consent_records` table. A "grant" inserts a
 * fresh non-revoked row for the (parent, type, learner) tuple; a
 * "revoke" stamps `revokedAt` on the active rows. The current grant
 * state for a type is "most recent row is non-revoked".
 */

const CONSENT_VERSION = "1.0";

interface ConsentBody {
  consentType?: string;
  learnerId?: string | null;
  granted?: boolean;
}

function rowView(r: typeof consentRecords.$inferSelect) {
  return {
    id: r.id,
    consentType: r.consentType,
    learnerId: r.childId,
    version: r.version,
    acceptedAt: r.grantedAt instanceof Date ? r.grantedAt.toISOString() : r.grantedAt,
    revokedAt: r.revokedAt instanceof Date ? r.revokedAt.toISOString() : r.revokedAt,
  };
}

export async function registerConsentRoutes(app: FastifyInstance) {
  const db = (app as unknown as { db: ReturnType<typeof import("@aivo/db").createDb> }).db;

  app.get("/api/family/consent", async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;
    const { learnerId } = (request.query as { learnerId?: string }) || {};
    const where = learnerId
      ? and(eq(consentRecords.parentId, claims.sub), eq(consentRecords.childId, learnerId))
      : eq(consentRecords.parentId, claims.sub);
    const rows = await db
      .select()
      .from(consentRecords)
      .where(where)
      .orderBy(desc(consentRecords.grantedAt));
    return rows.map(rowView);
  });

  app.post("/api/family/consent", async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;
    const body = (request.body as ConsentBody) || {};
    const consentType = (body.consentType ?? "").trim();
    if (!consentType) {
      return reply.code(400).send({ error: "consentType required" });
    }
    const childId = body.learnerId ?? null;

    // Revoke any currently-active rows for this (parent, type, learner).
    const activeWhere = and(
      eq(consentRecords.parentId, claims.sub),
      eq(consentRecords.consentType, consentType),
      childId ? eq(consentRecords.childId, childId) : isNull(consentRecords.childId),
      isNull(consentRecords.revokedAt),
    );
    await db.update(consentRecords).set({ revokedAt: new Date() }).where(activeWhere);

    if (body.granted) {
      const [inserted] = await db
        .insert(consentRecords)
        .values({
          parentId: claims.sub,
          childId,
          consentType,
          version: CONSENT_VERSION,
        })
        .returning();
      await emitFamilyAudit({
        db,
        request,
        eventType: "PARENT_CONSENT_CHANGED",
        tenantId: claims.tenantId || null,
        learnerId: childId ?? "",
        resourceId: inserted.id,
        details: { consentType, granted: true, version: CONSENT_VERSION },
      });
      return rowView(inserted);
    }
    await emitFamilyAudit({
      db,
      request,
      eventType: "PARENT_CONSENT_CHANGED",
      tenantId: claims.tenantId || null,
      learnerId: childId ?? "",
      details: { consentType, granted: false },
    });
    return { status: "revoked", consentType, learnerId: childId };
  });
}
