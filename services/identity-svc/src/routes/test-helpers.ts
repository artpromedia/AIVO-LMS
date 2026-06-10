/**
 * Test-only routes for end-to-end and integration tests.
 *
 * These routes are ONLY registered when `IDENTITY_TEST_MODE=1` is set in the
 * environment. They MUST NEVER be enabled in production: they expose enough
 * to bypass MFA challenges (by reading the latest one-time code) and seed
 * arbitrary users.
 *
 * The startup logger surfaces a loud warning when this module registers, and
 * the route handlers themselves re-check the env flag on every request as
 * defense-in-depth (so flipping the flag at runtime instantly disables them).
 */
import { FastifyInstance } from "fastify";
import {
  users,
  mfaCodes,
  tenants,
  learners,
  learnerTeachers,
  iepProfiles,
  iepProgressNotes,
  iepEvaluations,
  parentInAppNotifications,
  webLearnerProfiles,
} from "@aivo/db";
import { eq, and, sql } from "drizzle-orm";
import argon2 from "argon2";
import { signJWT } from "@aivo/security";
import {
  getTestLastMfaCodeByEmailSchema,
  testSeedDistrictAdminSchema,
  testSeedIepTimelineFixtureSchema,
  testSeedIepEvaluationFixtureSchema,
  testSeedIepAuthoringFixtureSchema,
} from "./schemas.js";

function testModeEnabled(): boolean {
  return process.env.IDENTITY_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
}

export function registerTestHelperRoutes(app: FastifyInstance) {
  if (!testModeEnabled()) return;

  app.log.warn(
    "IDENTITY_TEST_MODE=1: registering /api/__test__/* helper routes. NEVER enable in production.",
  );

  // Liveness probe consumed by `identityTestModeReachable()` in
  // e2e/lib/fixtures.ts. When test mode is off this returns 404 (the
  // module isn't registered at all), so probing for 200 == "test mode
  // is on" is sufficient.
  app.get("/api/__test__/health", async (_req, reply) => {
    if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
    return { ok: true, mode: "test", service: "identity-svc" };
  });

  // Idempotent seed for a B2C_FAMILY parent. Used by the Stripe purchase
  // → entitlement and learner lesson-loop e2e specs. Returns a real
  // access token so the caller can drive authenticated requests against
  // billing-svc / tutor-svc.
  app.post<{ Body: { email: string; password: string; tenantName?: string; tenantId?: string } }>(
    "/api/__test__/seed-parent",
    async (req, reply) => {
      if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
      const db = (app as any).db;
      const { email, password, tenantName, tenantId } = req.body ?? ({} as any);
      if (!email || !password) {
        return reply.status(400).send({ error: "email and password required" });
      }
      const lcEmail = email.toLowerCase();

      // When tenantId is supplied (district-pilot e2e), seed the parent INTO that
      // existing tenant — so the parent lives under the district, not a new B2C
      // tenant. Otherwise create/reuse a B2C_FAMILY tenant by name.
      let tenant: any;
      if (tenantId) {
        [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
        if (!tenant) return reply.status(400).send({ error: "tenantId not found" });
      } else {
        const desiredTenantName = tenantName ?? `E2E Family ${lcEmail}`;
        [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.name, desiredTenantName))
          .limit(1);
        if (!tenant) {
          [tenant] = await db
            .insert(tenants)
            .values({ name: desiredTenantName, type: "B2C_FAMILY" as any })
            .returning();
        }
      }

      const passwordHash = await argon2.hash(password);
      let [user] = await db.select().from(users).where(eq(users.email, lcEmail)).limit(1);
      if (user) {
        await db
          .update(users)
          .set({
            passwordHash,
            role: "PARENT",
            tenantId: tenant.id,
            mfaEnabled: false,
            deactivatedAt: null,
          })
          .where(eq(users.id, user.id));
        [user] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      } else {
        [user] = await db
          .insert(users)
          .values({
            email: lcEmail,
            name: "E2E Parent",
            passwordHash,
            role: "PARENT" as any,
            tenantId: tenant.id,
            mfaEnabled: false,
          })
          .returning();
      }

      const accessToken = await signJWT({
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
        email: user.email,
        name: user.name,
      });

      return {
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        accessToken,
      };
    },
  );

  // Idempotent seed for a LEARNER child of an existing parent. The learner
  // gets their own underlying users row (role=LEARNER) plus a learners
  // row keyed by parentId so RLS-style scoping in family-svc works.
  app.post<{
    Body: { parentUserId: string; tenantId: string; name?: string; gradeLevel?: string };
  }>("/api/__test__/seed-learner", async (req, reply) => {
    if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
    const db = (app as any).db;
    const { parentUserId, tenantId, name, gradeLevel } = req.body ?? ({} as any);
    if (!parentUserId || !tenantId) {
      return reply.status(400).send({ error: "parentUserId and tenantId required" });
    }
    const learnerName = name ?? `E2E Learner ${parentUserId.slice(0, 8)}`;
    // Reuse an existing learner for this parent so the helper stays
    // idempotent across reruns. Identified by (parentId, name).
    const existing = await db
      .select()
      .from(learners)
      .where(and(eq(learners.parentId, parentUserId), eq(learners.name, learnerName)))
      .limit(1);
    if (existing[0]) {
      return {
        learnerId: existing[0].id,
        learnerUserId: existing[0].userId,
        parentUserId,
        tenantId,
      };
    }
    // Underlying user row for the learner. argon2 hash is irrelevant —
    // learners don't log in via password — but the column is NOT NULL.
    const placeholderHash = await argon2.hash(`learner-placeholder-${Date.now()}`);
    const [learnerUser] = await db
      .insert(users)
      .values({
        email: `learner-${parentUserId.slice(0, 8)}-${Date.now()}@e2e.test`,
        name: learnerName,
        passwordHash: placeholderHash,
        role: "LEARNER" as any,
        tenantId,
        mfaEnabled: false,
      })
      .returning();
    const [learner] = await db
      .insert(learners)
      .values({
        tenantId,
        userId: learnerUser.id,
        parentId: parentUserId,
        name: learnerName,
        gradeLevel: gradeLevel ?? "5",
      })
      .returning();
    // Mirror into the web-v2 learner store: billing's pilot seat usage
    // counts web_learner_profiles, so a seeded learner occupies a real seat.
    await db
      .insert(webLearnerProfiles)
      .values({
        id: learner.id,
        tenantId,
        data: { name: learnerName, createdAt: new Date().toISOString(), seededBy: "e2e" },
      })
      .onConflictDoNothing();
    return {
      learnerId: learner.id,
      learnerUserId: learnerUser.id,
      parentUserId,
      tenantId,
    };
  });

  // Fetch the latest unused login MFA code for an email. Used by Playwright
  // happy-path specs to complete the MFA challenge for forced-MFA roles.
  app.get<{ Params: { email: string } }>(
    "/api/__test__/last-mfa-code/:email",
    { schema: getTestLastMfaCodeByEmailSchema },
    async (req, reply) => {
      if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
      const db = (app as any).db;
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) return reply.status(404).send({ error: "User not found" });
      const [latest] = await db
        .select()
        .from(mfaCodes)
        .where(
          and(
            eq(mfaCodes.userId, user.id),
            eq(mfaCodes.used, false),
            eq(mfaCodes.purpose, "login"),
          ),
        )
        .orderBy(sql`created_at DESC`)
        .limit(1);
      if (!latest) return reply.status(404).send({ error: "No MFA code issued" });
      return { code: latest.code, expiresAt: latest.expiresAt };
    },
  );

  // Idempotent seeding for a DISTRICT_ADMIN test fixture used by e2e specs.
  app.post<{
    Body: {
      email: string;
      password: string;
      tenantName?: string;
      mfaEnabled?: boolean;
      seatLimit?: number;
    };
  }>(
    "/api/__test__/seed-district-admin",
    { schema: testSeedDistrictAdminSchema },
    async (req, reply) => {
      if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
      const db = (app as any).db;
      const {
        email,
        password,
        tenantName = "E2E District Tenant",
        mfaEnabled = false,
        seatLimit,
      } = req.body;
      if (!email || !password) {
        return reply.status(400).send({ error: "email and password required" });
      }

      // Pilot district carries a seat cap so the Sprint 2 parent-invite e2e can
      // exercise seat enforcement. A unique tenant name per seatLimit avoids
      // colliding with the default tenant.
      const desiredTenantName =
        typeof seatLimit === "number" ? `${tenantName} (cap ${seatLimit})` : tenantName;
      let [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.name, desiredTenantName))
        .limit(1);
      if (!tenant) {
        [tenant] = await db
          .insert(tenants)
          .values({
            name: desiredTenantName,
            type: "B2B_DISTRICT" as any,
            ...(typeof seatLimit === "number"
              ? { licensingTier: "B2B_SEAT_LICENSED", seatLimit }
              : {}),
          } as any)
          .returning();
      } else if (typeof seatLimit === "number") {
        await db
          .update(tenants)
          .set({ licensingTier: "B2B_SEAT_LICENSED", seatLimit } as any)
          .where(eq(tenants.id, tenant.id));
      }

      const passwordHash = await argon2.hash(password);
      const lcEmail = email.toLowerCase();
      let [user] = await db.select().from(users).where(eq(users.email, lcEmail)).limit(1);
      if (user) {
        await db
          .update(users)
          .set({
            passwordHash,
            role: "DISTRICT_ADMIN",
            tenantId: tenant.id,
            mfaEnabled,
            deactivatedAt: null,
          })
          .where(eq(users.id, user.id));
      } else {
        [user] = await db
          .insert(users)
          .values({
            email: lcEmail,
            name: "E2E District Admin",
            passwordHash,
            role: "DISTRICT_ADMIN",
            tenantId: tenant.id,
            mfaEnabled,
          })
          .returning();
      }

      const accessToken = await signJWT({
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
        email: user.email,
        name: user.name,
      });
      return {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        accessToken,
      };
    },
  );

  // Idempotent seed for a SCHOOL_ADMIN under a B2B_SCHOOL tenant. Mirrors
  // seed-district-admin; consumed by e2e/lib/fixtures.ts seedSchoolAdmin
  // (admin-console RBAC specs need a real non-platform admin token).
  app.post<{
    Body: { email: string; password: string; tenantName?: string; mfaEnabled?: boolean };
  }>("/api/__test__/seed-school-admin", async (req, reply) => {
    if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
    const db = (app as any).db;
    const {
      email,
      password,
      tenantName = "E2E School Tenant",
      mfaEnabled = false,
    } = req.body ?? ({} as any);
    if (!email || !password) {
      return reply.status(400).send({ error: "email and password required" });
    }

    let [tenant] = await db.select().from(tenants).where(eq(tenants.name, tenantName)).limit(1);
    if (!tenant) {
      [tenant] = await db
        .insert(tenants)
        .values({ name: tenantName, type: "B2B_SCHOOL" as any } as any)
        .returning();
    }

    const passwordHash = await argon2.hash(password);
    const lcEmail = email.toLowerCase();
    let [user] = await db.select().from(users).where(eq(users.email, lcEmail)).limit(1);
    if (user) {
      await db
        .update(users)
        .set({
          passwordHash,
          role: "SCHOOL_ADMIN",
          tenantId: tenant.id,
          mfaEnabled,
          deactivatedAt: null,
        })
        .where(eq(users.id, user.id));
    } else {
      [user] = await db
        .insert(users)
        .values({
          email: lcEmail,
          name: "E2E School Admin",
          passwordHash,
          role: "SCHOOL_ADMIN",
          tenantId: tenant.id,
          mfaEnabled,
        })
        .returning();
    }

    const accessToken = await signJWT({
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: tenant.id,
      accessToken,
    };
  });

  // Idempotent seed for a tenant-less SUPPORT platform-staff user. The admin
  // console's nav-shell e2e uses it to prove role-gated items stay hidden
  // for non-admin platform roles.
  app.post<{ Body: { email: string; password: string } }>(
    "/api/__test__/seed-support",
    async (req, reply) => {
      if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
      const db = (app as any).db;
      const { email, password } = req.body ?? ({} as any);
      if (!email || !password) {
        return reply.status(400).send({ error: "email and password required" });
      }
      const lcEmail = email.toLowerCase();
      const passwordHash = await argon2.hash(password);
      let [user] = await db.select().from(users).where(eq(users.email, lcEmail)).limit(1);
      if (user) {
        await db
          .update(users)
          .set({
            passwordHash,
            role: "SUPPORT",
            tenantId: null,
            mfaEnabled: false,
            deactivatedAt: null,
          })
          .where(eq(users.id, user.id));
        [user] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      } else {
        [user] = await db
          .insert(users)
          .values({
            email: lcEmail,
            name: "E2E Support Staff",
            passwordHash,
            role: "SUPPORT" as any,
            tenantId: null,
            mfaEnabled: false,
          })
          .returning();
      }
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: null,
        role: user.role,
        email: user.email,
        name: user.name,
      });
      return {
        id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: "",
        accessToken,
      };
    },
  );

  // Idempotent seed for a PLATFORM_ADMIN. Used by the district-pilot e2e to
  // drive POST /api/admin/pilots with a real platform-admin bearer token.
  // Platform admins are tenant-less; the response shape mirrors the other
  // seed-* helpers (e2e/lib/fixtures.ts seedPlatformAdmin).
  app.post<{ Body: { email: string; password: string } }>(
    "/api/__test__/seed-platform-admin",
    async (req, reply) => {
      if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
      const db = (app as any).db;
      const { email, password } = req.body ?? ({} as any);
      if (!email || !password) {
        return reply.status(400).send({ error: "email and password required" });
      }
      const lcEmail = email.toLowerCase();
      const passwordHash = await argon2.hash(password);
      let [user] = await db.select().from(users).where(eq(users.email, lcEmail)).limit(1);
      if (user) {
        await db
          .update(users)
          .set({
            passwordHash,
            role: "PLATFORM_ADMIN",
            tenantId: null,
            mfaEnabled: false,
            deactivatedAt: null,
          })
          .where(eq(users.id, user.id));
        [user] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      } else {
        [user] = await db
          .insert(users)
          .values({
            email: lcEmail,
            name: "E2E Platform Admin",
            passwordHash,
            role: "PLATFORM_ADMIN" as any,
            tenantId: null,
            mfaEnabled: false,
          })
          .returning();
      }
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: null,
        role: user.role,
        email: user.email,
        name: user.name,
      });
      return { userId: user.id, tenantId: "", role: user.role, accessToken };
    },
  );

  // Idempotent seeding for the parent IEP "Updates" timeline e2e fixture.
  // Builds two tenants:
  //   - Tenant A (B2C_FAMILY): a PARENT with a LEARNER child + a finalised
  //     IEP profile + two progress notes (one parent-visible, one internal).
  //   - Tenant B (B2B_SCHOOL): a TEACHER with no relationship to the
  //     learner above. Used to assert cross-tenant access is blocked.
  // Re-running the endpoint resets passwords + replaces the seeded notes
  // so the spec sees a deterministic timeline on every run.
  app.post<{
    Body: {
      parentEmail: string;
      parentPassword: string;
      teacherEmail: string;
      teacherPassword: string;
      learnerName?: string;
      parentNoteBody?: string;
      internalNoteBody?: string;
      // Sprint 3 task #18: when true, additionally seed an unread row in
      // parent_in_app_notifications so the spec can assert the global
      // dashboard bell picks up IEP-pipeline events, not just legacy
      // parent_notifications.
      seedInAppUnread?: boolean;
      inAppTitle?: string;
    };
  }>(
    "/api/__test__/seed-iep-timeline-fixture",
    { schema: testSeedIepTimelineFixtureSchema },
    async (req, reply) => {
      if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
      const db = (app as any).db;
      const {
        parentEmail,
        parentPassword,
        teacherEmail,
        teacherPassword,
        learnerName = "E2E Updates Learner",
        parentNoteBody = "PARENT_VISIBLE_NOTE_BODY: timeline e2e parent-visible",
        internalNoteBody = "INTERNAL_ONLY_NOTE_BODY: timeline e2e internal-only",
        seedInAppUnread = false,
        inAppTitle = "E2E in-app: new progress note",
      } = req.body;
      if (!parentEmail || !parentPassword || !teacherEmail || !teacherPassword) {
        return reply.status(400).send({
          error: "parentEmail, parentPassword, teacherEmail, teacherPassword required",
        });
      }
      if (parentEmail.toLowerCase() === teacherEmail.toLowerCase()) {
        return reply.status(400).send({ error: "parent and teacher emails must differ" });
      }

      // Two distinct tenants — names keyed off the email so concurrent runs
      // with different fixtures don't collide.
      const parentTenantName = `E2E Family Tenant <${parentEmail.toLowerCase()}>`;
      const teacherTenantName = `E2E School Tenant <${teacherEmail.toLowerCase()}>`;

      let [parentTenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.name, parentTenantName))
        .limit(1);
      if (!parentTenant) {
        [parentTenant] = await db
          .insert(tenants)
          .values({ name: parentTenantName, type: "B2C_FAMILY" as any })
          .returning();
      }
      let [teacherTenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.name, teacherTenantName))
        .limit(1);
      if (!teacherTenant) {
        [teacherTenant] = await db
          .insert(tenants)
          .values({ name: teacherTenantName, type: "B2B_SCHOOL" as any })
          .returning();
      }

      async function upsertUser(
        email: string,
        password: string,
        role: string,
        name: string,
        tenantId: string,
      ) {
        const lc = email.toLowerCase();
        const passwordHash = await argon2.hash(password);
        let [u] = await db.select().from(users).where(eq(users.email, lc)).limit(1);
        if (u) {
          await db
            .update(users)
            .set({
              passwordHash,
              role: role as any,
              tenantId,
              mfaEnabled: false,
              deactivatedAt: null,
            })
            .where(eq(users.id, u.id));
          [u] = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
        } else {
          [u] = await db
            .insert(users)
            .values({
              email: lc,
              name,
              passwordHash,
              role: role as any,
              tenantId,
              mfaEnabled: false,
            })
            .returning();
        }
        return u;
      }

      const parentUser = await upsertUser(
        parentEmail,
        parentPassword,
        "PARENT",
        "E2E Parent",
        parentTenant.id,
      );
      const teacherUser = await upsertUser(
        teacherEmail,
        teacherPassword,
        "TEACHER",
        "E2E Teacher",
        teacherTenant.id,
      );

      // Learner needs an underlying user row (LEARNER role). Look up by a
      // synthetic name+parent pair so we don't need a separate email.
      const learnerUserName = `${learnerName} <${parentUser.id}>`;
      let [learnerUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.name, learnerUserName), eq(users.role, "LEARNER" as any)))
        .limit(1);
      if (!learnerUser) {
        [learnerUser] = await db
          .insert(users)
          .values({
            name: learnerUserName,
            role: "LEARNER" as any,
            tenantId: parentTenant.id,
          })
          .returning();
      } else if (learnerUser.tenantId !== parentTenant.id) {
        await db
          .update(users)
          .set({ tenantId: parentTenant.id })
          .where(eq(users.id, learnerUser.id));
      }

      let [learner] = await db
        .select()
        .from(learners)
        .where(and(eq(learners.userId, learnerUser.id), eq(learners.parentId, parentUser.id)))
        .limit(1);
      if (!learner) {
        [learner] = await db
          .insert(learners)
          .values({
            tenantId: parentTenant.id,
            userId: learnerUser.id,
            parentId: parentUser.id,
            name: learnerName,
            gradeLevel: "3",
          })
          .returning();
      } else if (learner.tenantId !== parentTenant.id) {
        await db
          .update(learners)
          .set({ tenantId: parentTenant.id })
          .where(eq(learners.id, learner.id));
      }

      let [profile] = await db
        .select()
        .from(iepProfiles)
        .where(eq(iepProfiles.learnerId, learner.id))
        .orderBy(sql`updated_at DESC`)
        .limit(1);
      if (!profile) {
        [profile] = await db
          .insert(iepProfiles)
          .values({
            learnerId: learner.id,
            source: "authored",
            lifecycleState: "finalised",
            gradeLevel: "3",
          })
          .returning();
      } else if (profile.lifecycleState !== "finalised") {
        [profile] = await db
          .update(iepProfiles)
          .set({ lifecycleState: "finalised", updatedAt: new Date() })
          .where(eq(iepProfiles.id, profile.id))
          .returning();
      }

      // Reset notes for this profile so each run starts clean — otherwise
      // re-runs would accumulate duplicates that confuse the assertions.
      await db.delete(iepProgressNotes).where(eq(iepProgressNotes.iepProfileId, profile.id));
      const [parentNote] = await db
        .insert(iepProgressNotes)
        .values({
          iepProfileId: profile.id,
          learnerId: learner.id,
          authorId: parentUser.id,
          body: parentNoteBody,
          visibility: "parent",
        })
        .returning();
      const [internalNote] = await db
        .insert(iepProgressNotes)
        .values({
          iepProfileId: profile.id,
          learnerId: learner.id,
          authorId: parentUser.id,
          body: internalNoteBody,
          visibility: "internal",
        })
        .returning();

      let inAppNotificationId: string | null = null;
      if (seedInAppUnread) {
        // Reset existing in-app rows for this parent so re-runs start clean.
        await db
          .delete(parentInAppNotifications)
          .where(eq(parentInAppNotifications.parentId, parentUser.id));
        const [row] = await db
          .insert(parentInAppNotifications)
          .values({
            parentId: parentUser.id,
            learnerId: learner.id,
            category: "progress_notes",
            template: "iep_progress_note",
            title: inAppTitle,
            body: parentNoteBody,
            link: `/dashboard/parent/learner/${learner.id}/iep`,
          })
          .returning();
        inAppNotificationId = row.id;
      }

      return {
        parent: { id: parentUser.id, email: parentUser.email, tenantId: parentTenant.id },
        teacher: { id: teacherUser.id, email: teacherUser.email, tenantId: teacherTenant.id },
        learner: { id: learner.id, name: learner.name, tenantId: parentTenant.id },
        iepProfileId: profile.id,
        notes: { parentNoteId: parentNote.id, internalNoteId: internalNote.id },
        bodies: { parent: parentNoteBody, internal: internalNoteBody },
        inAppNotificationId,
        inAppTitle: seedInAppUnread ? inAppTitle : null,
      };
    },
  );

  // Idempotent seeding for the IEP authoring Playwright spec (task #14).
  // Builds a B2B_DISTRICT tenant with TEACHER + PARENT + LEARNER, plus an
  // ACCEPTED learnerTeachers link the IEP authoring writes gate on.
  // Re-running clears prior authored drafts so the spec opens against an
  // empty drafts list.
  type SeedFixtureBody = {
    parentEmail: string;
    parentPassword: string;
    teacherEmail: string;
    teacherPassword: string;
    learnerName?: string;
    tenantName?: string;
  };

  async function seedTeacherParentLearnerFixture(
    body: SeedFixtureBody,
    defaults: {
      learnerName: string;
      tenantPrefix: string;
      parentLabel: string;
      teacherLabel: string;
    },
    cleanup: (ctx: { db: any; learnerId: string }) => Promise<void>,
  ) {
    const db = (app as any).db;
    const {
      parentEmail,
      parentPassword,
      teacherEmail,
      teacherPassword,
      learnerName = defaults.learnerName,
      tenantName,
    } = body;

    if (!parentEmail || !parentPassword || !teacherEmail || !teacherPassword) {
      return {
        status: 400,
        payload: { error: "parentEmail, parentPassword, teacherEmail, teacherPassword required" },
      };
    }
    if (parentEmail.toLowerCase() === teacherEmail.toLowerCase()) {
      return { status: 400, payload: { error: "parent and teacher emails must differ" } };
    }

    const tName = tenantName || `${defaults.tenantPrefix} <${teacherEmail.toLowerCase()}>`;
    let [tenant] = await db.select().from(tenants).where(eq(tenants.name, tName)).limit(1);
    if (!tenant) {
      [tenant] = await db
        .insert(tenants)
        .values({ name: tName, type: "B2B_DISTRICT" as any })
        .returning();
    }

    async function upsertUser(
      email: string,
      password: string,
      role: string,
      name: string,
      tenantId: string,
    ) {
      const lc = email.toLowerCase();
      const passwordHash = await argon2.hash(password);
      let [u] = await db.select().from(users).where(eq(users.email, lc)).limit(1);
      if (u) {
        await db
          .update(users)
          .set({
            passwordHash,
            role: role as any,
            tenantId,
            mfaEnabled: false,
            deactivatedAt: null,
          })
          .where(eq(users.id, u.id));
        [u] = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
      } else {
        [u] = await db
          .insert(users)
          .values({
            email: lc,
            name,
            passwordHash,
            role: role as any,
            tenantId,
            mfaEnabled: false,
          })
          .returning();
      }
      return u;
    }

    const parentUser = await upsertUser(
      parentEmail,
      parentPassword,
      "PARENT",
      defaults.parentLabel,
      tenant.id,
    );
    const teacherUser = await upsertUser(
      teacherEmail,
      teacherPassword,
      "TEACHER",
      defaults.teacherLabel,
      tenant.id,
    );

    const learnerUserName = `${learnerName} <${parentUser.id}>`;
    let [learnerUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.name, learnerUserName), eq(users.role, "LEARNER" as any)))
      .limit(1);
    if (!learnerUser) {
      [learnerUser] = await db
        .insert(users)
        .values({
          name: learnerUserName,
          role: "LEARNER" as any,
          tenantId: tenant.id,
        })
        .returning();
    } else if (learnerUser.tenantId !== tenant.id) {
      await db.update(users).set({ tenantId: tenant.id }).where(eq(users.id, learnerUser.id));
    }

    let [learner] = await db
      .select()
      .from(learners)
      .where(and(eq(learners.userId, learnerUser.id), eq(learners.parentId, parentUser.id)))
      .limit(1);
    if (!learner) {
      [learner] = await db
        .insert(learners)
        .values({
          tenantId: tenant.id,
          userId: learnerUser.id,
          parentId: parentUser.id,
          name: learnerName,
          gradeLevel: "3",
        })
        .returning();
    } else if (learner.tenantId !== tenant.id) {
      await db.update(learners).set({ tenantId: tenant.id }).where(eq(learners.id, learner.id));
    }

    let [link] = await db
      .select()
      .from(learnerTeachers)
      .where(
        and(
          eq(learnerTeachers.learnerId, learner.id),
          eq(learnerTeachers.teacherUserId, teacherUser.id),
        ),
      )
      .limit(1);
    if (!link) {
      [link] = await db
        .insert(learnerTeachers)
        .values({
          tenantId: tenant.id,
          learnerId: learner.id,
          teacherEmail: teacherUser.email,
          teacherUserId: teacherUser.id,
          invitedBy: parentUser.id,
          status: "ACCEPTED",
          acceptedAt: new Date(),
        } as any)
        .returning();
    } else if (link.status !== "ACCEPTED") {
      await db
        .update(learnerTeachers)
        .set({ status: "ACCEPTED", acceptedAt: new Date() })
        .where(eq(learnerTeachers.id, link.id));
    }

    await cleanup({ db, learnerId: learner.id });

    return {
      status: 200,
      payload: {
        parent: { id: parentUser.id, email: parentUser.email, tenantId: tenant.id },
        teacher: { id: teacherUser.id, email: teacherUser.email, tenantId: tenant.id },
        learner: { id: learner.id, name: learner.name, tenantId: tenant.id },
      },
    };
  }

  // Idempotent seeding for eligibility-evaluation e2e tests.
  app.post<{ Body: SeedFixtureBody }>(
    "/api/__test__/seed-iep-evaluation-fixture",
    { schema: testSeedIepEvaluationFixtureSchema },
    async (req, reply) => {
      if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
      const result = await seedTeacherParentLearnerFixture(
        req.body,
        {
          learnerName: "E2E Eval Learner",
          tenantPrefix: "E2E Eval Tenant",
          parentLabel: "E2E Eval Parent",
          teacherLabel: "E2E Eval Teacher",
        },
        async ({ db, learnerId }) => {
          await db.delete(iepEvaluations).where(eq(iepEvaluations.learnerId, learnerId));
        },
      );
      if (result.status !== 200) return reply.status(result.status).send(result.payload);
      return result.payload;
    },
  );

  // Idempotent seeding for IEP authoring e2e tests.
  app.post<{ Body: SeedFixtureBody }>(
    "/api/__test__/seed-iep-authoring-fixture",
    { schema: testSeedIepAuthoringFixtureSchema },
    async (req, reply) => {
      if (!testModeEnabled()) return reply.status(404).send({ error: "Not found" });
      const result = await seedTeacherParentLearnerFixture(
        req.body,
        {
          learnerName: "E2E Authoring Learner",
          tenantPrefix: "E2E Authoring Tenant",
          parentLabel: "E2E Authoring Parent",
          teacherLabel: "E2E Authoring Teacher",
        },
        async ({ db, learnerId }) => {
          await db
            .delete(iepProfiles)
            .where(and(eq(iepProfiles.learnerId, learnerId), eq(iepProfiles.source, "authored")));
        },
      );
      if (result.status !== 200) return reply.status(result.status).send(result.payload);
      return result.payload;
    },
  );
}
