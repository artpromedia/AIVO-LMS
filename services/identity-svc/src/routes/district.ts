import { FastifyInstance } from "fastify";
import {
  users,
  sessions,
  tenants,
  learners,
  sensoryProfiles,
  schools,
  classrooms,
  classroomEnrollments,
  staffAssignments,
  districtSettings,
  districtAdminInvites,
  districtActivityLog,
  iepRecords,
  iepEvaluations,
  iepProfiles,
  interventions,
  seatRequests,
  appendAudit,
  adminAuditLog,
  verifyAuditChainRange,
} from "@aivo/db";
import { Permission, verifyJWT } from "@aivo/security";
import { eq, and, sql, ilike, or, count, desc, asc, isNull, gte, gt, lte, between } from "drizzle-orm";
import argon2 from "argon2";
import crypto from "crypto";
import { requireDistrictAdmin } from "../hooks/require-district-admin.js";
import { requireStepUp } from "./step-up.js";
import { delegatedAdminRbacV2Enabled, requestHasPermission } from "../lib/permissions.js";
import { parseLogoDataUrl } from "../lib/branding-validation.js";
import { evaluateBrandPalette } from "@aivo/brand";
import {
  getDistrictStatsSchema,
  getDistrictTenantSchema,
  getDistrictSchoolsSchema,
  districtSchoolsSchema,
  getDistrictSchoolsByIdSchema,
  updateDistrictSchoolsByIdSchema,
  getDistrictLearnersSchema,
  getDistrictLearnersByIdSchema,
  getDistrictStaffSchema,
  districtStaffSchema,
  getDistrictStaffByIdSchema,
  updateDistrictStaffByIdSchema,
  deleteDistrictStaffByIdSchema,
  getDistrictFamiliesSchema,
  getDistrictClassroomsSchema,
  districtClassroomsSchema,
  getDistrictUsageSchema,
  getDistrictSettingsSchema,
  updateDistrictSettingsSchema,
  getDistrictSsoSchema,
  testDistrictSsoOidcSchema,
  updateDistrictSsoSchema,
  getDistrictActivitySchema,
  getDistrictAnalyticsCohortsSchema,
  getDistrictAnalyticsEngagementSchema,
  getDistrictAnalyticsMasterySchema,
  getDistrictIepSummarySchema,
  getDistrictIepEvaluationsInProgressSchema,
  getDistrictIepLearnersSchema,
  getDistrictInterventionsSchema,
  districtIepSchema,
  districtInterventionsSchema,
  districtSettingsBrandingLogoSchema,
  districtSeatsRequestSchema,
  getDistrictRosterCsvSchema,
  getDistrictActivityExportSchema,
  getDistrictActivityVerifySchema,
  getDistrictSeatsRequestsSchema,
} from "./schemas.js";
void verifyJWT; // kept for potential token introspection helpers

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`identity-svc: ${name} must be set in production`);
  return devDefault;
}
const ASSESSMENT_SVC_URL = requireUrl("ASSESSMENT_SVC_URL", "http://localhost:3003");
const COMMS_SVC_URL = requireUrl("COMMS_SVC_URL", "http://localhost:3003");
const DEV_INTERNAL_KEY = IS_PROD ? "" : "aivo-internal-dev-key";

function safePage(val: any): number {
  const n = parseInt(val || "1", 10);
  return Number.isNaN(n) || n < 1 ? 1 : n;
}
function safePageSize(val: any, def = 20): number {
  const n = parseInt(val || String(def), 10);
  return Number.isNaN(n) || n < 1 ? def : Math.min(n, 100);
}

async function logActivity(
  db: any,
  tenantId: string,
  action: string,
  actorId: string,
  actorName: string,
  resourceType: string,
  resourceId?: string,
  details?: any,
) {
  // Sprint 4: chain district activity through appendAudit so the verifier
  // can walk every row.
  await appendAudit(db, "district_activity_log", districtActivityLog, {
    tenantId,
    action,
    actorId,
    actorName: actorName ?? null,
    onBehalfOfId: null,
    resourceType,
    resourceId: resourceId ?? null,
    details: details ?? null,
  });
}

function hasDistrictPermission(req: any, permission: Permission): boolean {
  if (!delegatedAdminRbacV2Enabled()) return true;
  return requestHasPermission(req.user, permission);
}

function ensureDistrictPermission(req: any, reply: any, permission: Permission): boolean {
  if (hasDistrictPermission(req, permission)) return true;
  reply.status(403).send({ error: "Forbidden" });
  return false;
}

export async function registerDistrictRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get(
    "/api/district/stats",
    { schema: getDistrictStatsSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.DistrictRead)) return;
      const tid = req.tenantId;
      const [userCount] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.tenantId, tid));
      const [learnerCount] = await db
        .select({ count: count() })
        .from(learners)
        .where(eq(learners.tenantId, tid));

      const staffRoles = ["TEACHER", "THERAPIST", "CAREGIVER"];
      const [staffCount] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tid),
            sql`${users.role} = ANY(ARRAY['TEACHER','THERAPIST','CAREGIVER']::user_role[])`,
          ),
        );

      const [parentCount] = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.tenantId, tid), eq(users.role, "PARENT")));

      const [schoolCount] = await db
        .select({ count: count() })
        .from(schools)
        .where(eq(schools.tenantId, tid));

      const roleCounts = await db
        .select({
          role: users.role,
          count: count(),
        })
        .from(users)
        .where(eq(users.tenantId, tid))
        .groupBy(users.role);

      const flCounts = await db
        .select({
          level: learners.functioningLevel,
          count: count(),
        })
        .from(learners)
        .where(eq(learners.tenantId, tid))
        .groupBy(learners.functioningLevel);

      const [iepCount] = await db
        .select({ count: count() })
        .from(iepRecords)
        .innerJoin(learners, eq(iepRecords.learnerId, learners.id))
        .where(and(eq(learners.tenantId, tid), eq(iepRecords.status, "active")));

      return {
        totalUsers: userCount.count,
        totalLearners: learnerCount.count,
        totalStaff: staffCount.count,
        totalParents: parentCount.count,
        totalSchools: schoolCount.count,
        activeIeps: iepCount.count,
        roleCounts,
        functioningLevelCounts: flCounts,
      };
    },
  );

  app.get(
    "/api/district/tenant",
    { schema: getDistrictTenantSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.DistrictRead)) return;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.tenantId)).limit(1);
      if (!tenant) return { error: "Tenant not found" };

      const [settings] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, req.tenantId))
        .limit(1);
      return { ...tenant, districtSettings: settings || null };
    },
  );

  app.get(
    "/api/district/setup",
    { preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.DistrictRead)) return;
      const tid = req.tenantId;
      const [[tenant], [settings], [schoolCount], [staffCount], [learnerCount], [pendingInvites]] =
        await Promise.all([
          db.select().from(tenants).where(eq(tenants.id, tid)).limit(1),
          db.select().from(districtSettings).where(eq(districtSettings.tenantId, tid)).limit(1),
          db.select({ count: count() }).from(schools).where(eq(schools.tenantId, tid)),
          db
            .select({ count: count() })
            .from(users)
            .where(
              and(
                eq(users.tenantId, tid),
                isNull(users.deactivatedAt),
                sql`${users.role} = ANY(ARRAY['DISTRICT_ADMIN','SCHOOL_ADMIN','TEACHER','THERAPIST','CAREGIVER']::user_role[])`,
              ),
            ),
          db.select({ count: count() }).from(learners).where(eq(learners.tenantId, tid)),
          db
            .select({ count: count() })
            .from(districtAdminInvites)
            .where(
              and(
                eq(districtAdminInvites.tenantId, tid),
                isNull(districtAdminInvites.acceptedAt),
                isNull(districtAdminInvites.revokedAt),
                gt(districtAdminInvites.expiresAt, new Date()),
              ),
            ),
        ]);
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const tenantSettings = (tenant.settings || {}) as Record<string, unknown>;
      const branding = (settings?.branding || {}) as Record<string, unknown>;
      const ssoConfig = (settings?.ssoConfig || {}) as Record<string, unknown>;
      const schoolsReady = Number(schoolCount?.count || 0) > 0;
      const staffReady =
        Number(staffCount?.count || 0) > 1 || Number(pendingInvites?.count || 0) > 0;
      const brandingReady = Boolean(
        branding.displayName || branding.primaryColor || branding.supportEmail || branding.logoUrl,
      );
      const ssoReviewed = Boolean(
        ssoConfig.enabled || ssoConfig.reviewedAt || tenantSettings.ssoReviewedAt,
      );

      return {
        district: { id: tenant.id, name: tenant.name },
        setupComplete: tenantSettings.setupComplete === true,
        canComplete: schoolsReady,
        counts: {
          schools: Number(schoolCount?.count || 0),
          staff: Number(staffCount?.count || 0),
          learners: Number(learnerCount?.count || 0),
          pendingInvites: Number(pendingInvites?.count || 0),
        },
        checklist: {
          schools: schoolsReady,
          staff: staffReady,
          branding: brandingReady,
          sso: ssoReviewed,
        },
      };
    },
  );

  app.patch(
    "/api/district/settings/complete",
    { preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.SchoolWrite)) return;
      const tid = req.tenantId;
      const [[tenant], [schoolCount]] = await Promise.all([
        db.select().from(tenants).where(eq(tenants.id, tid)).limit(1),
        db.select({ count: count() }).from(schools).where(eq(schools.tenantId, tid)),
      ]);
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });
      if (((tenant.settings || {}) as Record<string, unknown>).setupComplete === true) {
        return { success: true, setupComplete: true };
      }
      if (Number(schoolCount?.count || 0) < 1) {
        return reply
          .status(409)
          .send({ error: "Add at least one school before completing district setup." });
      }

      const settings = { ...((tenant.settings || {}) as Record<string, unknown>), setupComplete: true };
      await db
        .update(tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(tenants.id, tid));
      await logActivity(
        db,
        tid,
        "district.setup_completed",
        req.user.sub,
        req.user.name || req.user.email,
        "tenant",
        tid,
        { schools: Number(schoolCount.count) },
      );
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        tenantId: tid,
        action: "district.setup_completed",
        actorId: req.user.sub,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        onBehalfOfId: null,
        resourceType: "tenant",
        resourceId: tid,
        details: { schools: Number(schoolCount.count) },
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      });
      req.log.info({ tenantId: tid, action: "district.setup_completed" }, "district setup completed");
      return { success: true, setupComplete: true };
    },
  );

  app.get(
    "/api/district/schools",
    { schema: getDistrictSchoolsSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.SchoolRead)) return;
      const tid = req.tenantId;
      const { search } = req.query as any;

      let query = db.select().from(schools).where(eq(schools.tenantId, tid));
      if (search) {
        query = db
          .select()
          .from(schools)
          .where(and(eq(schools.tenantId, tid), ilike(schools.name, `%${search}%`)));
      }
      const allSchools = await query.orderBy(asc(schools.name));

      const enriched = await Promise.all(
        allSchools.map(async (s: any) => {
          const [lCount] = await db
            .select({ count: count() })
            .from(learners)
            .where(and(eq(learners.schoolId, s.id), eq(learners.tenantId, tid)));
          const [sCount] = await db
            .select({ count: count() })
            .from(staffAssignments)
            .innerJoin(users, eq(staffAssignments.userId, users.id))
            .where(
              and(
                eq(staffAssignments.schoolId, s.id),
                isNull(staffAssignments.removedAt),
                eq(users.tenantId, tid),
              ),
            );
          return { ...s, learnerCount: lCount.count, staffCount: sCount.count };
        }),
      );

      return { schools: enriched };
    },
  );

  app.post(
    "/api/district/schools",
    { schema: districtSchoolsSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.SchoolCreate)) return;
      const tid = req.tenantId;
      const {
        name,
        address,
        city,
        state,
        zip,
        phone,
        principalName,
        principalEmail,
        enrollmentCapacity,
        gradeLevels,
      } = req.body as any;
      if (!name) return reply.status(400).send({ error: "School name is required" });

      const [school] = await db
        .insert(schools)
        .values({
          tenantId: tid,
          name,
          address,
          city,
          state,
          zip,
          phone,
          principalName,
          principalEmail,
          enrollmentCapacity,
          gradeLevels: gradeLevels || [],
        })
        .returning();

      await logActivity(
        db,
        tid,
        "school.created",
        req.user.sub,
        req.user.name || req.user.email,
        "school",
        school.id,
        { name },
      );
      return { school };
    },
  );

  app.get(
    "/api/district/schools/:id",
    { schema: getDistrictSchoolsByIdSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.SchoolRead)) return;
      const { id } = req.params as { id: string };
      const [school] = await db
        .select()
        .from(schools)
        .where(and(eq(schools.id, id), eq(schools.tenantId, req.tenantId)))
        .limit(1);
      if (!school) return reply.status(404).send({ error: "School not found" });

      const schoolLearners = await db
        .select({
          id: learners.id,
          name: learners.name,
          gradeLevel: learners.gradeLevel,
          functioningLevel: learners.functioningLevel,
          createdAt: learners.createdAt,
        })
        .from(learners)
        .where(and(eq(learners.schoolId, id), eq(learners.tenantId, req.tenantId)))
        .orderBy(asc(learners.name));

      const staffList = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          roleAtSchool: staffAssignments.roleAtSchool,
          assignedAt: staffAssignments.assignedAt,
        })
        .from(staffAssignments)
        .innerJoin(users, eq(staffAssignments.userId, users.id))
        .where(
          and(
            eq(staffAssignments.schoolId, id),
            isNull(staffAssignments.removedAt),
            eq(users.tenantId, req.tenantId),
          ),
        );

      const schoolClassrooms = await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.schoolId, id))
        .orderBy(asc(classrooms.name));

      const [lCount] = await db
        .select({ count: count() })
        .from(learners)
        .where(and(eq(learners.schoolId, id), eq(learners.tenantId, req.tenantId)));

      return {
        school,
        learners: schoolLearners,
        staff: staffList,
        classrooms: schoolClassrooms,
        learnerCount: lCount.count,
      };
    },
  );

  app.put(
    "/api/district/schools/:id",
    { schema: updateDistrictSchoolsByIdSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.SchoolWrite)) return;
      const { id } = req.params as { id: string };
      const [existing] = await db
        .select()
        .from(schools)
        .where(and(eq(schools.id, id), eq(schools.tenantId, req.tenantId)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "School not found" });

      const body = req.body as any;
      const updates: any = {};
      for (const key of [
        "name",
        "address",
        "city",
        "state",
        "zip",
        "phone",
        "principalName",
        "principalEmail",
        "enrollmentCapacity",
        "gradeLevels",
        "status",
      ]) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      updates.updatedAt = new Date();

      const [updated] = await db.update(schools).set(updates).where(eq(schools.id, id)).returning();
      await logActivity(
        db,
        req.tenantId,
        "school.updated",
        req.user.sub,
        req.user.name || req.user.email,
        "school",
        id,
        updates,
      );
      return { school: updated };
    },
  );

  app.get(
    "/api/district/learners",
    { schema: getDistrictLearnersSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.LearnerRead)) return;
      const tid = req.tenantId;
      const {
        page: pageStr,
        pageSize: pageSizeStr,
        search,
        school: schoolId,
        grade,
        fl,
      } = req.query as any;
      const page = safePage(pageStr);
      const pageSize = safePageSize(pageSizeStr);

      const conditions: any[] = [eq(learners.tenantId, tid)];
      if (search) conditions.push(ilike(learners.name, `%${search}%`));
      if (schoolId) conditions.push(eq(learners.schoolId, schoolId));
      if (grade) conditions.push(eq(learners.gradeLevel, grade));
      if (fl) conditions.push(eq(learners.functioningLevel, fl));

      const where = conditions.length === 1 ? conditions[0] : and(...conditions);

      const [totalRow] = await db.select({ count: count() }).from(learners).where(where);
      const rows = await db
        .select({
          id: learners.id,
          name: learners.name,
          gradeLevel: learners.gradeLevel,
          functioningLevel: learners.functioningLevel,
          schoolId: learners.schoolId,
          curriculumFramework: learners.curriculumFramework,
          createdAt: learners.createdAt,
          parentId: learners.parentId,
          userId: learners.userId,
        })
        .from(learners)
        .where(where)
        .orderBy(asc(learners.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const enriched = await Promise.all(
        rows.map(async (l: any) => {
          const [parent] = await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(and(eq(users.id, l.parentId), eq(users.tenantId, tid)))
            .limit(1);
          const [school] = l.schoolId
            ? await db
                .select({ id: schools.id, name: schools.name })
                .from(schools)
                .where(and(eq(schools.id, l.schoolId), eq(schools.tenantId, tid)))
                .limit(1)
            : [null];
          return { ...l, parent: parent || null, school: school || null };
        }),
      );

      return { learners: enriched, total: totalRow.count, page, pageSize };
    },
  );

  app.get(
    "/api/district/learners/:id",
    { schema: getDistrictLearnersByIdSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.LearnerRead)) return;
      const { id } = req.params as { id: string };
      const [learner] = await db
        .select()
        .from(learners)
        .where(and(eq(learners.id, id), eq(learners.tenantId, req.tenantId)))
        .limit(1);
      if (!learner) return reply.status(404).send({ error: "Learner not found" });

      const [parent] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(and(eq(users.id, learner.parentId), eq(users.tenantId, req.tenantId)))
        .limit(1);
      const [school] = learner.schoolId
        ? await db
            .select()
            .from(schools)
            .where(and(eq(schools.id, learner.schoolId), eq(schools.tenantId, req.tenantId)))
            .limit(1)
        : [null];

      const [sensory] = await db
        .select()
        .from(sensoryProfiles)
        .where(eq(sensoryProfiles.learnerId, id))
        .limit(1);

      const ieps = await db
        .select()
        .from(iepRecords)
        .where(eq(iepRecords.learnerId, id))
        .orderBy(desc(iepRecords.createdAt));
      const learnerInterventions = await db
        .select()
        .from(interventions)
        .where(eq(interventions.learnerId, id))
        .orderBy(desc(interventions.createdAt));

      return {
        learner,
        parent: parent || null,
        school: school || null,
        sensoryProfile: sensory || null,
        ieps,
        interventions: learnerInterventions,
      };
    },
  );

  app.get(
    "/api/district/staff",
    { schema: getDistrictStaffSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.StaffRead)) return;
      const tid = req.tenantId;
      const {
        page: pageStr,
        pageSize: pageSizeStr,
        search,
        role,
        school: schoolId,
      } = req.query as any;
      const page = safePage(pageStr);
      const pageSize = safePageSize(pageSizeStr);

      const staffRoles = ["TEACHER", "THERAPIST", "CAREGIVER", "DISTRICT_ADMIN"];
      const conditions: any[] = [
        eq(users.tenantId, tid),
        sql`${users.role} = ANY(ARRAY['TEACHER','THERAPIST','CAREGIVER','DISTRICT_ADMIN']::user_role[])`,
        isNull(users.deactivatedAt),
      ];
      if (search)
        conditions.push(or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)));
      if (role) conditions.push(eq(users.role, role));

      const where = and(...conditions);

      const [totalRow] = await db.select({ count: count() }).from(users).where(where);
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          schoolId: users.schoolId,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(where)
        .orderBy(asc(users.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const enriched = await Promise.all(
        rows.map(async (u: any) => {
          const assignments = await db
            .select({
              schoolId: staffAssignments.schoolId,
              roleAtSchool: staffAssignments.roleAtSchool,
              schoolName: schools.name,
            })
            .from(staffAssignments)
            .innerJoin(schools, eq(staffAssignments.schoolId, schools.id))
            .where(
              and(
                eq(staffAssignments.userId, u.id),
                isNull(staffAssignments.removedAt),
                eq(schools.tenantId, tid),
              ),
            );
          return { ...u, schoolAssignments: assignments };
        }),
      );

      let result = enriched;
      if (schoolId) {
        result = enriched.filter((u: any) =>
          u.schoolAssignments.some((a: any) => a.schoolId === schoolId),
        );
      }

      return { staff: result, total: totalRow.count, page, pageSize };
    },
  );

  app.post(
    "/api/district/staff",
    { schema: districtStaffSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.TeacherCreate)) return;
      const tid = req.tenantId;
      const { name, email, role, schoolId: assignSchoolId } = req.body as any;
      if (!name || !email || !role)
        return reply.status(400).send({ error: "Name, email, and role are required" });

      const allowedRoles = ["TEACHER", "THERAPIST", "CAREGIVER"];
      if (!allowedRoles.includes(role))
        return reply
          .status(400)
          .send({ error: `Invalid role. Allowed: ${allowedRoles.join(", ")}` });

      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) return reply.status(409).send({ error: "Email already in use" });

      const tempPassword = crypto.randomBytes(12).toString("base64url");
      const [user] = await db
        .insert(users)
        .values({
          tenantId: tid,
          name,
          email,
          role,
          passwordHash: await argon2.hash(tempPassword),
          mustChangePassword: true,
          schoolId: assignSchoolId || null,
        } as any)
        .returning();

      let schoolName: string | undefined;
      if (assignSchoolId) {
        const [schoolExists] = await db
          .select()
          .from(schools)
          .where(and(eq(schools.id, assignSchoolId), eq(schools.tenantId, tid)))
          .limit(1);
        if (schoolExists) {
          schoolName = schoolExists.name;
          await db
            .insert(staffAssignments)
            .values({ userId: user.id, schoolId: assignSchoolId })
            .onConflictDoNothing();
        }
      }

      // Email the temporary password — never return it in the HTTP
      // response. The admin used to copy-paste from the API result and
      // hand it over out-of-band; now the staff member gets it directly
      // in their inbox and is forced to rotate it on first sign-in.
      const internalKey = process.env.INTERNAL_SERVICE_KEY || DEV_INTERNAL_KEY;
      const loginUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/login`;
      const roleLabel =
        role === "TEACHER" ? "teacher" : role === "THERAPIST" ? "therapist" : "caregiver";
      try {
        await fetch(`${COMMS_SVC_URL}/api/comms/internal/staff-credentials`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-internal-key": internalKey },
          body: JSON.stringify({
            to: email,
            name,
            roleLabel,
            schoolName,
            tempPassword,
            loginUrl,
          }),
        });
      } catch (err) {
        // Fail-soft: the account exists; an admin can issue a password
        // reset to re-deliver credentials.
        req.log?.warn?.({ err: String(err) }, "staff credentials email enqueue failed");
      }

      await logActivity(
        db,
        tid,
        "staff.invited",
        req.user.sub,
        req.user.name || req.user.email,
        "user",
        user.id,
        { name, email, role, schoolId: assignSchoolId || null },
      );

      return {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      };
    },
  );

  app.get(
    "/api/district/staff/:id",
    { schema: getDistrictStaffByIdSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.StaffRead)) return;
      const { id } = req.params as { id: string };
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          schoolId: users.schoolId,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
          deactivatedAt: users.deactivatedAt,
        })
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, req.tenantId)))
        .limit(1);
      if (!user) return reply.status(404).send({ error: "Staff member not found" });

      const assignments = await db
        .select({
          schoolId: staffAssignments.schoolId,
          roleAtSchool: staffAssignments.roleAtSchool,
          schoolName: schools.name,
          assignedAt: staffAssignments.assignedAt,
        })
        .from(staffAssignments)
        .innerJoin(schools, eq(staffAssignments.schoolId, schools.id))
        .where(
          and(
            eq(staffAssignments.userId, id),
            isNull(staffAssignments.removedAt),
            eq(schools.tenantId, req.tenantId),
          ),
        );

      return { user, schoolAssignments: assignments };
    },
  );

  app.put(
    "/api/district/staff/:id",
    { schema: updateDistrictStaffByIdSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.UserManage)) return;
      const { id } = req.params as { id: string };
      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, req.tenantId)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "Staff member not found" });

      const body = req.body as any;
      const updates: any = {};
      if (body.name) updates.name = body.name;
      if (body.schoolId !== undefined) updates.schoolId = body.schoolId;
      updates.updatedAt = new Date();

      const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      await logActivity(
        db,
        req.tenantId,
        "staff.updated",
        req.user.sub,
        req.user.name || req.user.email,
        "user",
        id,
        updates,
      );
      return {
        user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
      };
    },
  );

  app.delete(
    "/api/district/staff/:id",
    { schema: deleteDistrictStaffByIdSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      if (!ensureDistrictPermission(req, reply, Permission.UserManage)) return;
      const { id } = req.params as { id: string };
      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, req.tenantId)))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "Staff member not found" });
      if (existing.role === "DISTRICT_ADMIN")
        return reply.status(403).send({ error: "Cannot deactivate a district admin" });

      await db.update(users).set({ deactivatedAt: new Date() }).where(eq(users.id, id));
      await logActivity(
        db,
        req.tenantId,
        "staff.deactivated",
        req.user.sub,
        req.user.name || req.user.email,
        "user",
        id,
        { name: existing.name },
      );
      return { success: true };
    },
  );

  app.get(
    "/api/district/families",
    { schema: getDistrictFamiliesSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const { search } = req.query as any;

      const conditions: any[] = [
        eq(users.tenantId, tid),
        eq(users.role, "PARENT"),
        isNull(users.deactivatedAt),
      ];
      if (search)
        conditions.push(or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)));

      const parents = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(and(...conditions))
        .orderBy(asc(users.name));

      const enriched = await Promise.all(
        parents.map(async (p: any) => {
          const kids = await db
            .select({ id: learners.id, name: learners.name })
            .from(learners)
            .where(and(eq(learners.parentId, p.id), eq(learners.tenantId, tid)));
          return { ...p, learners: kids, learnerCount: kids.length };
        }),
      );

      return { families: enriched };
    },
  );

  app.get(
    "/api/district/classrooms",
    { schema: getDistrictClassroomsSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const { schoolId } = req.query as any;

      let rows;
      if (schoolId) {
        const [school] = await db
          .select()
          .from(schools)
          .where(and(eq(schools.id, schoolId), eq(schools.tenantId, tid)))
          .limit(1);
        if (!school) return { classrooms: [] };
        rows = await db
          .select()
          .from(classrooms)
          .where(eq(classrooms.schoolId, schoolId))
          .orderBy(asc(classrooms.name));
      } else {
        rows = await db
          .select({
            id: classrooms.id,
            name: classrooms.name,
            gradeLevel: classrooms.gradeLevel,
            subject: classrooms.subject,
            teacherId: classrooms.teacherId,
            capacity: classrooms.capacity,
            schoolId: classrooms.schoolId,
            schoolName: schools.name,
            createdAt: classrooms.createdAt,
          })
          .from(classrooms)
          .innerJoin(schools, eq(classrooms.schoolId, schools.id))
          .where(eq(schools.tenantId, tid))
          .orderBy(asc(classrooms.name));
      }

      return { classrooms: rows };
    },
  );

  app.post(
    "/api/district/classrooms",
    { schema: districtClassroomsSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const { schoolId, name, gradeLevel, subject, teacherId, capacity } = req.body as any;
      if (!schoolId || !name)
        return reply.status(400).send({ error: "School and name are required" });

      const [school] = await db
        .select()
        .from(schools)
        .where(and(eq(schools.id, schoolId), eq(schools.tenantId, req.tenantId)))
        .limit(1);
      if (!school) return reply.status(404).send({ error: "School not found in your district" });

      const [classroom] = await db
        .insert(classrooms)
        .values({ schoolId, name, gradeLevel, subject, teacherId, capacity })
        .returning();
      await logActivity(
        db,
        req.tenantId,
        "classroom.created",
        req.user.sub,
        req.user.name || req.user.email,
        "classroom",
        classroom.id,
        { name, schoolId },
      );
      return { classroom };
    },
  );

  app.get(
    "/api/district/usage",
    { schema: getDistrictUsageSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
      const limits = (tenant?.settings as any)?.subscription?.limits || {};

      const [userCount] = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.tenantId, tid), isNull(users.deactivatedAt)));
      const [learnerCount] = await db
        .select({ count: count() })
        .from(learners)
        .where(eq(learners.tenantId, tid));
      const [teacherCount] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(eq(users.tenantId, tid), eq(users.role, "TEACHER"), isNull(users.deactivatedAt)),
        );
      const [schoolCount] = await db
        .select({ count: count() })
        .from(schools)
        .where(eq(schools.tenantId, tid));

      return {
        users: { used: userCount.count, limit: limits.users || 500 },
        learners: { used: learnerCount.count, limit: limits.learners || 200 },
        teachers: { used: teacherCount.count, limit: limits.teachers || 50 },
        schools: { used: schoolCount.count, limit: limits.schools || 10 },
        aiCalls: { used: 0, limit: limits.aiCalls || 10000, period: "monthly" },
        tutorSessions: { used: 0, limit: limits.tutorSessions || 5000, period: "monthly" },
        storage: { usedMb: 0, limitMb: limits.storageMb || 10240 },
        plan: (tenant?.settings as any)?.subscription?.plan || "Enterprise",
      };
    },
  );

  app.get(
    "/api/district/settings",
    { schema: getDistrictSettingsSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const [settings] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, req.tenantId))
        .limit(1);
      return (
        settings || { notificationPrefs: {}, ssoConfig: {}, branding: {}, featureOverrides: {} }
      );
    },
  );

  app.put(
    "/api/district/settings",
    { schema: updateDistrictSettingsSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const tid = req.tenantId;
      const body = req.body as any;
      const updates: any = { updatedAt: new Date() };
      if (body.notificationPrefs !== undefined) updates.notificationPrefs = body.notificationPrefs;
      // SSO config writes MUST go through `/api/district/sso` so the IdP cert
      // and SP private key are encrypted via @aivo/sso. Reject ssoConfig
      // payloads on this generic endpoint to prevent bypassing encryption.
      if (body.ssoConfig !== undefined) {
        return reply.status(400).send({
          error: "ssoConfig must be updated via PUT /api/district/sso (encryption required).",
        });
      }
      if (body.branding !== undefined) {
        const v = validateBrandingPatch(body.branding);
        if (!v.ok) return reply.status(400).send({ error: v.error });
        // Preserve any existing logo on the row when caller only sends
        // primaryColor/displayName/supportEmail; logo is owned by the
        // dedicated `/branding/logo` endpoint above. We MUST strip
        // logo-related fields here — otherwise a district admin could
        // bypass the PNG/SVG/size validation in the logo upload route by
        // PUTting an arbitrary `logoUrl` (e.g. an external tracker) which
        // every parent/learner client in that tenant would then load.
        const [prior] = await db
          .select()
          .from(districtSettings)
          .where(eq(districtSettings.tenantId, tid))
          .limit(1);
        const priorBranding = (prior?.branding as any) || {};
        const incoming = { ...body.branding };
        // Explicit null clears the logo (reset to AIVO default) — only
        // SETTING a logo must go through the validated upload route.
        const clearLogo = incoming.logoUrl === null;
        delete incoming.logoUrl;
        delete incoming.logoMime;
        delete incoming.logoBytes;
        updates.branding = { ...priorBranding, ...incoming };
        if (clearLogo) {
          updates.branding.logoUrl = null;
          updates.branding.logoMime = null;
          updates.branding.logoBytes = null;
        }
      }
      if (body.featureOverrides !== undefined) updates.featureOverrides = body.featureOverrides;
      // Wave C (G5): recommendation-approval delegation. Strictly-shaped:
      // exactly the two boolean switches, normalized so a truthy string can
      // never widen approval rights. recommendation-svc reads this row on
      // every teacher/caregiver decision.
      if (body.approvalPolicy !== undefined) {
        const ap = body.approvalPolicy;
        if (ap === null || typeof ap !== "object" || Array.isArray(ap)) {
          return reply.status(400).send({
            error: "approvalPolicy must be an object { teacherApproval, caregiverApproval }.",
          });
        }
        const unknownKeys = Object.keys(ap).filter(
          (k) => k !== "teacherApproval" && k !== "caregiverApproval",
        );
        if (unknownKeys.length > 0) {
          return reply
            .status(400)
            .send({ error: `approvalPolicy has unknown keys: ${unknownKeys.join(", ")}` });
        }
        updates.approvalPolicy = {
          teacherApproval: ap.teacherApproval === true,
          caregiverApproval: ap.caregiverApproval === true,
        };
      }

      const [existing] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, tid))
        .limit(1);
      let result;
      if (existing) {
        [result] = await db
          .update(districtSettings)
          .set(updates)
          .where(eq(districtSettings.tenantId, tid))
          .returning();
      } else {
        [result] = await db
          .insert(districtSettings)
          .values({ tenantId: tid, ...updates })
          .returning();
      }
      await logActivity(
        db,
        tid,
        "settings.updated",
        req.user.sub,
        req.user.name || req.user.email,
        "settings",
        tid,
        { fields: Object.keys(updates) },
      );
      return result;
    },
  );

  // Sprint 6: dedicated SSO config GET/PUT that handles encryption of the
  // IdP cert + SP private key. Reading the config never returns plaintext
  // — the UI gets `*Set: true` markers instead so it can render "stored,
  // paste a new value to replace" placeholders.
  app.get(
    "/api/district/sso",
    { schema: getDistrictSsoSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const [settings] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, req.tenantId))
        .limit(1);
      const stored = (settings?.ssoConfig || {}) as any;
      const { idpCertEnvelope, spPrivateKeyEnvelope, oidc, ...safe } = stored;
      // Sprint B1 — never return the encrypted secret envelope (even
      // ciphertext stays server-side); the UI gets a *Set marker.
      const { clientSecretEnvelope, ...oidcSafe } = (oidc || {}) as any;
      return {
        config: {
          ...safe,
          idpCertSet: !!idpCertEnvelope,
          spPrivateKeySet: !!spPrivateKeyEnvelope,
          oidc: oidc
            ? { ...oidcSafe, clientSecretSet: !!clientSecretEnvelope }
            : undefined,
        },
      };
    },
  );

  // Sprint B1 — dry-run an OIDC issuer before enabling it: performs LIVE
  // discovery and reports the resolved endpoints (or the exact failure).
  app.post(
    "/api/district/sso/oidc/test",
    { schema: testDistrictSsoOidcSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const body = (req.body || {}) as { issuer?: string; discoveryUrl?: string };
      if (!body.issuer && !body.discoveryUrl) {
        return reply.status(400).send({ error: "issuer or discoveryUrl is required" });
      }
      const { discoverOidc } = await import("../services/oidc-rp.js");
      try {
        const doc = await discoverOidc({
          issuer: body.issuer || "",
          discoveryUrl: body.discoveryUrl,
          clientId: "dry-run",
          enabled: true,
        } as any);
        return {
          ok: true,
          issuer: doc.issuer,
          authorizationEndpoint: doc.authorization_endpoint,
          tokenEndpoint: doc.token_endpoint,
          jwksUri: doc.jwks_uri,
        };
      } catch (err: any) {
        return reply.status(422).send({ ok: false, error: String(err?.message ?? err) });
      }
    },
  );

  app.put(
    "/api/district/sso",
    { schema: updateDistrictSsoSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const tid = req.tenantId;
      const body = req.body as any;
      const { encryptSsoConfig, IDP_PRESETS } = await import("@aivo/sso");

      const [existing] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, tid))
        .limit(1);
      const prior = (existing?.ssoConfig || {}) as any;

      // Apply preset defaults first, then overlay the user's input so they
      // can still customize.
      const preset = IDP_PRESETS[body.preset as string] || {};
      const merged: any = {
        enabled: !!body.enabled,
        idpLabel: body.idpLabel || preset.idpLabel,
        emailDomains: Array.isArray(body.emailDomains) ? body.emailDomains : [],
        requireSso: !!body.requireSso,
        entryPoint: body.entryPoint || prior.entryPoint,
        logoutUrl: body.logoutUrl || prior.logoutUrl,
        issuer: body.issuer || prior.issuer,
        identifierFormat:
          body.identifierFormat || preset.identifierFormat || prior.identifierFormat,
        emailAttribute: body.emailAttribute || preset.emailAttribute || prior.emailAttribute,
        nameAttribute: body.nameAttribute || preset.nameAttribute || prior.nameAttribute,
        roleAttribute: body.roleAttribute || preset.roleAttribute || prior.roleAttribute,
        defaultRole: body.defaultRole || prior.defaultRole || "TEACHER",
        roleMap: body.roleMap || prior.roleMap || {},
      };
      // Only re-encrypt cert/key if the user actually supplied new plaintext.
      const decryptedInput: any = { ...merged };
      if (typeof body.idpCert === "string" && body.idpCert.trim()) {
        decryptedInput.idpCert = body.idpCert.trim();
      }
      if (typeof body.spPrivateKey === "string" && body.spPrivateKey.trim()) {
        decryptedInput.spPrivateKey = body.spPrivateKey.trim();
      }
      const encrypted = encryptSsoConfig(decryptedInput);
      // Preserve existing envelopes when the user didn't supply replacements.
      if (!encrypted.idpCertEnvelope && prior.idpCertEnvelope)
        encrypted.idpCertEnvelope = prior.idpCertEnvelope;
      if (!encrypted.spPrivateKeyEnvelope && prior.spPrivateKeyEnvelope)
        encrypted.spPrivateKeyEnvelope = prior.spPrivateKeyEnvelope;

      if (encrypted.enabled && !encrypted.entryPoint) {
        return reply.status(400).send({ error: "entryPoint is required to enable SSO" });
      }
      if (encrypted.enabled && !encrypted.idpCertEnvelope) {
        return reply
          .status(400)
          .send({ error: "IdP signing certificate is required to enable SSO" });
      }

      // ── Sprint B1: OIDC relying-party section ─────────────────────────
      // Lives under sso_config.oidc; consumed by routes/oidc-rp.ts. The
      // client secret is encrypted at rest like the SAML cert/key; an
      // omitted secret preserves the stored envelope.
      const priorOidc = (prior.oidc || {}) as any;
      let nextOidc: any = priorOidc;
      if (body.oidc !== undefined) {
        const o = body.oidc || {};
        const { encryptOidcRpConfig } = await import("../services/oidc-rp.js");
        nextOidc = encryptOidcRpConfig({
          enabled: !!o.enabled,
          idpLabel: o.idpLabel ?? priorOidc.idpLabel,
          issuer: o.issuer ?? priorOidc.issuer,
          discoveryUrl: o.discoveryUrl ?? priorOidc.discoveryUrl,
          clientId: o.clientId ?? priorOidc.clientId,
          scopes: Array.isArray(o.scopes) ? o.scopes : priorOidc.scopes,
          emailClaim: o.emailClaim ?? priorOidc.emailClaim,
          nameClaim: o.nameClaim ?? priorOidc.nameClaim,
          roleClaim: o.roleClaim ?? priorOidc.roleClaim,
          roleMap: o.roleMap ?? priorOidc.roleMap,
          defaultRole: o.defaultRole ?? priorOidc.defaultRole,
          emailDomains: Array.isArray(o.emailDomains)
            ? o.emailDomains
            : priorOidc.emailDomains,
          clientSecret: typeof o.clientSecret === "string" ? o.clientSecret : undefined,
        });
        if (!nextOidc.clientSecretEnvelope && priorOidc.clientSecretEnvelope) {
          nextOidc.clientSecretEnvelope = priorOidc.clientSecretEnvelope;
        }
        if (nextOidc.enabled && (!nextOidc.issuer || !nextOidc.clientId)) {
          return reply
            .status(400)
            .send({ error: "issuer and clientId are required to enable OIDC SSO" });
        }
      }
      if (nextOidc && Object.keys(nextOidc).length > 0) {
        (encrypted as any).oidc = nextOidc;
      }

      const updates: any = { ssoConfig: encrypted, updatedAt: new Date() };
      let result;
      if (existing) {
        [result] = await db
          .update(districtSettings)
          .set(updates)
          .where(eq(districtSettings.tenantId, tid))
          .returning();
      } else {
        [result] = await db
          .insert(districtSettings)
          .values({ tenantId: tid, ...updates })
          .returning();
      }
      await logActivity(
        db,
        tid,
        "sso.updated",
        req.user.sub,
        req.user.name || req.user.email,
        "sso_config",
        tid,
        { enabled: encrypted.enabled, requireSso: encrypted.requireSso },
      );
      const { idpCertEnvelope: _a, spPrivateKeyEnvelope: _b, ...safe } = encrypted;
      void _a;
      void _b;
      return {
        ok: true,
        config: {
          ...safe,
          idpCertSet: !!encrypted.idpCertEnvelope,
          spPrivateKeySet: !!encrypted.spPrivateKeyEnvelope,
        },
      };
    },
  );

  app.get(
    "/api/district/activity",
    { schema: getDistrictActivitySchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const {
        page: pageStr,
        pageSize: pageSizeStr,
        action,
        resourceType,
        q,
        from,
        to,
      } = req.query as any;
      const page = safePage(pageStr);
      const pageSize = safePageSize(pageSizeStr, 30);

      const conditions: any[] = [eq(districtActivityLog.tenantId, req.tenantId)];
      if (action) conditions.push(eq(districtActivityLog.action, action));
      if (resourceType) conditions.push(eq(districtActivityLog.resourceType, resourceType));
      // Sprint B4 — free-text + date-range filters for the district audit
      // table (same query the export honors, so preview === download).
      if (q) {
        const needle = `%${q}%`;
        conditions.push(
          or(
            ilike(districtActivityLog.action, needle),
            ilike(districtActivityLog.actorName, needle),
            ilike(districtActivityLog.resourceType, needle),
            sql`${districtActivityLog.details}::text ILIKE ${needle}`,
          ),
        );
      }
      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) conditions.push(gte(districtActivityLog.createdAt, d));
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) conditions.push(lte(districtActivityLog.createdAt, d));
      }

      const where = conditions.length === 1 ? conditions[0] : and(...conditions);

      const [totalRow] = await db.select({ count: count() }).from(districtActivityLog).where(where);
      const rows = await db
        .select()
        .from(districtActivityLog)
        .where(where)
        .orderBy(desc(districtActivityLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { activities: rows, total: totalRow.count, page, pageSize };
    },
  );

  app.get(
    "/api/district/analytics/cohorts",
    { schema: getDistrictAnalyticsCohortsSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const flCounts = await db
        .select({
          level: learners.functioningLevel,
          count: count(),
        })
        .from(learners)
        .where(eq(learners.tenantId, tid))
        .groupBy(learners.functioningLevel);

      const [totalRow] = await db
        .select({ count: count() })
        .from(learners)
        .where(eq(learners.tenantId, tid));
      const total = Number(totalRow.count) || 1;

      return {
        cohorts: flCounts.map((c: any) => ({
          level: c.level,
          count: Number(c.count),
          pct: Math.round((Number(c.count) / total) * 100),
        })),
        total: Number(totalRow.count),
      };
    },
  );

  app.get(
    "/api/district/analytics/engagement",
    { schema: getDistrictAnalyticsEngagementSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const [learnerCount] = await db
        .select({ count: count() })
        .from(learners)
        .where(eq(learners.tenantId, tid));
      return {
        totalLearners: learnerCount.count,
        activeLearners: 0,
        avgSessionDuration: 0,
        completionRate: 0,
      };
    },
  );

  app.get(
    "/api/district/analytics/mastery",
    { schema: getDistrictAnalyticsMasterySchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      return {
        bySubject: [],
        byGrade: [],
        bySchool: [],
      };
    },
  );

  app.get(
    "/api/district/iep/summary",
    { schema: getDistrictIepSummarySchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const [activeCount] = await db
        .select({ count: count() })
        .from(iepRecords)
        .innerJoin(learners, eq(iepRecords.learnerId, learners.id))
        .where(and(eq(learners.tenantId, tid), eq(iepRecords.status, "active")));

      const today = new Date().toISOString().split("T")[0];
      const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      const [dueCount] = await db
        .select({ count: count() })
        .from(iepRecords)
        .innerJoin(learners, eq(iepRecords.learnerId, learners.id))
        .where(
          and(
            eq(learners.tenantId, tid),
            eq(iepRecords.status, "active"),
            sql`${iepRecords.reviewDate} <= ${thirtyDays}`,
            sql`${iepRecords.reviewDate} >= ${today}`,
          ),
        );

      const [overdueCount] = await db
        .select({ count: count() })
        .from(iepRecords)
        .innerJoin(learners, eq(iepRecords.learnerId, learners.id))
        .where(
          and(
            eq(learners.tenantId, tid),
            eq(iepRecords.status, "active"),
            sql`${iepRecords.reviewDate} < ${today}`,
          ),
        );

      const [evalInProgressCount] = await db
        .select({ count: count() })
        .from(iepEvaluations)
        .innerJoin(learners, eq(iepEvaluations.learnerId, learners.id))
        .where(
          and(
            eq(learners.tenantId, tid),
            or(eq(iepEvaluations.status, "draft"), eq(iepEvaluations.status, "submitted")),
          ),
        );

      // Authored IEP drafts (Phase B) — counts both `draft` and `in_review`
      // lifecycle states because both are still being prepared by the team.
      const [draftCount] = await db
        .select({ count: count() })
        .from(iepProfiles)
        .innerJoin(learners, eq(iepProfiles.learnerId, learners.id))
        .where(
          and(
            eq(learners.tenantId, tid),
            eq(iepProfiles.source, "authored"),
            or(
              eq(iepProfiles.lifecycleState, "draft"),
              eq(iepProfiles.lifecycleState, "in_review"),
            ),
          ),
        );

      // Phase C — IEPs sitting in `in_review` are awaiting one or more
      // signatures and surface as a separate tile so case managers know
      // when to nudge signers.
      const [awaitingSignatures] = await db
        .select({ count: count() })
        .from(iepProfiles)
        .innerJoin(learners, eq(iepProfiles.learnerId, learners.id))
        .where(
          and(
            eq(learners.tenantId, tid),
            eq(iepProfiles.source, "authored"),
            eq(iepProfiles.lifecycleState, "in_review"),
          ),
        );

      // Finalised this calendar month — uses updatedAt as the finalisation
      // timestamp because lifecycle flips to `finalised` when the last
      // required signer signs.
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const [finalisedThisMonth] = await db
        .select({ count: count() })
        .from(iepProfiles)
        .innerJoin(learners, eq(iepProfiles.learnerId, learners.id))
        .where(
          and(
            eq(learners.tenantId, tid),
            eq(iepProfiles.source, "authored"),
            eq(iepProfiles.lifecycleState, "finalised"),
            sql`${iepProfiles.updatedAt} >= ${monthStart.toISOString()}`,
          ),
        );

      // Phase D — count of recent parent-visible items (notes/sent reports/
      // proposed amendments) across the tenant's finalised IEPs in the last
      // 14 days. Backed by an internal endpoint on assessment-svc so the
      // counter respects the same visibility rules as the parent timeline.
      let unreadParentUpdates = 0;
      try {
        const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || DEV_INTERNAL_KEY;
        const r = await fetch(
          `${ASSESSMENT_SVC_URL}/api/iep/internal/unread-parent-updates?tenantId=${tid}`,
          {
            headers: { "x-internal-key": INTERNAL_KEY },
          },
        );
        if (r.ok) {
          const j = (await r.json()) as { count?: number };
          unreadParentUpdates = Number(j.count || 0);
        }
      } catch {
        /* best-effort */
      }

      return {
        active: activeCount.count,
        // Phase D contract field — number of active IEPs whose annual
        // review date falls within the next 30 days. `dueForReview` is
        // kept for back-compat with the existing district IEP page.
        reviewsDueIn30Days: dueCount.count,
        dueForReview: dueCount.count,
        overdue: overdueCount.count,
        evaluationsInProgress: evalInProgressCount?.count ?? 0,
        drafts: draftCount?.count ?? 0,
        awaitingSignatures: awaitingSignatures?.count ?? 0,
        finalisedThisMonth: finalisedThisMonth?.count ?? 0,
        unreadParentUpdates,
      };
    },
  );

  app.get(
    "/api/district/iep/evaluations-in-progress",
    { schema: getDistrictIepEvaluationsInProgressSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const rows = await db
        .select({
          id: iepEvaluations.id,
          status: iepEvaluations.status,
          createdAt: iepEvaluations.createdAt,
          submittedAt: iepEvaluations.submittedAt,
          learnerId: learners.id,
          learnerName: learners.name,
          gradeLevel: learners.gradeLevel,
        })
        .from(iepEvaluations)
        .innerJoin(learners, eq(iepEvaluations.learnerId, learners.id))
        .where(
          and(
            eq(learners.tenantId, tid),
            or(eq(iepEvaluations.status, "draft"), eq(iepEvaluations.status, "submitted")),
          ),
        )
        .orderBy(desc(iepEvaluations.updatedAt))
        .limit(10);
      return { evaluations: rows };
    },
  );

  app.get(
    "/api/district/iep/learners",
    { schema: getDistrictIepLearnersSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const rows = await db
        .select({
          iepId: iepRecords.id,
          status: iepRecords.status,
          startDate: iepRecords.startDate,
          reviewDate: iepRecords.reviewDate,
          disabilityCategory: iepRecords.disabilityCategory,
          placement: iepRecords.placement,
          goals: iepRecords.goals,
          learnerId: learners.id,
          learnerName: learners.name,
          gradeLevel: learners.gradeLevel,
          functioningLevel: learners.functioningLevel,
        })
        .from(iepRecords)
        .innerJoin(learners, eq(iepRecords.learnerId, learners.id))
        .where(eq(learners.tenantId, tid))
        .orderBy(asc(iepRecords.reviewDate));

      return { iepLearners: rows };
    },
  );

  app.get(
    "/api/district/interventions",
    { schema: getDistrictInterventionsSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const tid = req.tenantId;
      const { status: filterStatus } = req.query as any;

      const conditions: any[] = [eq(learners.tenantId, tid)];
      if (filterStatus) conditions.push(eq(interventions.status, filterStatus));

      const rows = await db
        .select({
          id: interventions.id,
          type: interventions.type,
          tier: interventions.tier,
          description: interventions.description,
          startDate: interventions.startDate,
          endDate: interventions.endDate,
          status: interventions.status,
          progressNotes: interventions.progressNotes,
          createdAt: interventions.createdAt,
          learnerId: learners.id,
          learnerName: learners.name,
        })
        .from(interventions)
        .innerJoin(learners, eq(interventions.learnerId, learners.id))
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(interventions.createdAt));

      return { interventions: rows };
    },
  );

  app.post(
    "/api/district/iep",
    { schema: districtIepSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const body = req.body as any;
      if (!body.learnerId || !body.startDate || !body.reviewDate) {
        return reply
          .status(400)
          .send({ error: "learnerId, startDate, and reviewDate are required" });
      }
      const [learner] = await db
        .select()
        .from(learners)
        .where(and(eq(learners.id, body.learnerId), eq(learners.tenantId, req.tenantId)))
        .limit(1);
      if (!learner) return reply.status(404).send({ error: "Learner not found in your district" });

      const [iep] = await db
        .insert(iepRecords)
        .values({
          learnerId: body.learnerId,
          startDate: body.startDate,
          reviewDate: body.reviewDate,
          expiryDate: body.expiryDate,
          caseManagerId: body.caseManagerId,
          disabilityCategory: body.disabilityCategory,
          placement: body.placement,
          accommodations: body.accommodations || [],
          goals: body.goals || [],
          services: body.services || [],
        })
        .returning();

      await logActivity(
        db,
        req.tenantId,
        "iep.created",
        req.user.sub,
        req.user.name || req.user.email,
        "iep",
        iep.id,
        { learnerName: learner.name },
      );
      return { iep };
    },
  );

  app.post(
    "/api/district/interventions",
    { schema: districtInterventionsSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const body = req.body as any;
      if (!body.learnerId || !body.type || !body.startDate) {
        return reply.status(400).send({ error: "learnerId, type, and startDate are required" });
      }
      const [learner] = await db
        .select()
        .from(learners)
        .where(and(eq(learners.id, body.learnerId), eq(learners.tenantId, req.tenantId)))
        .limit(1);
      if (!learner) return reply.status(404).send({ error: "Learner not found in your district" });

      const [intervention] = await db
        .insert(interventions)
        .values({
          learnerId: body.learnerId,
          type: body.type,
          tier: body.tier || 2,
          description: body.description,
          startDate: body.startDate,
          assignedBy: req.user.sub,
        })
        .returning();

      await logActivity(
        db,
        req.tenantId,
        "intervention.created",
        req.user.sub,
        req.user.name || req.user.email,
        "intervention",
        intervention.id,
        { learnerName: learner.name },
      );
      return { intervention };
    },
  );

  // ────────────────────────────────────────────────────────────────────
  // Sprint 9 — branding + seat self-service + activity export
  // ────────────────────────────────────────────────────────────────────

  // Logo upload. We accept a base64 data URL in JSON instead of multipart
  // because we deliberately don't pull in @fastify/multipart for one
  // small endpoint, and because logos are stored inline (no S3) anyway.
  // Validation enforces PNG/SVG, ≤200KB, and ≥512×128 pixels.
  app.post(
    "/api/district/settings/branding/logo",
    { schema: districtSettingsBrandingLogoSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const { dataUrl } = (req.body || {}) as { dataUrl?: string };
      if (!dataUrl) return reply.status(400).send({ error: "dataUrl is required" });
      const check = parseLogoDataUrl(dataUrl);
      if (!check.ok) return reply.status(400).send({ error: check.error });

      const tid = req.tenantId;
      const [existing] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, tid))
        .limit(1);
      const branding = {
        ...((existing?.branding as any) || {}),
        logoUrl: dataUrl,
        logoMime: check.mime,
        logoBytes: check.bytes,
      };
      const updates: any = { branding, updatedAt: new Date() };
      let result;
      if (existing) {
        [result] = await db
          .update(districtSettings)
          .set(updates)
          .where(eq(districtSettings.tenantId, tid))
          .returning();
      } else {
        [result] = await db
          .insert(districtSettings)
          .values({ tenantId: tid, ...updates })
          .returning();
      }
      await logActivity(
        db,
        tid,
        "branding.logo.updated",
        req.user.sub,
        req.user.name || req.user.email,
        "settings",
        tid,
        { mime: check.mime, bytes: check.bytes, width: check.width, height: check.height },
      );
      return { ok: true, branding: result.branding };
    },
  );

  // Seat self-service — district admin asks billing for more seats. The
  // request row is the source of truth; comms-svc just notifies billing.
  app.post(
    "/api/district/seats/request",
    { schema: districtSeatsRequestSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const body = (req.body || {}) as { requestedSeats?: number; justification?: string };
      const requested = Number(body.requestedSeats);
      if (!Number.isInteger(requested) || requested < 1 || requested > 100000) {
        return reply
          .status(400)
          .send({ error: "requestedSeats must be an integer between 1 and 100000" });
      }
      const tid = req.tenantId;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
      const limits = (tenant?.settings as any)?.subscription?.limits || {};
      const currentSeats = Number(limits.users) || 0;
      if (requested <= currentSeats) {
        return reply.status(400).send({
          error: `Requested seats (${requested}) must exceed current allocation (${currentSeats})`,
        });
      }
      const [row] = await db
        .insert(seatRequests)
        .values({
          tenantId: tid,
          requestedBy: req.user.sub,
          currentSeats,
          requestedSeats: requested,
          justification: (body.justification || "").slice(0, 2000) || null,
        })
        .returning();

      await logActivity(
        db,
        tid,
        "seats.requested",
        req.user.sub,
        req.user.name || req.user.email,
        "seat_request",
        row.id,
        { currentSeats, requestedSeats: requested },
      );

      // Best-effort billing notification — never block the request on a
      // downstream comms outage. Calls the dedicated billing-alert
      // internal endpoint with the shared internal key.
      const internalKey = process.env.INTERNAL_SERVICE_KEY || DEV_INTERNAL_KEY;
      try {
        const r = await fetch(`${COMMS_SVC_URL}/api/comms/internal/billing-alert`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-internal-key": internalKey },
          body: JSON.stringify({
            kind: "seat_request",
            tenantId: tid,
            tenantName: tenant?.name,
            currentSeats,
            requestedSeats: requested,
            requesterEmail: req.user.email,
            justification: body.justification,
            requestId: row.id,
          }),
          signal: AbortSignal.timeout(2500),
        });
        if (!r.ok)
          req.log?.warn(
            { status: r.status, requestId: row.id },
            "seat-request billing-alert non-2xx",
          );
      } catch (e) {
        req.log?.warn({ e, requestId: row.id }, "seat-request billing-alert failed");
      }

      return { ok: true, request: row };
    },
  );

  // Roster CSV — current seat usage vs contracted limits, suitable for
  // download from the usage dashboard.
  app.get(
    "/api/district/roster.csv",
    { schema: getDistrictRosterCsvSchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const tid = req.tenantId;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
      const limits = (tenant?.settings as any)?.subscription?.limits || {};

      const [userCount] = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.tenantId, tid), isNull(users.deactivatedAt)));
      const [learnerCount] = await db
        .select({ count: count() })
        .from(learners)
        .where(eq(learners.tenantId, tid));
      const [teacherCount] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tid),
            eq(users.role, "TEACHER" as any),
            isNull(users.deactivatedAt),
          ),
        );
      const [schoolCount] = await db
        .select({ count: count() })
        .from(schools)
        .where(eq(schools.tenantId, tid));

      const rows: Array<[string, number | string, number | string]> = [
        ["resource", "used", "contracted"],
        ["users", userCount.count, limits.users ?? ""],
        ["learners", learnerCount.count, limits.learners ?? ""],
        ["teachers", teacherCount.count, limits.teachers ?? ""],
        ["schools", schoolCount.count, limits.schools ?? ""],
      ];
      const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="roster-${tid}.csv"`);
      return csv;
    },
  );

  // Activity export — gated by step-up `data:export` and writes a
  // DATA_EXPORT row to admin_audit_log so the platform team can prove
  // who pulled which slice of activity history. Supports `csv` or
  // `json` (NDJSON) formats and an optional date range.
  const exportStepUp = requireStepUp("data:export");
  app.get(
    "/api/district/activity/export",
    { schema: getDistrictActivityExportSchema, preHandler: exportStepUp },
    async (req: any, reply: any) => {
      const tid = req.tenantId;
      const { from, to, format, action } = (req.query as any) || {};
      const fmt: "csv" | "json" = format === "json" ? "json" : "csv";
      const conds: any[] = [eq(districtActivityLog.tenantId, tid)];
      if (action) conds.push(eq(districtActivityLog.action, action));
      let fromDate: Date | undefined;
      let toDate: Date | undefined;
      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) {
          fromDate = d;
          conds.push(gte(districtActivityLog.createdAt, d));
        }
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) {
          toDate = d;
          conds.push(lte(districtActivityLog.createdAt, d));
        }
      }
      void between;

      const where = conds.length === 1 ? conds[0] : and(...conds);
      const rows = await db
        .select()
        .from(districtActivityLog)
        .where(where)
        .orderBy(asc(districtActivityLog.createdAt))
        .limit(50000);

      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        tenantId: tid,
        action: "DATA_EXPORT",
        actorId: req.user.sub,
        actorEmail: req.user.email || "unknown",
        actorRole: req.user.role || "DISTRICT_ADMIN",
        onBehalfOfId: null,
        resourceType: "district_activity_log",
        resourceId: tid,
        details: {
          rows: rows.length,
          format: fmt,
          from: fromDate?.toISOString() || null,
          to: toDate?.toISOString() || null,
        },
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
        userAgent: req.headers["user-agent"] || null,
      });
      await logActivity(
        db,
        tid,
        "activity.exported",
        req.user.sub,
        req.user.name || req.user.email,
        "district_activity_log",
        tid,
        { rows: rows.length, format: fmt },
      );

      if (fmt === "json") {
        reply.header("content-type", "application/x-ndjson; charset=utf-8");
        reply.header("content-disposition", `attachment; filename="activity-${tid}.ndjson"`);
        return rows.map((r: any) => JSON.stringify(r)).join("\n") + "\n";
      }
      const headers = [
        "createdAt",
        "action",
        "actorId",
        "actorName",
        "resourceType",
        "resourceId",
        "details",
      ];
      const lines = [headers.join(",")];
      for (const r of rows as any[]) {
        lines.push(
          [
            r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
            r.action,
            r.actorId,
            r.actorName ?? "",
            r.resourceType,
            r.resourceId ?? "",
            r.details ? JSON.stringify(r.details) : "",
          ]
            .map(csvCell)
            .join(","),
        );
      }
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="activity-${tid}.csv"`);
      return lines.join("\n") + "\n";
    },
  );

  // Sprint B4 — district-facing hash-chain verification. Recomputes the
  // district_activity_log chain over the requested date range server-side
  // and returns ONLY integrity metadata (the chain is global across
  // tenants, so row contents never leave the server — a district learns
  // whether the ledger its rows live in is intact, not other tenants'
  // data). The slice is anchored against the stored hash of the row
  // immediately preceding the range.
  app.get(
    "/api/district/activity/verify",
    { schema: getDistrictActivityVerifySchema, preHandler: requireDistrictAdmin },
    async (req: any, reply: any) => {
      const { from, to } = (req.query as any) || {};
      let fromDate: Date | undefined;
      let toDate: Date | undefined;
      if (from) {
        const d = new Date(from);
        if (isNaN(d.getTime())) return reply.status(400).send({ error: "Invalid from date" });
        fromDate = d;
      }
      if (to) {
        const d = new Date(to);
        if (isNaN(d.getTime())) return reply.status(400).send({ error: "Invalid to date" });
        toDate = d;
      }
      const result = await verifyAuditChainRange(db, "district_activity_log", {
        from: fromDate,
        to: toDate,
      });
      return {
        intact: result.intact,
        checkedRows: result.checkedRows,
        skippedLegacyRows: result.skippedLegacyRows,
        firstSeq: result.firstSeq,
        lastSeq: result.lastSeq,
        brokenAtSeq: result.brokenAtSeq,
        anchored: result.anchored,
        from: fromDate?.toISOString() ?? null,
        to: toDate?.toISOString() ?? null,
      };
    },
  );

  // Seat-request list (so the dashboard can show pending requests).
  app.get(
    "/api/district/seats/requests",
    { schema: getDistrictSeatsRequestsSchema, preHandler: requireDistrictAdmin },
    async (req: any) => {
      const rows = await db
        .select()
        .from(seatRequests)
        .where(eq(seatRequests.tenantId, req.tenantId))
        .orderBy(desc(seatRequests.createdAt))
        .limit(50);
      return { requests: rows };
    },
  );
}

function csvCell(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// PUT /api/district/settings is defined above; palette validation lives
// in `validateBrandingPatch` so the handler and tests share it. Sprint B6:
// primary/secondary go through @aivo/brand's contrast guard — checked
// against the REAL text/surface tokens in both themes, with the specific
// per-check failure messages surfaced to the caller.
export function validateBrandingPatch(branding: any): { ok: boolean; error?: string } {
  if (!branding || typeof branding !== "object") return { ok: true };
  const verdict = evaluateBrandPalette({
    primaryColor: typeof branding.primaryColor === "string" ? branding.primaryColor : null,
    secondaryColor: typeof branding.secondaryColor === "string" ? branding.secondaryColor : null,
  });
  if (!verdict.ok) {
    return { ok: false, error: verdict.failures.map((f) => f.message).join("; ") };
  }
  if (branding.supportEmail !== undefined && typeof branding.supportEmail === "string") {
    if (branding.supportEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(branding.supportEmail)) {
      return { ok: false, error: "supportEmail must be a valid email address" };
    }
  }
  if (
    branding.supportUrl !== undefined &&
    typeof branding.supportUrl === "string" &&
    branding.supportUrl
  ) {
    let parsed: URL;
    try {
      parsed = new URL(branding.supportUrl);
    } catch {
      return { ok: false, error: "supportUrl must be an absolute http(s) URL" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "supportUrl must use http(s) — no custom schemes" };
    }
    if (branding.supportUrl.length > 512) {
      return { ok: false, error: "supportUrl must be 512 characters or fewer" };
    }
  }
  if (branding.displayName !== undefined && typeof branding.displayName === "string") {
    if (branding.displayName.length > 120) {
      return { ok: false, error: "displayName must be 120 characters or fewer" };
    }
  }
  return { ok: true };
}
