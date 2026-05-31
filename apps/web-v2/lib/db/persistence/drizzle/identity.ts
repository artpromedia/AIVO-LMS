/**
 * Drizzle-backed IdentityStore — users + tenant memberships
 * (web_users, web_memberships). Mirrors the memory store: staff users
 * carry a tenant_id (regular users don't), display-name sort on
 * listUsersForTenants, createdAt-desc membership list, and the
 * tenant-scoped staff removal guard.
 */
import { and, eq, inArray } from "drizzle-orm";
import { webUsers, webMemberships } from "@aivo/db";
import { newId, nowIso } from "@/lib/db/store";
import type { TenantMembership, User } from "@/lib/db/types";
import type { Role } from "@/lib/auth/types";
import type { IdentityStore, StaffUserRecord, StaffUserRole, UserSummary } from "../types";
import { getDb } from "./client";

const STAFF_ROLE_MAP: Record<StaffUserRole, Role> = {
  TEACHER: "teacher",
  SCHOOL_ADMIN: "school_admin",
  THERAPIST: "therapist",
  CAREGIVER: "caregiver",
};

export const drizzleIdentity: IdentityStore = {
  async getUserById(id) {
    const [row] = await getDb().select().from(webUsers).where(eq(webUsers.id, id)).limit(1);
    return row ? (row.data as User) : null;
  },

  async listUsersForTenants(tenantIds) {
    if (tenantIds.length === 0) return [];
    const db = getDb();
    const memberRows = await db
      .select()
      .from(webMemberships)
      .where(inArray(webMemberships.tenantId, tenantIds));
    const userIds = [...new Set(memberRows.map((m) => m.userId))];
    if (userIds.length === 0) return [];
    const userRows = await db.select().from(webUsers).where(inArray(webUsers.id, userIds));
    const usersById = new Map(userRows.map((u) => [u.id, u.data as User]));
    const out: UserSummary[] = [];
    for (const m of memberRows) {
      const membership = m.data as TenantMembership;
      const user = usersById.get(m.userId);
      if (!user) continue;
      out.push({
        user,
        tenantId: membership.tenantId,
        role: membership.role,
        joinedAt: membership.createdAt,
      });
    }
    out.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
    return out;
  },

  async listMembershipsForUser(userId) {
    const rows = await getDb()
      .select()
      .from(webMemberships)
      .where(eq(webMemberships.userId, userId));
    return rows
      .map((r) => r.data as TenantMembership)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async updateUserDisplayName(userId, displayName) {
    const db = getDb();
    const [row] = await db.select().from(webUsers).where(eq(webUsers.id, userId)).limit(1);
    if (!row) return null;
    const next: User = { ...(row.data as User), displayName };
    await db.update(webUsers).set({ data: next }).where(eq(webUsers.id, userId));
    return next;
  },

  async addStaffUser(input) {
    const db = getDb();
    const id = newId("user");
    const createdAt = nowIso();
    const rec: StaffUserRecord = {
      id,
      tenantId: input.tenantId,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: "INVITED",
      createdAt,
    };
    await db.insert(webUsers).values({
      id,
      tenantId: input.tenantId,
      data: rec as unknown as User,
    });
    const membership: TenantMembership = {
      userId: id,
      tenantId: input.tenantId,
      role: STAFF_ROLE_MAP[input.role],
      permissions: [],
      createdAt,
    };
    await db.insert(webMemberships).values({
      userId: id,
      tenantId: input.tenantId,
      createdAt,
      data: membership,
    });
    return rec;
  },

  async removeStaffUser(userId, tenantId) {
    const deleted = await getDb()
      .delete(webUsers)
      .where(and(eq(webUsers.id, userId), eq(webUsers.tenantId, tenantId)))
      .returning({ id: webUsers.id });
    return deleted.length > 0;
  },
};
