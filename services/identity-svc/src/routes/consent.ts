import { FastifyInstance } from "fastify";
import { consentRecords, learners } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { eq, and, isNull } from "drizzle-orm";

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ error: "Unauthorized" });
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function registerConsentRoutes(app: FastifyInstance) {
  app.get(
    "/api/consent",
    {
      schema: { tags: ["Consent"], security: [{ bearerAuth: [] }] },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const user = (req as any).user;
      return db
        .select()
        .from(consentRecords)
        .where(and(eq(consentRecords.parentId, user.sub), isNull(consentRecords.revokedAt)));
    },
  );

  app.post(
    "/api/consent",
    {
      schema: {
        tags: ["Consent"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["childId", "consentType", "version"],
          properties: {
            childId: { type: "string" },
            consentType: { type: "string" },
            version: { type: "string" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const body = req.body as any;

      if (user.role !== "PARENT")
        throw { statusCode: 403, message: "Only parents can grant consent" };

      const [child] = await db
        .select()
        .from(learners)
        .where(and(eq(learners.id, body.childId), eq(learners.parentId, user.sub)))
        .limit(1);

      if (!child) throw { statusCode: 403, message: "Child does not belong to this parent" };

      const [record] = await db
        .insert(consentRecords)
        .values({
          parentId: user.sub,
          childId: body.childId,
          consentType: body.consentType,
          version: body.version,
        })
        .returning();

      return record;
    },
  );

  app.delete(
    "/api/consent/:id",
    {
      schema: { tags: ["Consent"], security: [{ bearerAuth: [] }] },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { id } = req.params as any;

      if (user.role !== "PARENT") {
        return reply.status(403).send({ error: "Only parents can revoke consent" });
      }

      const [record] = await db
        .update(consentRecords)
        .set({ revokedAt: new Date() })
        .where(and(eq(consentRecords.id, id), eq(consentRecords.parentId, user.sub)))
        .returning();

      if (!record) {
        return reply.status(404).send({ error: "Consent record not found" });
      }
      return record;
    },
  );
}
