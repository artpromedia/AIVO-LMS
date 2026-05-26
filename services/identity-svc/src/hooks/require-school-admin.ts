/**
 * Sprint 1 (invite-flows): preHandler that enforces SCHOOL_ADMIN scope.
 *
 * Accepts SCHOOL_ADMIN, DISTRICT_ADMIN, and PLATFORM_ADMIN. A SCHOOL_ADMIN
 * is pinned to a single school via `users.school_id`; the JWT carries
 * `schoolId` and this hook injects it on the request so handlers can
 * filter by it without re-fetching.
 *
 * - SCHOOL_ADMIN     → req.schoolId = payload.schoolId (must be present)
 * - DISTRICT_ADMIN   → req.schoolId = (req.query.schoolId | req.body.schoolId)
 *                      and must belong to payload.tenantId — the route
 *                      handler is responsible for verifying tenant ownership
 *                      when it reads/writes school-scoped data.
 * - PLATFORM_ADMIN   → may impersonate any school via ?schoolId=.
 */
import { verifyJWT } from "@aivo/security";

export async function requireSchoolAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization" });
  }
  let payload: any;
  try {
    payload = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
  if (!["SCHOOL_ADMIN", "DISTRICT_ADMIN", "PLATFORM_ADMIN"].includes(payload.role as string)) {
    return reply.status(403).send({ error: "School admin access required" });
  }

  const tid = payload.tenantId;
  if (!tid && payload.role !== "PLATFORM_ADMIN") {
    return reply.status(400).send({ error: "No tenant context" });
  }

  let sid: string | undefined;
  if (payload.role === "SCHOOL_ADMIN") {
    sid = payload.schoolId;
    if (!sid) {
      return reply.status(400).send({ error: "School admin token missing schoolId" });
    }
  } else {
    sid =
      (req.query as any)?.schoolId ||
      (req.body as any)?.schoolId ||
      (req.params as any)?.schoolId ||
      undefined;
  }

  req.tenantId = tid;
  req.schoolId = sid;
  req.user = payload;
}
