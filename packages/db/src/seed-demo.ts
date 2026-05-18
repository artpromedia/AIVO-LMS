import { createDb } from "./index.js";
import { tenants, users, learners, learnerTeachers } from "./schema/index.js";
import { and, eq } from "drizzle-orm";
import argon2 from "argon2";

/**
 * Demo seed: creates one parent account with three learners — one per tier
 * (K-5 Soft Meadow, 6-8 Study Treehouse, 9-12 Focus Studio) — so the new
 * tier badge surfacing can be exercised end-to-end. Also rewrites the
 * platform-admin password (which the base seed wrote with SHA-256) using
 * argon2, so it actually works against the production login flow.
 *
 * Idempotent: safe to re-run; existing rows are updated in place.
 */
async function seedDemo() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const db = createDb(url);

  const PASSWORD = "Demo123!";
  const passwordHash = await argon2.hash(PASSWORD);

  // 1. Fix admin password (base seed used SHA-256, login uses argon2).
  const adminEmail = "admin@aivo.dev";
  const adminAdminPasswordHash = await argon2.hash("admin123");
  await db
    .update(users)
    .set({ passwordHash: adminAdminPasswordHash })
    .where(eq(users.email, adminEmail));
  console.log(`✓ admin@aivo.dev password rehashed with argon2 (login: admin123)`);

  // 2. Demo family tenant.
  let demoTenantId: string;
  const existingTenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, "Demo Family"))
    .limit(1);
  if (existingTenant.length > 0) {
    demoTenantId = existingTenant[0].id;
  } else {
    const [t] = await db
      .insert(tenants)
      .values({ name: "Demo Family", type: "B2C_FAMILY" })
      .returning();
    demoTenantId = t.id;
  }
  console.log(`✓ Demo Family tenant: ${demoTenantId}`);

  // 3. Parent user.
  const parentEmail = "parent@demo.aivo";
  let parentId: string;
  const existingParent = await db.select().from(users).where(eq(users.email, parentEmail)).limit(1);
  if (existingParent.length > 0) {
    parentId = existingParent[0].id;
    await db.update(users).set({ passwordHash, emailVerified: true }).where(eq(users.id, parentId));
  } else {
    const [p] = await db
      .insert(users)
      .values({
        tenantId: demoTenantId,
        email: parentEmail,
        passwordHash,
        name: "Demo Parent",
        role: "PARENT",
        emailVerified: true,
      })
      .returning();
    parentId = p.id;
  }
  console.log(`✓ parent@demo.aivo (Demo Parent) — ${parentId}`);

  // 4. Three learners — one per tier. Each learner needs its own LEARNER user record.
  const TIER_LEARNERS = [
    { gradeLevel: "3", name: "Mia (K-5)", email: "mia@demo.aivo", tier: "Soft Meadow" },
    { gradeLevel: "7", name: "Leo (6-8)", email: "leo@demo.aivo", tier: "Study Treehouse" },
    { gradeLevel: "11", name: "Ava (9-12)", email: "ava@demo.aivo", tier: "Focus Studio" },
  ];

  for (const l of TIER_LEARNERS) {
    // (a) Learner user account
    let learnerUserId: string;
    const existingUser = await db.select().from(users).where(eq(users.email, l.email)).limit(1);
    if (existingUser.length > 0) {
      learnerUserId = existingUser[0].id;
      await db
        .update(users)
        .set({ passwordHash, emailVerified: true })
        .where(eq(users.id, learnerUserId));
    } else {
      const [u] = await db
        .insert(users)
        .values({
          tenantId: demoTenantId,
          email: l.email,
          passwordHash,
          name: l.name,
          role: "LEARNER",
          emailVerified: true,
        })
        .returning();
      learnerUserId = u.id;
    }

    // (b) Learner record
    const existingLearner = await db
      .select()
      .from(learners)
      .where(eq(learners.userId, learnerUserId))
      .limit(1);
    if (existingLearner.length > 0) {
      await db
        .update(learners)
        .set({ gradeLevel: l.gradeLevel, name: l.name, parentId })
        .where(eq(learners.id, existingLearner[0].id));
    } else {
      await db.insert(learners).values({
        tenantId: demoTenantId,
        userId: learnerUserId,
        parentId,
        name: l.name,
        gradeLevel: l.gradeLevel,
        functioningLevel: "STANDARD",
      });
    }
    console.log(`  ↳ ${l.email} grade=${l.gradeLevel} → ${l.tier}`);
  }

  // 5. Demo TEACHER inside a B2B school tenant, accepted onto the K-5 demo
  //    learner. The IEP authoring flow gates writes on a TEACHER role plus
  //    an ACCEPTED learnerTeachers link, so without this fixture the
  //    Playwright authoring spec couldn't run against the dev DB.
  let schoolTenantId: string;
  const existingSchool = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, "Demo School"))
    .limit(1);
  if (existingSchool.length > 0) {
    schoolTenantId = existingSchool[0].id;
  } else {
    const [t] = await db
      .insert(tenants)
      .values({
        name: "Demo School",
        type: "B2B_DISTRICT" as any,
      })
      .returning();
    schoolTenantId = t.id;
  }
  console.log(`✓ Demo School tenant: ${schoolTenantId}`);

  const teacherEmail = "teacher@demo.aivo";
  let teacherId: string;
  const existingTeacher = await db
    .select()
    .from(users)
    .where(eq(users.email, teacherEmail))
    .limit(1);
  if (existingTeacher.length > 0) {
    teacherId = existingTeacher[0].id;
    await db
      .update(users)
      .set({
        passwordHash,
        role: "TEACHER" as any,
        tenantId: schoolTenantId,
        emailVerified: true,
      })
      .where(eq(users.id, teacherId));
  } else {
    const [u] = await db
      .insert(users)
      .values({
        tenantId: schoolTenantId,
        email: teacherEmail,
        passwordHash,
        name: "Demo Teacher",
        role: "TEACHER" as any,
        emailVerified: true,
      })
      .returning();
    teacherId = u.id;
  }
  console.log(`✓ teacher@demo.aivo (Demo Teacher) — ${teacherId}`);

  // Pick the K-5 demo learner (Mia) for the assignment so the seeded teacher
  // has an obvious target. Lookup is by email/name pair to stay idempotent.
  const [miaUser] = await db.select().from(users).where(eq(users.email, "mia@demo.aivo")).limit(1);
  if (miaUser) {
    const [miaLearner] = await db
      .select()
      .from(learners)
      .where(eq(learners.userId, miaUser.id))
      .limit(1);
    if (miaLearner) {
      const [existingLink] = await db
        .select()
        .from(learnerTeachers)
        .where(
          and(
            eq(learnerTeachers.learnerId, miaLearner.id),
            eq(learnerTeachers.teacherUserId, teacherId),
          ),
        )
        .limit(1);
      if (existingLink) {
        if (existingLink.status !== "ACCEPTED") {
          await db
            .update(learnerTeachers)
            .set({
              status: "ACCEPTED",
              acceptedAt: new Date(),
            })
            .where(eq(learnerTeachers.id, existingLink.id));
        }
      } else {
        await db.insert(learnerTeachers).values({
          tenantId: demoTenantId,
          learnerId: miaLearner.id,
          teacherEmail,
          teacherUserId: teacherId,
          invitedBy: parentId,
          status: "ACCEPTED",
          acceptedAt: new Date(),
        } as any);
      }
      console.log(`  ↳ Demo Teacher accepted onto Mia (${miaLearner.id})`);
    }
  }

  console.log(`\nAll demo accounts use password: ${PASSWORD}`);
  process.exit(0);
}

seedDemo().catch((e) => {
  console.error(e);
  process.exit(1);
});
