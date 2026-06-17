/**
 * District overview seed — a realistic, fully-populated demo district so the
 * district dashboard (apps/web-admin/app/district) renders every panel from
 * real district-scoped rows (the read model is in
 * services/admin-svc/src/routes/district-overview.ts).
 *
 * Creates "Maple Grove School District" with:
 *   - a DISTRICT_ADMIN login (district@demo.aivo / Demo123!)
 *   - 9 named schools (→ learners-by-school donut: top 5 + "Other")
 *   - ~636 learners (each with a LEARNER user; one shared parent pool user)
 *   - 3 named pilot programs spanning several schools
 *   - 90 days of district_mastery_daily (→ the learner-progress trend)
 *   - recent district_activity_log rows (→ the activity feed)
 *   - SIS connections for 6 of 9 schools (→ "3 schools not rostered" banner)
 *   - a mostly-implemented security-control set (→ compliance ≈ Excellent)
 *   - branding + admin invites (→ the 5-step setup checklist)
 *
 * Idempotent: every row uses a deterministic id (sha1 of a stable key), so
 * re-running upserts in place rather than duplicating.
 *
 * Run:  DATABASE_URL=… pnpm --filter @aivo/db db:seed:district
 */
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { createDb, closeDb } from "./index.js";
import {
  tenants,
  users,
  schools,
  learners,
  districtSettings,
  districtActivityLog,
  districtAdminInvites,
  integrationConnections,
  securityControls,
  pilotPrograms,
  pilotProgramSchools,
  districtMasteryDaily,
} from "./schema/index.js";

function det(key: string): string {
  const h = createHash("sha1").update(`aivo-district-overview:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY_MS);

const TENANT_ID = det("tenant");
const ADMIN_ID = det("admin");
const PARENT_POOL_ID = det("parent-pool");

interface SchoolDef {
  key: string;
  name: string;
  learners: number;
  rostered: boolean;
  /** Learners created within the last 30 days (KPI delta). */
  recent: number;
  /** School itself created within the last 30 days (KPI delta). */
  isNew?: boolean;
}

const SCHOOLS: SchoolDef[] = [
  { key: "maple-ridge", name: "Maple Ridge Elementary", learners: 142, rostered: true, recent: 6 },
  { key: "oakwood", name: "Oakwood Middle School", learners: 118, rostered: true, recent: 4 },
  { key: "sunset", name: "Sunset High School", learners: 96, rostered: true, recent: 3 },
  { key: "pinecrest", name: "Pinecrest Elementary", learners: 81, rostered: true, recent: 5 },
  { key: "riverside", name: "Riverside Elementary", learners: 64, rostered: true, recent: 2 },
  { key: "cedar-valley", name: "Cedar Valley Middle", learners: 48, rostered: true, recent: 3 },
  { key: "birchwood", name: "Birchwood Elementary", learners: 36, rostered: false, recent: 2 },
  { key: "hilltop", name: "Hilltop High School", learners: 29, rostered: false, recent: 1 },
  { key: "lakeside", name: "Lakeside Elementary", learners: 22, rostered: false, recent: 4, isNew: true },
];

const PILOTS = [
  {
    key: "early-literacy",
    name: "Early Literacy Accelerator",
    status: "active",
    focusArea: "Literacy",
    description: "Adaptive phonics + reading fluency pilot across elementary campuses.",
    leadSchool: "maple-ridge",
    schools: ["maple-ridge", "pinecrest", "riverside", "birchwood"],
    enrolledLearners: 248,
    startedDaysAgo: 120,
    createdDaysAgo: 120,
  },
  {
    key: "stem-pathways",
    name: "STEM Pathways Initiative",
    status: "active",
    focusArea: "STEM",
    description: "Project-based math + science cohort for middle and high school.",
    leadSchool: "oakwood",
    schools: ["oakwood", "sunset", "cedar-valley"],
    enrolledLearners: 176,
    startedDaysAgo: 64,
    createdDaysAgo: 64,
  },
  {
    key: "sel-wellbeing",
    name: "SEL & Wellbeing Program",
    status: "starting_soon",
    focusArea: "Social-Emotional",
    description: "Sensory-aware social-emotional learning rollout starting next term.",
    leadSchool: "sunset",
    schools: ["sunset", "hilltop"],
    enrolledLearners: 84,
    startedDaysAgo: -10,
    createdDaysAgo: 12,
  },
];

const ACTIVITY = [
  { key: "a1", action: "sis.sync.completed", resourceType: "integration", subtitle: "Clever • 6 schools synced", hoursAgo: 3 },
  { key: "a2", action: "admin.invited", resourceType: "user", subtitle: "Sunset High School", hoursAgo: 9 },
  { key: "a3", action: "report.generated", resourceType: "report", subtitle: "Q2 district progress report", hoursAgo: 27 },
  { key: "a4", action: "compliance.check.passed", resourceType: "compliance", subtitle: "FERPA + COPPA controls", hoursAgo: 51 },
  { key: "a5", action: "school.created", resourceType: "school", subtitle: "Lakeside Elementary", hoursAgo: 96 },
  { key: "a6", action: "branding.updated", resourceType: "settings", subtitle: "District logo + palette", hoursAgo: 140 },
];

const SECURITY_CONTROLS = [
  ["CC6.1", "Logical access controls", "implemented"],
  ["CC6.2", "User registration & deprovisioning", "implemented"],
  ["CC6.3", "Role-based access enforcement", "implemented"],
  ["CC6.6", "Encryption in transit", "implemented"],
  ["CC6.7", "Encryption at rest", "implemented"],
  ["CC7.1", "Vulnerability detection", "implemented"],
  ["CC7.2", "Security monitoring", "implemented"],
  ["CC7.3", "Incident evaluation", "implemented"],
  ["CC7.4", "Incident response", "implemented"],
  ["CC8.1", "Change management", "implemented"],
  ["AIVO-AC-01", "MFA for internal roles", "implemented"],
  ["AIVO-AC-02", "Session timeout policy", "implemented"],
  ["AIVO-DG-01", "Data retention schedule", "implemented"],
  ["AIVO-DG-02", "DSAR fulfilment", "implemented"],
  ["AIVO-PR-01", "COPPA consent capture", "implemented"],
  ["AIVO-PR-02", "FERPA disclosure log", "implemented"],
  ["AIVO-BC-01", "Backup & restore testing", "implemented"],
  ["AIVO-BC-02", "Disaster recovery plan", "implemented"],
  ["AIVO-VM-01", "Dependency scanning", "implemented"],
  ["AIVO-VM-02", "Penetration testing", "implemented"],
  ["AIVO-OB-01", "Audit log integrity", "implemented"],
  ["AIVO-OB-02", "Centralised logging", "implemented"],
  ["AIVO-AI-01", "AI safety guardrails", "implemented"],
  ["AIVO-AI-02", "Model fallback chain", "implemented"],
  ["AIVO-VM-03", "Bug bounty triage", "partial"],
];

async function chunkedInsert<T>(rows: T[], insert: (batch: T[]) => Promise<unknown>, size = 400) {
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
  }
}

async function main() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const passwordHash = await argon2.hash("Demo123!");

  // 1. District tenant.
  await db
    .insert(tenants)
    .values({
      id: TENANT_ID,
      name: "Maple Grove School District",
      type: "B2B_DISTRICT",
      licensingTier: "B2B_SEAT_LICENSED",
      seatLimit: 5000,
      status: "active",
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: { name: "Maple Grove School District", type: "B2B_DISTRICT", seatLimit: 5000 },
    });

  // 2. District admin + shared parent pool user.
  await db
    .insert(users)
    .values({
      id: ADMIN_ID,
      tenantId: TENANT_ID,
      email: "district@demo.aivo",
      passwordHash,
      name: "Dana Reyes",
      role: "DISTRICT_ADMIN",
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { passwordHash, role: "DISTRICT_ADMIN", tenantId: TENANT_ID, emailVerified: true },
    });
  await db
    .insert(users)
    .values({
      id: PARENT_POOL_ID,
      tenantId: TENANT_ID,
      name: "Maple Grove Parent Pool",
      role: "PARENT",
    })
    .onConflictDoNothing({ target: users.id });

  // 3. Schools.
  const schoolIdByKey = new Map<string, string>();
  const schoolRows = SCHOOLS.map((s, index) => {
    const id = det(`school:${s.key}`);
    schoolIdByKey.set(s.key, id);
    return {
      id,
      tenantId: TENANT_ID,
      name: s.name,
      status: "active",
      createdAt: s.isNew ? daysAgo(11) : daysAgo(220 + index),
    };
  });
  await db.insert(schools).values(schoolRows).onConflictDoNothing({ target: schools.id });

  // 4. Learners (+ one LEARNER user each).
  const learnerUserRows: Array<typeof users.$inferInsert> = [];
  const learnerRows: Array<typeof learners.$inferInsert> = [];
  for (const s of SCHOOLS) {
    const schoolId = schoolIdByKey.get(s.key)!;
    for (let i = 0; i < s.learners; i += 1) {
      const luId = det(`learner-user:${s.key}:${i}`);
      const lId = det(`learner:${s.key}:${i}`);
      const recent = i < s.recent;
      learnerUserRows.push({
        id: luId,
        tenantId: TENANT_ID,
        name: `${s.name.split(" ")[0]} Learner ${i + 1}`,
        role: "LEARNER",
      });
      learnerRows.push({
        id: lId,
        tenantId: TENANT_ID,
        userId: luId,
        parentId: PARENT_POOL_ID,
        name: `${s.name.split(" ")[0]} Learner ${i + 1}`,
        schoolId,
        createdAt: recent ? daysAgo(2 + (i % 20)) : daysAgo(150 + (i % 120)),
      });
    }
  }
  await chunkedInsert(learnerUserRows, (batch) =>
    db.insert(users).values(batch).onConflictDoNothing({ target: users.id }),
  );
  await chunkedInsert(learnerRows, (batch) =>
    db.insert(learners).values(batch).onConflictDoNothing({ target: learners.id }),
  );

  // 5. Pilot programs (+ school links).
  for (const p of PILOTS) {
    const programId = det(`pilot:${p.key}`);
    await db
      .insert(pilotPrograms)
      .values({
        id: programId,
        tenantId: TENANT_ID,
        name: p.name,
        status: p.status,
        focusArea: p.focusArea,
        description: p.description,
        leadSchoolId: schoolIdByKey.get(p.leadSchool) ?? null,
        enrolledLearners: p.enrolledLearners,
        startedAt: p.startedDaysAgo >= 0 ? daysAgo(p.startedDaysAgo) : daysAgo(p.startedDaysAgo),
        createdAt: daysAgo(p.createdDaysAgo),
      })
      .onConflictDoUpdate({
        target: pilotPrograms.id,
        set: {
          name: p.name,
          status: p.status,
          enrolledLearners: p.enrolledLearners,
          leadSchoolId: schoolIdByKey.get(p.leadSchool) ?? null,
        },
      });
    const linkRows = p.schools.map((sk) => ({
      id: det(`pilot-school:${p.key}:${sk}`),
      programId,
      schoolId: schoolIdByKey.get(sk)!,
    }));
    await db.insert(pilotProgramSchools).values(linkRows).onConflictDoNothing({
      target: pilotProgramSchools.id,
    });
  }

  // 6. 90-day learner-progress snapshot (percentages, gentle upward trend).
  const trendRows = Array.from({ length: 90 }, (_, index) => {
    const t = index / 89; // 0 → 1 oldest → newest
    const wobble = Math.sin(index / 6) * 1.6;
    const mastery = Math.round(78 + t * 10 + wobble);
    const onTrack = Math.round(70 + t * 8 + wobble);
    const atRisk = Math.round(26 - t * 6 - wobble * 0.5);
    const needsSupport = Math.round(13 - t * 5 - wobble * 0.4);
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    return {
      id: det(`mastery:${index}`),
      tenantId: TENANT_ID,
      day: daysAgo(89 - index).toISOString().slice(0, 10),
      mastery: clamp(mastery),
      onTrack: clamp(onTrack),
      atRisk: clamp(atRisk),
      needsSupport: clamp(needsSupport),
    };
  });
  await chunkedInsert(trendRows, (batch) =>
    db.insert(districtMasteryDaily).values(batch).onConflictDoUpdate({
      target: districtMasteryDaily.id,
      set: { mastery: districtMasteryDaily.mastery },
    }),
  );

  // 7. Recent activity feed.
  const activityRows = ACTIVITY.map((a) => ({
    id: det(`activity:${a.key}`),
    tenantId: TENANT_ID,
    action: a.action,
    actorId: ADMIN_ID,
    actorName: "Dana Reyes",
    resourceType: a.resourceType,
    details: { subtitle: a.subtitle },
    createdAt: new Date(now - a.hoursAgo * 60 * 60 * 1000),
  }));
  await db.insert(districtActivityLog).values(activityRows).onConflictDoNothing({
    target: districtActivityLog.id,
  });

  // 8. SIS connections (6 of 9 schools rostered → "3 schools not rostered").
  const sisRows = SCHOOLS.filter((s) => s.rostered).map((s, index) => ({
    id: det(`sis:${s.key}`),
    tenantId: TENANT_ID,
    connectorId: index % 2 === 0 ? "clever" : "classlink",
    connectorName: index % 2 === 0 ? "Clever" : "ClassLink",
    connectorType: "sis" as const,
    status: "active" as const,
    externalOrgId: schoolIdByKey.get(s.key)!,
    lastSyncAt: daysAgo(0),
    connectedAt: daysAgo(40),
  }));
  await db.insert(integrationConnections).values(sisRows).onConflictDoNothing({
    target: integrationConnections.id,
  });

  // 9. Security controls (compliance score).
  const controlRows = SECURITY_CONTROLS.map(([code, title, status]) => ({
    id: det(`control:${code}`),
    code,
    title,
    criterion: "security",
    status,
  }));
  for (const c of controlRows) {
    await db
      .insert(securityControls)
      .values(c)
      .onConflictDoUpdate({ target: securityControls.id, set: { status: c.status, title: c.title } });
  }

  // 10. Branding + admin invites (setup checklist).
  await db
    .insert(districtSettings)
    .values({
      tenantId: TENANT_ID,
      branding: { logoUrl: "/brand/maple-grove.svg", primaryColor: "#7C3AED", displayName: "Maple Grove School District" },
    })
    .onConflictDoUpdate({
      target: districtSettings.tenantId,
      set: {
        branding: { logoUrl: "/brand/maple-grove.svg", primaryColor: "#7C3AED", displayName: "Maple Grove School District" },
      },
    });

  const inviteRows = ["sunset", "oakwood", "pinecrest", "cedar-valley", "hilltop"].map((sk, index) => ({
    id: det(`invite:${sk}`),
    tenantId: TENANT_ID,
    email: `admin.${sk}@maplegrove.demo`,
    name: `${SCHOOLS.find((s) => s.key === sk)?.name ?? sk} Admin`,
    role: "SCHOOL_ADMIN",
    schoolId: schoolIdByKey.get(sk) ?? null,
    invitedBy: ADMIN_ID,
    tokenHash: det(`invite-token:${sk}`).replace(/-/g, ""),
    expiresAt: new Date(now + (14 - index) * DAY_MS),
  }));
  await db.insert(districtAdminInvites).values(inviteRows).onConflictDoNothing({
    target: districtAdminInvites.id,
  });

  const totalLearners = learnerRows.length;
  console.log("✓ District overview seed complete");
  console.log(`  tenant=${TENANT_ID} (Maple Grove School District)`);
  console.log(`  login: district@demo.aivo / Demo123!`);
  console.log(`  schools=${SCHOOLS.length}  learners=${totalLearners}  pilots=${PILOTS.length}`);
  console.log(`  sis_connected=${sisRows.length}/${SCHOOLS.length}  controls=${controlRows.length}  trend_days=${trendRows.length}`);

  await closeDb(db);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
