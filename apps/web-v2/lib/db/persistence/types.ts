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
import type { Notification, NotificationDelivery } from "@/lib/db/types";

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

export interface Persistence {
  mode: PersistenceMode;
  notifications: NotificationStore;
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
