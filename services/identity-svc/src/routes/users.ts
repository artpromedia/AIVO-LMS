import { FastifyInstance } from "fastify";
import {
  users,
  learners,
  tenants,
  consentRecords,
  languageProfiles,
  learnerCaregivers,
  learnerTeachers,
  learnerTherapists,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { and, eq, inArray } from "drizzle-orm";
import { lookupCurriculum } from "../services/curriculum-lookup.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

// Resolve learners that the given user has been granted access to via an
// ACCEPTED collaboration invite (caregiver / teacher / therapist). A single
// user can be connected to many learners across tenants.
async function fetchConnectedLearners(db: any, userId: string): Promise<any[]> {
  const [careRows, teachRows, theraRows] = await Promise.all([
    db.select({ learnerId: learnerCaregivers.learnerId })
      .from(learnerCaregivers)
      .where(and(eq(learnerCaregivers.caregiverUserId, userId), eq(learnerCaregivers.status, "ACCEPTED"))),
    db.select({ learnerId: learnerTeachers.learnerId })
      .from(learnerTeachers)
      .where(and(eq(learnerTeachers.teacherUserId, userId), eq(learnerTeachers.status, "ACCEPTED"))),
    db.select({ learnerId: learnerTherapists.learnerId })
      .from(learnerTherapists)
      .where(and(eq(learnerTherapists.therapistUserId, userId), eq(learnerTherapists.status, "ACCEPTED"))),
  ]);

  const ids = Array.from(new Set<string>([
    ...careRows.map((r: any) => r.learnerId),
    ...teachRows.map((r: any) => r.learnerId),
    ...theraRows.map((r: any) => r.learnerId),
  ]));
  if (ids.length === 0) return [];
  return db.select().from(learners).where(inArray(learners.id, ids));
}

function mergeLearners(a: any[], b: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of [...a, ...b]) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/api/users/me", {
    schema: { tags: ["Users"], security: [{ bearerAuth: [] }] },
    preHandler: authenticate,
  }, async (req, reply) => {
    const db = (app as any).db;
    const user = (req as any).user;
    const [u] = await db.select().from(users).where(eq(users.id, user.sub)).limit(1);
    if (!u) throw { statusCode: 404, message: "User not found" };
    return { id: u.id, email: u.email, name: u.name, role: u.role, tenantId: u.tenantId, avatarUrl: u.avatarUrl };
  });

  app.get("/api/users/learners", {
    schema: { tags: ["Users"], security: [{ bearerAuth: [] }] },
    preHandler: authenticate,
  }, async (req, reply) => {
    const db = (app as any).db;
    const user = (req as any).user;
    try {
      if (!["LEARNER", "PARENT", "TEACHER", "CAREGIVER", "THERAPIST", "PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(user.role)) {
        throw { statusCode: 403, message: "Not authorized" };
      }

      // A LEARNER may only see their own learner record. This drives
      // the tier-theme provider in the learner dashboard layout — without
      // it, gradeLevel stays null and every learner falls back to EARLY.
      if (user.role === "LEARNER") {
        if (!isUuid(user.sub)) {
          return [];
        }
        const results = await db.select().from(learners).where(eq(learners.userId, user.sub));
        return results;
      }

      if (user.role === "PARENT") {
        if (!isUuid(user.sub)) {
          return [];
        }

        let tenantId = user.tenantId as string | undefined;
        if (!tenantId) {
          const [self] = await db.select({ tenantId: users.tenantId }).from(users).where(eq(users.id, user.sub)).limit(1);
          tenantId = self?.tenantId ?? undefined;
        }

        const parentFilter = tenantId
          ? and(eq(learners.parentId, user.sub), eq(learners.tenantId, tenantId))
          : eq(learners.parentId, user.sub);

        const owned = await db.select().from(learners).where(parentFilter);
        const connected = await fetchConnectedLearners(db, user.sub);
        return mergeLearners(owned, connected);
      }

      if (user.role === "CAREGIVER" || user.role === "TEACHER" || user.role === "THERAPIST") {
        if (!isUuid(user.sub)) {
          return [];
        }
        const connected = await fetchConnectedLearners(db, user.sub);
        return connected;
      }

      if (user.role === "PLATFORM_ADMIN") {
        const results = await db.select().from(learners);
        return results;
      }

      if (!user.tenantId) {
        throw { statusCode: 400, message: "Missing tenant context" };
      }

      const results = await db.select().from(learners).where(eq(learners.tenantId, user.tenantId));
      return results;
    } catch (err) {
      app.log.error({ err, userSub: user?.sub, role: user?.role }, "Failed to fetch learners");
      return [];
    }
  });

  app.post("/api/users/learners", {
    schema: {
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          dateOfBirth: { type: "string" },
          gradeLevel: { type: "string" },
          pin: { type: "string", minLength: 4, maxLength: 6 },
          diagnoses: { type: "array", items: { type: "string" } },
          zipCode: { type: "string" },
          country: { type: "string" },
          region: { type: "string" },
          preferredLanguage: { type: "string" },
        },
      },
    },
    preHandler: authenticate,
  }, async (req, reply) => {
    const db = (app as any).db;
    const user = (req as any).user;
    const body = req.body as any;
    try {
      if (user.role !== "PARENT") {
        return reply.status(403).send({ error: "Only parents can create learners" });
      }

      let parentUserId: string | undefined = isUuid(user.sub) ? user.sub : undefined;
      let tenantId = user.tenantId as string | undefined;

      if (!parentUserId || !tenantId) {
        const selfWhere = isUuid(user.sub)
          ? eq(users.id, user.sub)
          : (typeof user.email === "string" && user.email.length > 0 ? eq(users.email, user.email) : undefined);

        if (selfWhere) {
          const [self] = await db
            .select({ id: users.id, tenantId: users.tenantId })
            .from(users)
            .where(selfWhere)
            .limit(1);
          parentUserId = parentUserId ?? self?.id ?? undefined;
          tenantId = tenantId ?? self?.tenantId ?? undefined;
        }
      }

      if (!parentUserId) {
        return reply.status(400).send({ error: "Invalid parent identity context" });
      }
      if (!tenantId) {
        return reply.status(400).send({ error: "Missing tenant context" });
      }

      // Sprint task #12 — licensing seat enforcement.
      //   * B2C_PARENT_PAY tenants: capped at 1 learner per parent.
      //   * B2B_SEAT_LICENSED tenants: capped by tenants.seat_limit
      //     (NULL = unlimited).
      // We read the tenant licensing tier inside the handler instead of
      // caching so a tier upgrade takes effect on the next request.
      const [tenantRow] = await db.select({
        type: tenants.type,
        licensingTier: tenants.licensingTier,
        seatLimit: tenants.seatLimit,
      }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      const tier = tenantRow?.licensingTier
        || (tenantRow?.type === "B2C_FAMILY" ? "B2C_PARENT_PAY" : "B2B_SEAT_LICENSED");
      if (tier === "B2C_PARENT_PAY") {
        const existingForParent = await db.select({ id: learners.id }).from(learners)
          .where(eq(learners.parentId, parentUserId)).limit(2);
        if (existingForParent.length >= 1) {
          return reply.status(409).send({
            error: "B2C accounts are limited to one learner. Upgrade to a school plan to add more.",
            licensingTier: tier,
          });
        }
      } else if (tier === "B2B_SEAT_LICENSED" && typeof tenantRow?.seatLimit === "number") {
        const tenantLearners = await db.select({ id: learners.id }).from(learners)
          .where(eq(learners.tenantId, tenantId));
        if (tenantLearners.length >= tenantRow.seatLimit) {
          return reply.status(409).send({
            error: "Seat limit reached for this district plan.",
            licensingTier: tier,
            seatLimit: tenantRow.seatLimit,
            currentSeats: tenantLearners.length,
          });
        }
      }

      const [learnerUser] = await db.insert(users).values({
        tenantId,
        name: body.name,
        role: "LEARNER",
        pin: body.pin,
      }).returning();

      const curriculum = lookupCurriculum({
        zipCode: body.zipCode,
        country: body.country,
      });

      let learner: any;
      try {
        [learner] = await db.insert(learners).values({
          tenantId,
          userId: learnerUser.id,
          parentId: parentUserId,
          name: body.name,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
          gradeLevel: body.gradeLevel,
          diagnoses: body.diagnoses || [],
          zipCode: body.zipCode,
          country: body.country || "US",
          region: body.region,
          districtId: curriculum.districtId,
          districtName: curriculum.districtName,
          curriculumFramework: curriculum.curriculumFramework,
          curriculumAlignment: curriculum.curriculumAlignment,
        }).returning();
      } catch (insertErr) {
        // Fallback for partial schema drift: write required learner columns only.
        app.log.warn({ err: insertErr, userSub: user?.sub }, "Learner extended insert failed; retrying minimal insert");
        [learner] = await db.insert(learners).values({
          tenantId,
          userId: learnerUser.id,
          parentId: parentUserId,
          name: body.name,
        }).returning();
      }

      if (body.preferredLanguage) {
        await db.insert(languageProfiles).values({
          learnerId: learner.id,
          primaryLanguage: body.preferredLanguage,
          preferredInstructionLanguage: body.preferredLanguage,
        }).catch(() => {});
      }

      await db.insert(consentRecords).values({
        parentId: parentUserId,
        childId: learnerUser.id,
        consentType: "COPPA_PARENTAL",
        version: "1.0",
      }).catch(() => {});

      return { learner, user: { id: learnerUser.id, name: learnerUser.name, role: "LEARNER" } };
    } catch (err: any) {
      app.log.error({ err, userSub: user?.sub, role: user?.role }, "Failed to create learner");
      return reply.status(500).send({ error: "Failed to create learner" });
    }
  });

  app.put("/api/users/learners/:learnerId", {
    schema: {
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        properties: {
          pin: { type: "string", minLength: 4, maxLength: 6 },
          name: { type: "string" },
          gradeLevel: { type: "string" },
        },
      },
    },
    preHandler: authenticate,
  }, async (req, reply) => {
    const db = (app as any).db;
    const user = (req as any).user;
    const { learnerId } = req.params as { learnerId: string };
    const body = req.body as { pin?: string; name?: string; gradeLevel?: string };

    if (!["PARENT", "PLATFORM_ADMIN"].includes(user.role)) {
      return reply.status(403).send({ error: "Not authorized" });
    }

    const [learner] = await db.select().from(learners).where(eq(learners.id, learnerId));
    if (!learner) return reply.status(404).send({ error: "Learner not found" });
    if (user.role === "PARENT" && learner.parentId !== user.sub) {
      return reply.status(403).send({ error: "Not authorized" });
    }
    if (learner.tenantId !== user.tenantId && user.role !== "PLATFORM_ADMIN") {
      return reply.status(403).send({ error: "Not authorized" });
    }

    if (body.pin && learner.userId) {
      await db.update(users).set({ pin: body.pin }).where(eq(users.id, learner.userId));
    }

    const updateFields: Record<string, unknown> = {};
    if (body.name) updateFields.name = body.name;
    if (body.gradeLevel) updateFields.gradeLevel = body.gradeLevel;

    if (Object.keys(updateFields).length > 0) {
      await db.update(learners).set(updateFields).where(eq(learners.id, learnerId));
    }

    return { success: true, learnerId };
  });
}
