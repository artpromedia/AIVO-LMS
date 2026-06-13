/**
 * Pilot seed — district / cohort pilots carried over from an earlier Aivo
 * deployment, repopulated for the platform dashboard.
 *
 * Populates the exact rows the pilot operations read model
 * (services/billing-svc/src/routes/pilot-status.ts → `loadPilotStatus`)
 * counts, so each pilot shows up at /platform/pilots and on the /platform
 * "Active pilots" panel with live numbers:
 *
 *   - District          → `tenants.name`
 *   - Seats used / cap   → count(web_learner_profiles) / tenants.seat_limit
 *   - Parents            → count(users role=PARENT, not deactivated)
 *   - Therapists         → count(users role=THERAPIST, not deactivated)
 *   - Learners           → count(web_learner_profiles)
 *   - Coupon ×           → billing_coupons.redemptions (provisioning coupon)
 *   - Expires / Status   → ACTIVE subscription's current_period_end
 *
 * The read model lists a pilot when an ACTIVE subscription carries
 * `metadata.provisionedBy = 'pilot'` (or plan ∈ {enterprise, district}), so
 * each pilot here gets a PROVISIONING coupon + an ACTIVE "pilot" subscription,
 * mirroring the real billing-svc pilot-provision path
 * (provisionTenantEntitlement) without needing the services to be running.
 *
 * Source data: the four real Aivo pilots (Dubai School District, Rewire for
 * Autism, Qatar School District, Catholic Schools in Minnesota). Every row is
 * tagged `source: legacy_pilot_migration` (so the carried-over pilots are easy
 * to find / re-sync); seeded users also carry `provisioned_by = 'pilot_seed'`.
 * The three school pilots get one parent per child plus therapists (≈1 per 25
 * learners); Rewire keeps its 50 families and no therapists.
 *
 * Idempotent: safe to re-run. Tenants/coupons/subscriptions are upserted, and
 * the learner + parent/therapist rows are scoped by a deterministic id / tag
 * and rewritten so the counts always land on the target numbers.
 *
 * Run:  DATABASE_URL=… pnpm --filter @aivo/db db:seed:pilots
 */
import { createDb, closeDb } from "./index.js";
import {
  tenants,
  users,
  subscriptions,
  billingCoupons,
  webLearnerProfiles,
  webParentLearnerRelationships,
  learners as learnersTable,
  lessonRuns,
} from "./schema/index.js";
import { and, eq, sql } from "drizzle-orm";

type TenantType = "B2C_FAMILY" | "B2B_SCHOOL" | "B2B_DISTRICT";
type GradeBand = "preK" | "K" | "1-2" | "3-5" | "6-8" | "9-12";

interface PilotSite {
  /** School / institution name; used as the learner's schoolContext. */
  school: string;
  /** Optional campus or location under the school. */
  campus?: string;
}

interface PilotDef {
  /** Stable slug used to build deterministic row ids. */
  slug: string;
  /** Traceability id for the carried-over pilot. */
  pilotId: string;
  tenantName: string;
  tenantType: TenantType;
  region: string;
  displaySummary: string;
  /** Provisioning coupon code (also recorded on the subscription metadata). */
  couponCode: string;
  /** tenants.seat_limit and the coupon's grants_seat_limit. */
  seatLimit: number;
  /** Children participating → this many web_learner_profiles rows. */
  children: number;
  /** PARENT users to create (one per child for the school pilots), each linked
   *  1:1 to a learner. The dashboard's "Parents" column counts these. */
  parents: number;
  /** THERAPIST users to create (≈1 per 25 learners for the school pilots).
   *  The dashboard's "Therapists" column counts these. 0 = none. */
  therapists: number;
  /** Named schools/campuses; learners are spread across them round-robin. */
  sites: PilotSite[];
  /** Label used as schoolContext when a pilot has no named sites (cohort). */
  cohortLabel?: string;
}

// ── Pilot definitions (the real pilots carried over from earlier Aivo) ─────────
const PILOTS: PilotDef[] = [
  {
    slug: "dubai",
    pilotId: "pilot-dubai-school-district-2026",
    tenantName: "Dubai School District",
    tenantType: "B2B_DISTRICT",
    region: "Dubai, UAE",
    displaySummary: "3 schools · 1,200 children participating",
    couponCode: "PILOT-DUBAI-2026",
    seatLimit: 1200,
    children: 1200,
    parents: 1200, // one parent per child
    therapists: 48, // 1 per 25 learners
    sites: [
      { school: "Al Ittihad Private School", campus: "Al Mamzar" },
      { school: "Al Ittihad Private School", campus: "Al Safa" },
      { school: "Al Mawakeb School", campus: "Al Barsha" },
      { school: "Al Mawakeb School", campus: "Al Garhoud" },
      { school: "Al Mawakeb School", campus: "Al Khawaneej" },
      { school: "Al Rashid Al Saleh Private School", campus: "Dubai" },
    ],
  },
  {
    slug: "rewire",
    pilotId: "pilot-rewire-for-autism-2026",
    tenantName: "Rewire for Autism",
    tenantType: "B2C_FAMILY",
    region: "Community pilot",
    displaySummary: "50 families · 50 children participating",
    couponCode: "PILOT-REWIRE-2026",
    seatLimit: 50,
    children: 50,
    parents: 50, // 50 participating families
    therapists: 0, // family cohort — left as-is
    sites: [],
    cohortLabel: "Rewire for Autism family cohort",
  },
  {
    slug: "qatar",
    pilotId: "pilot-qatar-school-district-2026",
    tenantName: "Qatar School District",
    tenantType: "B2B_DISTRICT",
    region: "Qatar",
    displaySummary: "4 schools · 312 children participating",
    couponCode: "PILOT-QATAR-2026",
    seatLimit: 312,
    children: 312,
    parents: 312, // one parent per child
    therapists: 13, // 1 per 25 learners (ceil)
    sites: [
      { school: "Philippine International School Qatar", campus: "Doha" },
      { school: "Al Jazeera Academy", campus: "Al Wakra" },
      { school: "Al Khor International School", campus: "Al Khor" },
      { school: "Philippine School Doha", campus: "Al Muntazah" },
    ],
  },
  {
    slug: "catholic-mn",
    pilotId: "pilot-catholic-schools-minnesota-2026",
    tenantName: "Catholic Schools in Minnesota",
    tenantType: "B2B_DISTRICT",
    region: "Minnesota, USA",
    displaySummary: "Annunciation Catholic School · 20 children participating",
    couponCode: "PILOT-CATHOLIC-MN-2026",
    seatLimit: 20,
    children: 20,
    parents: 20, // one parent per child
    therapists: 1, // 1 per 25 learners (ceil)
    sites: [{ school: "Annunciation Catholic School", campus: "Minnesota" }],
  },
];

// Entitlement shape shared by every pilot subscription/coupon.
const PLAN = "enterprise";
const TIER = "enterprise";
const DURATION_DAYS = 180;
const SEED_SOURCE = "legacy_pilot_migration";
const SEED_PROVISIONED_BY = "pilot_seed"; // users.provisioned_by tag for cleanup
const ACTOR_EMAIL = "pilot-seeder@aivo.local";

// Representative learner names spread across each pilot's sites.
const FIRST_NAMES = [
  "Aisha",
  "Liam",
  "Noor",
  "Mateo",
  "Sofia",
  "Omar",
  "Maya",
  "Yusuf",
  "Lena",
  "Ibrahim",
  "Aria",
  "Zayd",
  "Hana",
  "Ethan",
  "Layla",
  "Adam",
  "Sara",
  "Ali",
  "Mila",
  "Rayan",
  "Nora",
  "Idris",
  "Leah",
  "Kai",
  "Amira",
  "Tariq",
  "Ivy",
  "Sami",
  "Zara",
  "Jude",
  "Mariam",
  "Hamza",
  "Eva",
  "Bilal",
  "Lucia",
  "Faris",
  "Nina",
  "Karim",
  "Dana",
  "Reem",
];
const LAST_INITIALS = "ABCDEFGHJKLMNPRSTW".split("");
const GRADE_BANDS: GradeBand[] = ["preK", "K", "1-2", "3-5", "6-8", "9-12"];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Dates ──────────────────────────────────────────────────────────────────────────────────
// Spread the pilots across Feb 2026 → now so the dashboard growth curves read
// as gradual adoption, not a single vertical spike on the day we seed.
const PILOT_WINDOW_START_MS = Date.UTC(2026, 1, 1); // 1 Feb 2026
const SEED_NOW_MS = Date.now();
const PILOT_STAGGER_MS = 18 * 86_400_000; // each pilot opens ~18 days after the last
const MIN_ONBOARD_WINDOW_MS = 30 * 86_400_000;

function pilotStartMs(pilotIndex: number): number {
  const start = PILOT_WINDOW_START_MS + pilotIndex * PILOT_STAGGER_MS;
  // Always leave at least a month of onboarding runway before "now".
  return Math.min(start, SEED_NOW_MS - MIN_ONBOARD_WINDOW_MS);
}

/** Linear onboarding date for learner i (1-based) between the pilot start and now. */
function learnerCreatedMs(startMs: number, i: number, total: number): number {
  const frac = total <= 1 ? 0 : (i - 1) / (total - 1);
  return Math.round(startMs + frac * (SEED_NOW_MS - startMs));
}

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

// ── Learner identity (shared by the web profile + the learners-of-record) ──
function childDisplayName(i: number): string {
  const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
  const lastInitial = LAST_INITIALS[(i - 1) % LAST_INITIALS.length];
  return `${firstName} ${lastInitial}.`;
}
function gradeBandFor(i: number): GradeBand {
  return GRADE_BANDS[(i - 1) % GRADE_BANDS.length];
}

// ── Lessons ───────────────────────────────────────────────────────────────────────────
const LESSON_SUBJECTS = ["math", "ela", "science", "sel", "life_skills"];
/** Deterministic 3–8 lessons per child. */
function lessonCountFor(i: number): number {
  return 3 + ((i * 7) % 6);
}
function buildLessonRuns(
  pilot: PilotDef,
  i: number,
  tenantId: string,
  learnerId: string,
  createdMs: number,
): (typeof lessonRuns.$inferInsert)[] {
  const count = lessonCountFor(i);
  const rows: (typeof lessonRuns.$inferInsert)[] = [];
  for (let n = 1; n <= count; n++) {
    const ms = Math.round(createdMs + (n / (count + 1)) * (SEED_NOW_MS - createdMs));
    // ~1 in 4 children has their latest lesson still in progress; the rest done.
    const inProgress = n === count && i % 4 === 0;
    const startedIso = isoAt(ms);
    const endedIso = isoAt(Math.min(ms + 12 * 60_000, SEED_NOW_MS));
    rows.push({
      id: `lr-pilot-${pilot.slug}-${i}-${n}`,
      tenantId,
      learnerId,
      subjectId: LESSON_SUBJECTS[(i + n) % LESSON_SUBJECTS.length],
      source: "pilot_seed",
      status: inProgress ? "in_progress" : "completed",
      startedAt: startedIso,
      completedAt: inProgress ? null : endedIso,
      createdAt: startedIso,
      updatedAt: endedIso,
    });
  }
  return rows;
}

function buildLearnerProfile(
  pilot: PilotDef,
  n: number,
  tenantId: string,
  createdAtIso: string,
) {
  const site = pilot.sites.length ? pilot.sites[(n - 1) % pilot.sites.length] : null;
  const schoolContext = site
    ? site.campus
      ? `${site.school} — ${site.campus}`
      : site.school
    : (pilot.cohortLabel ?? null);
  const firstName = FIRST_NAMES[(n - 1) % FIRST_NAMES.length];
  const displayName = childDisplayName(n);
  return {
    id: `lrn-pilot-${pilot.slug}-${n}`,
    tenantId,
    displayName,
    firstName,
    preferredName: null,
    // Spread birth years across a plausible K-12 range (ages ~5–18 in 2026).
    birthYear: 2008 + (n % 13),
    ageRange: null,
    gradeBand: gradeBandFor(n),
    schoolContext,
    primaryLanguage: null,
    readingComfort: null,
    mathComfort: null,
    knownStrengths: [],
    knownChallenges: [],
    accessibilityDefaults: {
      reducedMotion: false,
      highContrast: false,
      largeText: false,
      audioFirst: false,
      captionsAlwaysOn: false,
    },
    zipCode: null,
    districtId: null,
    districtName: pilot.tenantName,
    functioningLevel: null,
    readinessState: "profile_created",
    iepDecision: null,
    createdAt: createdAtIso,
    // Provenance — marks the row as a carried-over legacy pilot.
    source: SEED_SOURCE,
    pilotId: pilot.pilotId,
  };
}

async function seedPilots() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const db = createDb(url);

  // Platform actor that owns every pilot subscription (subscriptions.user_id is
  // NOT NULL with an FK to users.id). Mirrors the real pilot-provision flow,
  // which records the platform actor — not a tenant parent — as the owner.
  const [actor] = await db.select().from(users).where(eq(users.email, ACTOR_EMAIL)).limit(1);
  let actorId: string;
  if (actor) {
    actorId = actor.id;
  } else {
    const [a] = await db
      .insert(users)
      .values({
        email: ACTOR_EMAIL,
        name: "AIVO Pilot Seeder",
        role: "PLATFORM_ADMIN",
        emailVerified: true,
        provisionedBy: SEED_PROVISIONED_BY,
      })
      .returning();
    actorId = a.id;
  }
  console.log(`✓ platform actor ${ACTOR_EMAIL} — ${actorId}\n`);

  for (const pilot of PILOTS) {
    const pilotIndex = PILOTS.indexOf(pilot);
    const startMs = pilotStartMs(pilotIndex);

    // 1) Tenant (upsert by name).
    const [existingTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.name, pilot.tenantName))
      .limit(1);
    let tenantId: string;
    if (existingTenant) {
      tenantId = existingTenant.id;
      await db
        .update(tenants)
        .set({
          type: pilot.tenantType,
          licensingTier: TIER,
          seatLimit: pilot.seatLimit,
          // Prod tenants.status is an ENUM (tenant_status) with UPPERCASE
          // values; the drizzle schema types it as varchar, so lowercase would
          // pass typecheck but fails in prod (invalid input value for enum).
          status: "ACTIVE",
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));
    } else {
      const [t] = await db
        .insert(tenants)
        .values({
          name: pilot.tenantName,
          type: pilot.tenantType,
          licensingTier: TIER,
          seatLimit: pilot.seatLimit,
          status: "ACTIVE",
        })
        .returning();
      tenantId = t.id;
    }

    // 2) PROVISIONING coupon (upsert) — drives the dashboard "Coupon ×" count.
    //    One provisioning redemption, exactly as the real pilot-provision flow.
    await db
      .insert(billingCoupons)
      .values({
        code: pilot.couponCode,
        description: `Pilot provisioning for ${pilot.tenantName}`,
        discountPct: 0,
        maxRedemptions: 1,
        redemptions: 1,
        couponType: "PROVISIONING",
        grantsTier: TIER,
        grantsPlan: PLAN,
        grantsSeatLimit: pilot.seatLimit,
        grantsDurationDays: DURATION_DAYS,
      })
      .onConflictDoUpdate({
        target: billingCoupons.code,
        set: {
          couponType: "PROVISIONING",
          grantsTier: TIER,
          grantsPlan: PLAN,
          grantsSeatLimit: pilot.seatLimit,
          grantsDurationDays: DURATION_DAYS,
          maxRedemptions: 1,
          redemptions: 1,
          active: true,
        },
      });

    // 3) ACTIVE pilot subscription (insert-once on (tenant, couponCode)).
    const periodEnd = new Date(startMs + DURATION_DAYS * 86_400_000);
    const metadata = {
      couponCode: pilot.couponCode,
      provisionedBy: "pilot",
      source: SEED_SOURCE,
      pilotId: pilot.pilotId,
      displaySummary: pilot.displaySummary,
      region: pilot.region,
    };
    const existingSub = (await db.execute(sql`
      SELECT id FROM subscriptions
      WHERE tenant_id = ${tenantId}
        AND metadata ->> 'couponCode' = ${pilot.couponCode}
        AND status = 'ACTIVE'
      LIMIT 1
    `)) as unknown as { rows?: Array<{ id: string }> } | Array<{ id: string }>;
    const subRows = Array.isArray(existingSub) ? existingSub : (existingSub.rows ?? []);
    if (subRows.length > 0) {
      await db
        .update(subscriptions)
        .set({
          plan: PLAN,
          status: "ACTIVE",
          currentPeriodStart: new Date(startMs),
          currentPeriodEnd: periodEnd,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subRows[0].id));
    } else {
      await db.insert(subscriptions).values({
        tenantId,
        userId: actorId,
        plan: PLAN,
        status: "ACTIVE",
        currentPeriodStart: new Date(startMs),
        currentPeriodEnd: periodEnd,
        metadata,
      });
    }

    // 4) Learner profiles → seatsUsed / learnersCreated. Clear the prior seed
    //    first. FK order matters: lesson_runs and the learners-of-record (which
    //    reference the parent users) must be deleted before step 5 drops users.
    await db
      .delete(lessonRuns)
      .where(
        and(
          eq(lessonRuns.tenantId, tenantId),
          sql`${lessonRuns.id} LIKE ${`lr-pilot-${pilot.slug}-%`}`,
        ),
      );
    await db.delete(learnersTable).where(eq(learnersTable.tenantId, tenantId));
    await db
      .delete(webLearnerProfiles)
      .where(
        and(
          eq(webLearnerProfiles.tenantId, tenantId),
          sql`${webLearnerProfiles.id} LIKE ${`lrn-pilot-${pilot.slug}-%`}`,
        ),
      );
    const learnerRows = Array.from({ length: pilot.children }, (_, i) => {
      const createdAtIso = isoAt(learnerCreatedMs(startMs, i + 1, pilot.children));
      const profile = buildLearnerProfile(pilot, i + 1, tenantId, createdAtIso);
      return { id: profile.id, tenantId, data: profile };
    });
    for (const c of chunk(learnerRows, 500)) {
      await db.insert(webLearnerProfiles).values(c);
    }

    // 5) Parent + therapist users. Both are scoped + rewritten via the
    //    provisioned_by tag so re-runs land on the exact counts. The delete
    //    spares the platform actor (tenant_id IS NULL, so it never matches).
    await db
      .delete(webParentLearnerRelationships)
      .where(
        and(
          eq(webParentLearnerRelationships.tenantId, tenantId),
          sql`${webParentLearnerRelationships.id} LIKE ${`plr-pilot-${pilot.slug}-%`}`,
        ),
      );
    await db
      .delete(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.provisionedBy, SEED_PROVISIONED_BY)));

    // Parents → parentsOnboarded, each linked 1:1 to the learner at the same index.
    if (pilot.parents > 0) {
      const parentNumbers = Array.from({ length: pilot.parents }, (_, i) => i + 1);
      for (const batch of chunk(parentNumbers, 500)) {
        const inserted = await db
          .insert(users)
          .values(
            batch.map((idx) => ({
              tenantId,
              email: `${pilot.slug}-parent-${idx}@pilot.aivo.local`,
              name: `${pilot.tenantName} Parent ${idx}`,
              role: "PARENT" as const,
              emailVerified: true,
              provisionedBy: SEED_PROVISIONED_BY,
              externalId: `${pilot.slug}-parent-${idx}`,
            })),
          )
          .returning({ id: users.id });
        const rels = inserted.map((p, j) => {
          const idx = batch[j];
          const relId = `plr-pilot-${pilot.slug}-${idx}`;
          const learnerId = `lrn-pilot-${pilot.slug}-${idx}`;
          return {
            id: relId,
            parentUserId: p.id,
            learnerId,
            tenantId,
            data: {
              id: relId,
              parentUserId: p.id,
              learnerId,
              tenantId,
              relation: "parent",
              isPrimary: true,
            },
          };
        });
        await db.insert(webParentLearnerRelationships).values(rels);

        // Learner of record → the platform "Learners" KPI counts `learners`.
        // userId = parentId: "each parent represents a learner", so the Users
        // KPI grows only by the parents (no separate learner logins).
        const learnersOfRecord = inserted.map((p, j) => {
          const idx = batch[j];
          const created = new Date(learnerCreatedMs(startMs, idx, pilot.children));
          return {
            tenantId,
            userId: p.id,
            parentId: p.id,
            name: childDisplayName(idx),
            gradeLevel: gradeBandFor(idx),
            region: pilot.region,
            districtName: pilot.tenantName,
            createdAt: created,
            updatedAt: created,
          };
        });
        await db.insert(learnersTable).values(learnersOfRecord);

        // 3–8 lessons per child → the platform "Lesson runs" total.
        const lessonBatch = batch.flatMap((idx) =>
          buildLessonRuns(
            pilot,
            idx,
            tenantId,
            `lrn-pilot-${pilot.slug}-${idx}`,
            learnerCreatedMs(startMs, idx, pilot.children),
          ),
        );
        for (const c of chunk(lessonBatch, 500)) {
          await db.insert(lessonRuns).values(c);
        }
      }
    }

    // 6) Therapist users → therapistsOnboarded. Site staff serving the whole
    //    pilot, so they aren't tied to an individual learner.
    if (pilot.therapists > 0) {
      const therapistNumbers = Array.from({ length: pilot.therapists }, (_, i) => i + 1);
      for (const batch of chunk(therapistNumbers, 500)) {
        await db.insert(users).values(
          batch.map((idx) => ({
            tenantId,
            email: `${pilot.slug}-therapist-${idx}@pilot.aivo.local`,
            name: `${pilot.tenantName} Therapist ${idx}`,
            role: "THERAPIST" as const,
            emailVerified: true,
            provisionedBy: SEED_PROVISIONED_BY,
            externalId: `${pilot.slug}-therapist-${idx}`,
          })),
        );
      }
    }

    console.log(
      `✓ ${pilot.tenantName.padEnd(32)} tenant=${tenantId}\n` +
        `    seats=${pilot.seatLimit}  learners=${pilot.children}  parents=${pilot.parents}  therapists=${pilot.therapists}  coupon=${pilot.couponCode}`,
    );
  }

  // ── Self-verify: replay the read model's exact counts so the seed reports
  //    the same numbers the dashboard will render. ───────────────────────────
  console.log("\nDashboard read-model verification (GET /api/billing/admin/pilots):");
  const listed = (await db.execute(sql`
    SELECT DISTINCT s.tenant_id
    FROM subscriptions s
    WHERE s.status = 'ACTIVE'
      AND (s.metadata ->> 'provisionedBy' = 'pilot' OR s.plan IN ('enterprise', 'district'))
  `)) as unknown as { rows?: Array<{ tenant_id: string }> } | Array<{ tenant_id: string }>;
  const listedRows = Array.isArray(listed) ? listed : (listed.rows ?? []);
  for (const pilot of PILOTS) {
    const [t] = await db.select().from(tenants).where(eq(tenants.name, pilot.tenantName)).limit(1);
    if (!t) continue;
    const learners = (await db.execute(sql`
      SELECT count(*)::int AS c FROM web_learner_profiles WHERE tenant_id = ${t.id}
    `)) as unknown as { rows?: Array<{ c: number }> } | Array<{ c: number }>;
    const parents = (await db.execute(sql`
      SELECT count(*)::int AS c FROM users
      WHERE tenant_id = ${t.id} AND role = 'PARENT' AND deactivated_at IS NULL
    `)) as unknown as { rows?: Array<{ c: number }> } | Array<{ c: number }>;
    const therapists = (await db.execute(sql`
      SELECT count(*)::int AS c FROM users
      WHERE tenant_id = ${t.id} AND role = 'THERAPIST' AND deactivated_at IS NULL
    `)) as unknown as { rows?: Array<{ c: number }> } | Array<{ c: number }>;
    const ofRecord = (await db.execute(sql`
      SELECT count(*)::int AS c FROM learners WHERE tenant_id = ${t.id}
    `)) as unknown as { rows?: Array<{ c: number }> } | Array<{ c: number }>;
    const lessonRows = (await db.execute(sql`
      SELECT count(*)::int AS c FROM lesson_runs WHERE tenant_id = ${t.id}
    `)) as unknown as { rows?: Array<{ c: number }> } | Array<{ c: number }>;
    const lc = Number((Array.isArray(learners) ? learners : (learners.rows ?? []))[0]?.c ?? 0);
    const pc = Number((Array.isArray(parents) ? parents : (parents.rows ?? []))[0]?.c ?? 0);
    const tc = Number(
      (Array.isArray(therapists) ? therapists : (therapists.rows ?? []))[0]?.c ?? 0,
    );
    const lor = Number((Array.isArray(ofRecord) ? ofRecord : (ofRecord.rows ?? []))[0]?.c ?? 0);
    const lessons = Number(
      (Array.isArray(lessonRows) ? lessonRows : (lessonRows.rows ?? []))[0]?.c ?? 0,
    );
    const inList = listedRows.some((r) => r.tenant_id === t.id);
    console.log(
      `  ${inList ? "•" : "✗"} ${pilot.tenantName.padEnd(32)} ` +
        `learners=${lor}(profiles=${lc})/${pilot.seatLimit}  parents=${pc}  therapists=${tc}  lessons=${lessons}  ` +
        `${inList ? "(listed)" : "(NOT LISTED)"}`,
    );
  }

  console.log(`\n${PILOTS.length} pilots seeded.`);
  await closeDb(db);
  process.exit(0);
}

seedPilots().catch((e) => {
  console.error(e);
  process.exit(1);
});
