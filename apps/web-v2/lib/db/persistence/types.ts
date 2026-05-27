/**
 * Persistence adapter — domain-store interfaces.
 *
 * Each per-domain store is a small surface that a `lib/db/repos.ts`
 * function can call instead of reaching into `getStore()` directly.
 * The same interface has two implementations:
 *
 *   - `MemoryAdapter` wraps the existing `Map` store (default).
 *   - `DrizzleAdapter` talks to Postgres via `packages/db`.
 *
 * See `docs/adr/0007-web-v2-persistence-migration.md` for the
 * decision record + migration order.
 */
import type {
  AuditLog,
  Notification,
  NotificationDelivery,
  TenantMembership,
  User,
} from "@/lib/db/types";
import type { Role } from "@/lib/auth/types";

export type PersistenceMode = "memory" | "postgres";

/**
 * Per-domain stores. The full `Persistence` interface aggregates one
 * field per migrated domain. Domains we haven't migrated yet keep
 * using `getStore()` directly — the adapter is opt-in per domain.
 */
export interface NotificationStore {
  /** List notifications for a (userId, tenantId), most recent first. */
  list(opts: {
    tenantId: string;
    userId: string;
    unreadOnly?: boolean;
  }): Promise<Notification[]>;
  /** Mark up to N notifications read. Returns the count that flipped. */
  markRead(opts: {
    tenantId: string;
    userId: string;
    ids: string[];
  }): Promise<number>;
  /** Persist a new notification + the per-channel delivery rows. */
  create(input: {
    notification: Notification;
    deliveries: NotificationDelivery[];
  }): Promise<{ notification: Notification; deliveries: NotificationDelivery[] }>;
  /** Inspect the delivery rows for a notification (debug/observability). */
  listDeliveries(notificationId: string): Promise<NotificationDelivery[]>;
}

/**
 * Append-only audit log. Reads are tenant-scoped; writes never delete
 * or rewrite (the `AuditLog` table is the canonical source for
 * compliance review).
 */
export interface AuditStore {
  append(entry: AuditLog): Promise<AuditLog>;
  recentForTenant(tenantId: string, limit: number): Promise<AuditLog[]>;
  recentForTenants(tenantIds: string[], limit: number): Promise<AuditLog[]>;
}

/**
 * Identity domain — users + tenant memberships. Sessions live in the
 * mock-session cookie + (eventually) `services/identity-svc` and are
 * deliberately out of scope for this store.
 */
export type StaffUserRole = "TEACHER" | "SCHOOL_ADMIN" | "THERAPIST" | "CAREGIVER";

export interface StaffUserRecord {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: StaffUserRole;
  status: "INVITED";
  createdAt: string;
}

export interface UserSummary {
  user: User;
  tenantId: string;
  role: Role;
  joinedAt: string;
}

export interface IdentityStore {
  getUserById(id: string): Promise<User | null>;
  listUsersForTenants(tenantIds: string[]): Promise<UserSummary[]>;
  listMembershipsForUser(userId: string): Promise<TenantMembership[]>;
  updateUserDisplayName(userId: string, displayName: string): Promise<User | null>;
  /**
   * Add a "INVITED" staff user with a default tenant membership.
   * Idempotency / re-invite semantics are caller-controlled; the
   * store does no dedupe on email.
   */
  addStaffUser(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role: StaffUserRole;
  }): Promise<StaffUserRecord>;
  /** Hard delete; returns false if the user isn't in this tenant. */
  removeStaffUser(userId: string, tenantId: string): Promise<boolean>;
}

export interface Persistence {
  mode: PersistenceMode;
  notifications: NotificationStore;
  audit: AuditStore;
  identity: IdentityStore;
  /**
   * Future domains land here. Each new domain ships:
   *   1. An interface in this file.
   *   2. A memory impl in `./memory/<domain>.ts`.
   *   3. A drizzle impl in `./drizzle/<domain>.ts`.
   *   4. A line in `Persistence` aggregating it.
   *   5. A line in `index.ts` `getPersistence` resolving the per-domain
   *      mode and constructing the chosen impl.
   * The migration order is fixed by ADR 0007.
   */
}
