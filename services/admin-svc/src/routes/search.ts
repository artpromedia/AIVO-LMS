import { FastifyInstance } from "fastify";
import { users, learners, tenants } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { or, ilike } from "drizzle-orm";
import { getAdminSvcSearchSchema } from "./schemas.js";

async function requireAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ error: "Missing authorization header" });
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(payload.role as string))
      return reply.status(403).send({ error: "Admin access required" });
    req.user = payload;
  } catch { return reply.status(401).send({ error: "Invalid token" }); }
}

export function registerSearchRoutes(app: FastifyInstance, db: any) {
  app.get("/api/admin-svc/search", { schema: getAdminSvcSearchSchema, preHandler: requireAdmin }, async (request) => {
    const { q } = request.query as any;
    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return { users: [], learners: [], tenants: [] };
    }

    const pattern = `%${q.trim()}%`;

    const [userResults, learnerResults, tenantResults] = await Promise.all([
      db.select({
        id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
      }).from(users)
        .where(or(ilike(users.name, pattern), ilike(users.email, pattern)))
        .limit(5),
      db.select({
        id: learners.id, name: learners.name, tenantId: learners.tenantId, createdAt: learners.createdAt,
      }).from(learners)
        .where(ilike(learners.name, pattern))
        .limit(5),
      db.select({
        id: tenants.id, name: tenants.name, type: tenants.type, status: tenants.status, createdAt: tenants.createdAt,
      }).from(tenants)
        .where(ilike(tenants.name, pattern))
        .limit(5),
    ]);

    return { users: userResults, learners: learnerResults, tenants: tenantResults };
  });
}
