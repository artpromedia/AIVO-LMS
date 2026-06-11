/**
 * Roster-apply core (Sprint B5).
 *
 * ONE module owns user-provisioning semantics so every roster producer —
 * SCIM (/scim/v2/*), the SIS pipeline's writer (/internal/roster/*), and
 * any future importer — converges on identical behavior:
 *
 *   - upsert by (tenantId, externalId) first, then (tenantId, email);
 *   - PLATFORM_ADMIN can never be created, assigned, or modified;
 *   - deactivation is a soft-delete (deactivatedAt) — never a hard delete;
 *   - role values are restricted to the provisionable set.
 *
 * Class-group mapping (IdP push groups → classrooms) lives here too, with
 * the explicit rule that a group which doesn't match the documented
 * convention is RECORDED for review (scim_unmapped_groups) — skipped,
 * never silently dropped.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  users,
  schools,
  classrooms,
  staffAssignments,
  scimUnmappedGroups,
} from "@aivo/db";

export const PROVISIONABLE_ROLES = new Set([
  "DISTRICT_ADMIN",
  "TEACHER",
  "CAREGIVER",
  "THERAPIST",
]);

/** OneRoster role → AIVO role. Students are NOT users (learners roster separately). */
export const ONEROSTER_ROLE_MAP: Record<string, string> = {
  administrator: "DISTRICT_ADMIN",
  teacher: "TEACHER",
  parent: "CAREGIVER",
  guardian: "CAREGIVER",
  relative: "CAREGIVER",
  aide: "THERAPIST",
};

export interface RosterUserInput {
  tenantId: string;
  email: string;
  name: string;
  role: string;
  externalId?: string | null;
  /** Which producer applied this ("scim" | "sis" | "csv"). */
  provisionedBy: string;
}

export interface RosterApplyError {
  status: number;
  code: string;
  message: string;
}

export type RosterUserResult =
  | { ok: true; user: any; created: boolean }
  | { ok: false; error: RosterApplyError };

function refuse(status: number, code: string, message: string): RosterUserResult {
  return { ok: false, error: { status, code, message } };
}

/** Create-or-update a tenant user. The single write path for all producers. */
export async function applyUserUpsert(db: any, input: RosterUserInput): Promise<RosterUserResult> {
  const email = input.email?.toLowerCase().trim();
  if (!email) return refuse(400, "invalidValue", "email is required");
  const role = input.role;
  if (role === "PLATFORM_ADMIN") {
    return refuse(403, "noTarget", "PLATFORM_ADMIN cannot be provisioned via rostering");
  }
  if (!PROVISIONABLE_ROLES.has(role)) {
    return refuse(400, "invalidValue", `Role ${role} is not provisionable via rostering`);
  }

  // externalId is the IdP/SIS-stable key; email is the fallback so a
  // re-keyed connection adopts existing accounts instead of duplicating.
  let existing: any | undefined;
  if (input.externalId) {
    [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, input.tenantId), eq(users.externalId, input.externalId)))
      .limit(1);
  }
  if (!existing) {
    [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, input.tenantId), eq(users.email, email)))
      .limit(1);
  }

  if (existing) {
    if (existing.role === "PLATFORM_ADMIN") {
      return refuse(403, "noTarget", "PLATFORM_ADMIN cannot be modified via rostering");
    }
    const [updated] = await db
      .update(users)
      .set({
        email,
        name: input.name || existing.name,
        role,
        externalId: input.externalId ?? existing.externalId,
        // A re-provisioned (previously deactivated) user reactivates —
        // the IdP asserting the user exists is the source of truth.
        deactivatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return { ok: true, user: updated, created: false };
  }

  const [created] = await db
    .insert(users)
    .values({
      tenantId: input.tenantId,
      email,
      name: input.name || email.split("@")[0],
      role,
      emailVerified: true,
      provisionedBy: input.provisionedBy,
      externalId: input.externalId ?? null,
    } as any)
    .returning();
  return { ok: true, user: created, created: true };
}

export interface RosterDeactivateInput {
  tenantId: string;
  /** Any one of these identifies the user. */
  userId?: string;
  externalId?: string;
  email?: string;
}

/** Soft-deactivate (never delete). Idempotent. */
export async function applyUserDeactivate(
  db: any,
  input: RosterDeactivateInput,
): Promise<RosterUserResult> {
  let row: any | undefined;
  if (input.userId) {
    [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.tenantId, input.tenantId)))
      .limit(1);
  } else if (input.externalId) {
    [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, input.tenantId), eq(users.externalId, input.externalId)))
      .limit(1);
  } else if (input.email) {
    [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, input.tenantId), eq(users.email, input.email.toLowerCase())))
      .limit(1);
  }
  if (!row) return refuse(404, "noTarget", "User not found");
  if (row.role === "PLATFORM_ADMIN") {
    return refuse(403, "noTarget", "PLATFORM_ADMIN cannot be deactivated via rostering");
  }
  if (row.deactivatedAt) return { ok: true, user: row, created: false };
  const [updated] = await db
    .update(users)
    .set({ deactivatedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, row.id))
    .returning();
  return { ok: true, user: updated, created: false };
}

// ── Class-group mapping ──────────────────────────────────────────────────
// Convention (documented in docs/integrations/scim-runbook.md): a pushed
// group maps to a classroom when its displayName is
//
//   Class: <School Name> / <Class Name>
//
// e.g. "Class: Lincoln Elementary / Grade 3 – Room B". The school name
// must match an existing school in the tenant exactly (case-insensitive).
// Anything else is recorded as unmapped and skipped.

export interface ParsedClassGroup {
  schoolName: string;
  className: string;
}

export function parseClassGroupName(displayName: string): ParsedClassGroup | null {
  const m = /^class:\s*(.+?)\s*\/\s*(.+)$/i.exec(displayName?.trim() ?? "");
  if (!m) return null;
  const schoolName = m[1].trim();
  const className = m[2].trim();
  if (!schoolName || !className) return null;
  return { schoolName, className };
}

export type ClassGroupResult =
  | { ok: true; classroom: any; school: any; created: boolean }
  | { ok: false; reason: "not_class_convention" | "unknown_school" };

/** Create-or-match the classroom a conventional class group names. */
export async function applyClassGroupMapping(
  db: any,
  tenantId: string,
  displayName: string,
): Promise<ClassGroupResult> {
  const parsed = parseClassGroupName(displayName);
  if (!parsed) return { ok: false, reason: "not_class_convention" };

  const [school] = await db
    .select()
    .from(schools)
    .where(
      and(eq(schools.tenantId, tenantId), sql`LOWER(${schools.name}) = ${parsed.schoolName.toLowerCase()}`),
    )
    .limit(1);
  if (!school) return { ok: false, reason: "unknown_school" };

  const [existing] = await db
    .select()
    .from(classrooms)
    .where(
      and(
        eq(classrooms.schoolId, school.id),
        sql`LOWER(${classrooms.name}) = ${parsed.className.toLowerCase()}`,
      ),
    )
    .limit(1);
  if (existing) return { ok: true, classroom: existing, school, created: false };

  const [created] = await db
    .insert(classrooms)
    .values({ schoolId: school.id, name: parsed.className })
    .returning();
  return { ok: true, classroom: created, school, created: true };
}

/**
 * Sync a class group's TEACHER membership: the first member becomes the
 * classroom's teacher of record; every member gets a staff assignment at
 * the school. Members must be existing, active tenant users — unknown
 * ids are returned (the SCIM layer reports them) rather than guessed at.
 */
export async function applyClassGroupMembers(
  db: any,
  tenantId: string,
  classroom: any,
  schoolId: string,
  memberUserIds: string[],
): Promise<{ applied: string[]; unknown: string[] }> {
  const applied: string[] = [];
  const unknown: string[] = [];
  let teacherSet = false;

  for (const userId of memberUserIds) {
    const [u] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId), isNull(users.deactivatedAt)))
      .limit(1);
    if (!u) {
      unknown.push(userId);
      continue;
    }
    if (!teacherSet) {
      await db
        .update(classrooms)
        .set({ teacherId: u.id })
        .where(eq(classrooms.id, classroom.id));
      teacherSet = true;
    }
    const [assignment] = await db
      .select()
      .from(staffAssignments)
      .where(and(eq(staffAssignments.userId, u.id), eq(staffAssignments.schoolId, schoolId)))
      .limit(1);
    if (assignment) {
      if (assignment.removedAt) {
        await db
          .update(staffAssignments)
          .set({ removedAt: null, assignedAt: new Date() })
          .where(eq(staffAssignments.id, assignment.id));
      }
    } else {
      await db.insert(staffAssignments).values({
        userId: u.id,
        schoolId,
        roleAtSchool: u.role,
      });
    }
    applied.push(u.id);
  }
  return { applied, unknown };
}

/** Remove a member: clear teacher-of-record if it was them; end the staff assignment. */
export async function removeClassGroupMember(
  db: any,
  tenantId: string,
  classroom: any,
  schoolId: string,
  userId: string,
): Promise<void> {
  const [u] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);
  if (!u) return;
  if (classroom.teacherId === userId) {
    await db.update(classrooms).set({ teacherId: null }).where(eq(classrooms.id, classroom.id));
  }
  await db
    .update(staffAssignments)
    .set({ removedAt: new Date() })
    .where(and(eq(staffAssignments.userId, userId), eq(staffAssignments.schoolId, schoolId)));
}

/** Record an unmapped group push (upsert on tenant+displayName, bump seen). */
export async function recordUnmappedGroup(
  db: any,
  tenantId: string,
  displayName: string,
  reason: string,
  opts: { externalId?: string | null; memberCount?: number } = {},
): Promise<void> {
  await db
    .insert(scimUnmappedGroups)
    .values({
      tenantId,
      displayName: displayName.slice(0, 512),
      externalId: opts.externalId ?? null,
      reason,
      memberCount: opts.memberCount ?? 0,
    })
    .onConflictDoUpdate({
      target: [scimUnmappedGroups.tenantId, scimUnmappedGroups.displayName],
      set: {
        lastSeenAt: new Date(),
        seenCount: sql`${scimUnmappedGroups.seenCount} + 1`,
        reason,
        memberCount: opts.memberCount ?? 0,
        externalId: opts.externalId ?? null,
        resolvedAt: null,
      },
    });
}
