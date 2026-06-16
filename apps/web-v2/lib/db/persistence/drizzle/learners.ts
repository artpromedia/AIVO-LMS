/**
 * Drizzle-backed LearnerStore — learner profiles + parent/learner
 * relationships + teacher classroom reach. Mirrors the memory store
 * exactly: same isPrimary inference (a parent's first-ever relationship
 * is primary), same teacher reach (classrooms led + teacher enrollments
 * → learner enrollments), and the same cascade on delete (relationships
 * + parent assessments).
 */
import { and, count, eq, inArray, sql } from "drizzle-orm";
import {
  webLearnerProfiles,
  webParentLearnerRelationships,
  webClassrooms,
  webEnrollments,
  webParentAssessments,
  type Database,
} from "@aivo/db";
import { newId, nowIso } from "@/lib/db/store";
import type {
  Classroom,
  Enrollment,
  LearnerProfile,
  ParentLearnerRelationship,
  ReadinessState,
} from "@/lib/db/types";
import type { CreateLearnerInput, PatchLearnerInput } from "@/lib/validators/learner";
import type { LearnerStore } from "../types";
import { getDb } from "./client";

const DEFAULT_ACCESSIBILITY = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  audioFirst: false,
  captionsAlwaysOn: false,
};

async function teacherClassroomIds(teacherUserId: string, tenantId: string): Promise<Set<string>> {
  const db = getDb();
  const classroomRows = await db
    .select()
    .from(webClassrooms)
    .where(eq(webClassrooms.tenantId, tenantId));
  const ids = new Set(
    classroomRows
      .map((r) => r.data as Classroom)
      .filter((c) => c.teacherUserId === teacherUserId)
      .map((c) => c.id),
  );
  const enrollmentRows = await db
    .select()
    .from(webEnrollments)
    .where(eq(webEnrollments.tenantId, tenantId));
  const enrollments = enrollmentRows.map((r) => r.data as Enrollment);
  for (const e of enrollments) {
    if (e.role === "teacher" && e.subjectId === teacherUserId) ids.add(e.classroomId);
  }
  return ids;
}

/**
 * Ensure a parent↔learner relationship row exists (idempotent). A parent's
 * first-ever relationship is primary. Accepts the shared pool *or* an open
 * transaction (cast to `Database`) so callers can run it atomically with the
 * profile insert, and so the identity-surfacing path can self-heal a profile
 * that was created without its relationship by a prior partial failure.
 */
async function ensureParentRelationship(
  db: Database,
  parentUserId: string,
  learnerId: string,
  tenantId: string,
): Promise<void> {
  const [rel] = await db
    .select({ id: webParentLearnerRelationships.id })
    .from(webParentLearnerRelationships)
    .where(
      and(
        eq(webParentLearnerRelationships.parentUserId, parentUserId),
        eq(webParentLearnerRelationships.learnerId, learnerId),
        eq(webParentLearnerRelationships.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (rel) return;
  const [existing] = await db
    .select({ n: count() })
    .from(webParentLearnerRelationships)
    .where(eq(webParentLearnerRelationships.parentUserId, parentUserId));
  const newRel: ParentLearnerRelationship = {
    id: newId("plr"),
    parentUserId,
    learnerId,
    tenantId,
    relation: "parent",
    isPrimary: Number(existing?.n ?? 0) === 0,
  };
  await db.insert(webParentLearnerRelationships).values({
    id: newRel.id,
    parentUserId,
    learnerId,
    tenantId,
    data: newRel,
  });
}

export const drizzleLearners: LearnerStore = {
  async getById(id, tenantId) {
    const [row] = await getDb()
      .select()
      .from(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.id, id), eq(webLearnerProfiles.tenantId, tenantId)))
      .limit(1);
    return row ? (row.data as LearnerProfile) : null;
  },

  async listForParent(parentUserId, tenantId) {
    const db = getDb();
    const rels = await db
      .select()
      .from(webParentLearnerRelationships)
      .where(
        and(
          eq(webParentLearnerRelationships.parentUserId, parentUserId),
          eq(webParentLearnerRelationships.tenantId, tenantId),
        ),
      );
    const ids = [...new Set(rels.map((r) => r.learnerId))];
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.tenantId, tenantId), inArray(webLearnerProfiles.id, ids)));
    return rows.map((r) => r.data as LearnerProfile);
  },

  async listForTeacher(teacherUserId, tenantId) {
    const classroomIds = await teacherClassroomIds(teacherUserId, tenantId);
    if (classroomIds.size === 0) return [];
    const db = getDb();
    const enrollmentRows = await db
      .select()
      .from(webEnrollments)
      .where(eq(webEnrollments.tenantId, tenantId));
    const learnerIds = new Set<string>();
    for (const r of enrollmentRows) {
      const e = r.data as Enrollment;
      if (e.role === "learner" && classroomIds.has(e.classroomId)) learnerIds.add(e.subjectId);
    }
    if (learnerIds.size === 0) return [];
    const rows = await db
      .select()
      .from(webLearnerProfiles)
      .where(
        and(
          eq(webLearnerProfiles.tenantId, tenantId),
          inArray(webLearnerProfiles.id, [...learnerIds]),
        ),
      );
    return rows.map((r) => r.data as LearnerProfile);
  },

  async listForTenants(tenantIds) {
    if (tenantIds.length === 0) return [];
    const rows = await getDb()
      .select()
      .from(webLearnerProfiles)
      .where(inArray(webLearnerProfiles.tenantId, tenantIds));
    return rows.map((r) => r.data as LearnerProfile);
  },

  async parentCanAccess(parentUserId, learnerId, tenantId) {
    const [row] = await getDb()
      .select({ n: count() })
      .from(webParentLearnerRelationships)
      .where(
        and(
          eq(webParentLearnerRelationships.parentUserId, parentUserId),
          eq(webParentLearnerRelationships.learnerId, learnerId),
          eq(webParentLearnerRelationships.tenantId, tenantId),
        ),
      );
    return Number(row?.n ?? 0) > 0;
  },

  async teacherCanAccess(teacherUserId, learnerId, tenantId) {
    const learners = await this.listForTeacher(teacherUserId, tenantId);
    return learners.some((l) => l.id === learnerId);
  },

  async findPrimaryParent(learnerId, tenantId) {
    const rels = await getDb()
      .select()
      .from(webParentLearnerRelationships)
      .where(
        and(
          eq(webParentLearnerRelationships.learnerId, learnerId),
          eq(webParentLearnerRelationships.tenantId, tenantId),
        ),
      )
      .orderBy(webParentLearnerRelationships.seq);
    if (rels.length === 0) return null;
    const data = rels.map((r) => r.data as ParentLearnerRelationship);
    return (data.find((r) => r.isPrimary) ?? data[0]!).parentUserId;
  },

  async create({ tenantId, parentUserId, data }) {
    const db = getDb();
    const id = newId("lrn");
    const d: CreateLearnerInput = data;
    const display = d.preferredName?.trim() || d.firstName.trim();
    const learner: LearnerProfile = {
      id,
      tenantId,
      displayName: display,
      firstName: d.firstName.trim(),
      preferredName: d.preferredName?.trim() || null,
      birthYear: d.birthYear,
      pronouns: d.pronouns ?? undefined,
      ageRange: d.ageRange ?? null,
      gradeBand: d.gradeBand ?? null,
      schoolContext: d.schoolContext ?? null,
      primaryLanguage: d.primaryLanguage ?? null,
      readingComfort: d.readingComfort ?? null,
      mathComfort: d.mathComfort ?? null,
      knownStrengths: d.knownStrengths ?? [],
      knownChallenges: d.knownChallenges ?? [],
      accessibilityDefaults: { ...DEFAULT_ACCESSIBILITY, ...(d.accessibilityDefaults ?? {}) },
      zipCode: d.zipCode ?? null,
      districtId: d.districtId ?? null,
      districtName: d.districtName ?? null,
      functioningLevel: null,
      readinessState: "profile_created",
      iepDecision: null,
      createdAt: nowIso(),
    };
    await db.insert(webLearnerProfiles).values({ id, tenantId, data: learner });

    const [existing] = await db
      .select({ n: count() })
      .from(webParentLearnerRelationships)
      .where(eq(webParentLearnerRelationships.parentUserId, parentUserId));
    const rel: ParentLearnerRelationship = {
      id: newId("plr"),
      parentUserId,
      learnerId: id,
      tenantId,
      relation: "parent",
      isPrimary: Number(existing?.n ?? 0) === 0,
    };
    await db.insert(webParentLearnerRelationships).values({
      id: rel.id,
      parentUserId,
      learnerId: id,
      tenantId,
      data: rel,
    });
    return learner;
  },

  async setIdentityLink(id, tenantId, identityLearnerId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.id, id), eq(webLearnerProfiles.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    const existing = row.data as LearnerProfile;
    if (existing.identityLearnerId === identityLearnerId) return existing;
    const next: LearnerProfile = { ...existing, identityLearnerId };
    await db.update(webLearnerProfiles).set({ data: next }).where(eq(webLearnerProfiles.id, id));
    return next;
  },

  async createFromIdentity({
    tenantId,
    parentUserId,
    identityLearnerId,
    name,
    birthYear,
    gradeBand,
    primaryLanguage,
  }) {
    const db = getDb();
    // Idempotency (Task #34): never materialize a second web profile for the
    // same canonical identity learner — return the existing link if present.
    // A partial unique index on (tenant_id, data->>'identityLearnerId') also
    // guards against truly-concurrent reconciles at the DB layer.
    const [linked] = await db
      .select()
      .from(webLearnerProfiles)
      .where(
        and(
          eq(webLearnerProfiles.tenantId, tenantId),
          eq(sql`${webLearnerProfiles.data}->>'identityLearnerId'`, identityLearnerId),
        ),
      )
      .limit(1);
    if (linked) {
      // Self-heal partial failures: a prior attempt may have inserted the
      // profile but failed before writing the parent relationship (the two were
      // not atomic historically). Without this, the idempotency short-circuit
      // would leave the canonical learner permanently invisible in the parent's
      // web list. Also covers a co-guardian reconciling a learner first linked
      // by another parent. Ensure the relationship exists for this parent.
      await ensureParentRelationship(db, parentUserId, linked.id, tenantId);
      return linked.data as LearnerProfile;
    }

    const id = newId("lrn");
    const display = name.trim() || "Learner";
    const learner: LearnerProfile = {
      id,
      tenantId,
      displayName: display,
      firstName: display,
      preferredName: null,
      birthYear,
      ageRange: null,
      gradeBand: gradeBand ?? null,
      schoolContext: null,
      primaryLanguage: primaryLanguage ?? null,
      readingComfort: null,
      mathComfort: null,
      knownStrengths: [],
      knownChallenges: [],
      accessibilityDefaults: { ...DEFAULT_ACCESSIBILITY },
      zipCode: null,
      districtId: null,
      districtName: null,
      functioningLevel: null,
      readinessState: "profile_created",
      iepDecision: null,
      identityLearnerId,
      createdAt: nowIso(),
    };
    // Atomic: the profile and its parent relationship must both land, or
    // neither. A failure between the two inserts would otherwise orphan the
    // profile (linked but with no relationship → invisible to the parent, and
    // the idempotency short-circuit would keep returning it on retry).
    await db.transaction(async (tx) => {
      await tx.insert(webLearnerProfiles).values({ id, tenantId, data: learner });
      await ensureParentRelationship(tx as unknown as Database, parentUserId, id, tenantId);
    });
    return learner;
  },

  async update(id, tenantId, patch) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.id, id), eq(webLearnerProfiles.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    const existing = row.data as LearnerProfile;
    const p: PatchLearnerInput = patch;
    const next: LearnerProfile = {
      ...existing,
      firstName: p.firstName ?? existing.firstName,
      preferredName:
        p.preferredName === undefined ? existing.preferredName : p.preferredName?.trim() || null,
      birthYear: p.birthYear ?? existing.birthYear,
      pronouns: p.pronouns === undefined ? existing.pronouns : (p.pronouns ?? undefined),
      ageRange: p.ageRange === undefined ? existing.ageRange : (p.ageRange ?? null),
      gradeBand: p.gradeBand === undefined ? existing.gradeBand : (p.gradeBand ?? null),
      schoolContext:
        p.schoolContext === undefined ? existing.schoolContext : (p.schoolContext ?? null),
      primaryLanguage:
        p.primaryLanguage === undefined ? existing.primaryLanguage : (p.primaryLanguage ?? null),
      readingComfort:
        p.readingComfort === undefined ? existing.readingComfort : (p.readingComfort ?? null),
      mathComfort: p.mathComfort === undefined ? existing.mathComfort : (p.mathComfort ?? null),
      knownStrengths: p.knownStrengths ?? existing.knownStrengths,
      knownChallenges: p.knownChallenges ?? existing.knownChallenges,
      accessibilityDefaults: p.accessibilityDefaults
        ? { ...existing.accessibilityDefaults, ...p.accessibilityDefaults }
        : existing.accessibilityDefaults,
      zipCode: p.zipCode === undefined ? existing.zipCode : (p.zipCode ?? null),
      districtId: p.districtId === undefined ? existing.districtId : (p.districtId ?? null),
      districtName: p.districtName === undefined ? existing.districtName : (p.districtName ?? null),
    };
    next.displayName = next.preferredName?.trim() || next.firstName.trim();
    await db.update(webLearnerProfiles).set({ data: next }).where(eq(webLearnerProfiles.id, id));
    return next;
  },

  async delete(id, tenantId) {
    const db = getDb();
    const deleted = await db
      .delete(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.id, id), eq(webLearnerProfiles.tenantId, tenantId)))
      .returning({ id: webLearnerProfiles.id });
    if (deleted.length === 0) return false;
    await db
      .delete(webParentLearnerRelationships)
      .where(eq(webParentLearnerRelationships.learnerId, id));
    await db.delete(webParentAssessments).where(eq(webParentAssessments.learnerId, id));
    return true;
  },

  async setReadinessState(id, tenantId, state: ReadinessState) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.id, id), eq(webLearnerProfiles.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    const existing = row.data as LearnerProfile;
    if (state === existing.readinessState) return existing;
    const next: LearnerProfile = { ...existing, readinessState: state };
    await db.update(webLearnerProfiles).set({ data: next }).where(eq(webLearnerProfiles.id, id));
    return next;
  },

  async setTeamInviteDecision(id, tenantId, decision) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.id, id), eq(webLearnerProfiles.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    const existing = row.data as LearnerProfile;
    if (decision === existing.teamInviteDecision) return existing;
    const next: LearnerProfile = { ...existing, teamInviteDecision: decision };
    await db.update(webLearnerProfiles).set({ data: next }).where(eq(webLearnerProfiles.id, id));
    return next;
  },

  async getAccessibility(id, tenantId) {
    const [row] = await getDb()
      .select()
      .from(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.id, id), eq(webLearnerProfiles.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    return (row.data as LearnerProfile).accessibilityPreferences ?? null;
  },

  async setAccessibility(id, tenantId, prefs) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(webLearnerProfiles)
      .where(and(eq(webLearnerProfiles.id, id), eq(webLearnerProfiles.tenantId, tenantId)))
      .limit(1);
    if (!row) return null;
    const existing = row.data as LearnerProfile;
    const next: LearnerProfile = { ...existing, accessibilityPreferences: prefs ?? undefined };
    await db.update(webLearnerProfiles).set({ data: next }).where(eq(webLearnerProfiles.id, id));
    return next.accessibilityPreferences ?? null;
  },
};
