/**
 * In-memory IdentityStore — wraps the existing users Map + memberships
 * array. Default impl; selected when AIVO_PERSISTENCE_IDENTITY=memory.
 *
 * Sessions are not represented here — the mock-session cookie owns
 * dev sessions and `services/identity-svc` owns production sessions
 * (see ADR 0009).
 */
import { getStore, newId, nowIso } from "@/lib/db/store";
import type { TenantMembership, User } from "@/lib/db/types";
import type { Role } from "@/lib/auth/types";
import type { IdentityStore, StaffUserRecord, StaffUserRole, UserSummary } from "../types";

const STAFF_ROLE_MAP: Record<StaffUserRole, Role> = {
  TEACHER: "teacher",
  SCHOOL_ADMIN: "school_admin",
  THERAPIST: "therapist",
  CAREGIVER: "caregiver",
};

export const memoryIdentity: IdentityStore = {
  async getUserById(id) {
    return getStore().users.get(id) ?? null;
  },
  async listUsersForTenants(tenantIds) {
    const ids = new Set(tenantIds);
    const store = getStore();
    const rows: UserSummary[] = [];
    for (const m of store.memberships) {
      if (!ids.has(m.tenantId)) continue;
      const u = store.users.get(m.userId);
      if (!u) continue;
      rows.push({
        user: u,
        tenantId: m.tenantId,
        role: m.role,
        joinedAt: m.createdAt,
      });
    }
    rows.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
    return rows;
  },
  async listMembershipsForUser(userId) {
    return getStore()
      .memberships.filter((m) => m.userId === userId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async updateUserDisplayName(userId, displayName) {
    const store = getStore();
    const u = store.users.get(userId);
    if (!u) return null;
    const next: User = { ...u, displayName };
    store.users.set(userId, next);
    return next;
  },
  async addStaffUser(input) {
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
    const store = getStore();
    // The legacy `users` Map carries `User`, not `StaffUserRecord`.
    // Cast — the BFF route immediately re-reads the row as a staff
    // record, and the existing shape leaks `tenantId` + `status`
    // that aren't on User. Preserves the prior behaviour exactly so
    // the migration is observable to callers as a no-op.
    store.users.set(id, rec as unknown as User);
    const membership: TenantMembership = {
      userId: id,
      tenantId: input.tenantId,
      role: STAFF_ROLE_MAP[input.role],
      permissions: [],
      createdAt,
    };
    store.memberships.push(membership);
    return rec;
  },
  async removeStaffUser(userId, tenantId) {
    const store = getStore();
    const u = store.users.get(userId) as { tenantId?: string } | undefined;
    if (!u || u.tenantId !== tenantId) return false;
    store.users.delete(userId);
    return true;
  },
};
