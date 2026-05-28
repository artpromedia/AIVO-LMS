/**
 * Drizzle-backed NotificationStore — stub.
 *
 * Selected when AIVO_PERSISTENCE_NOTIFICATIONS=postgres. Currently
 * throws on every call: the production Drizzle wiring needs:
 *
 *   1. A `notifications` + `notification_deliveries` table in
 *      `packages/db/src/schema/comms.ts` (does not yet exist; the
 *      schema there only covers contact submissions + email outbox).
 *   2. A Drizzle client constructed from `serverEnv.DATABASE_URL`.
 *   3. A migration generated via `pnpm --filter @aivo/db db:push`.
 *
 * The interface is finalised so the implementation is a self-contained
 * follow-up (no callers change). See ADR 0007 for the migration
 * sequence.
 */
import type { NotificationStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.notifications.${method}] not implemented. ` +
      `Set AIVO_PERSISTENCE_NOTIFICATIONS=memory or land the notifications ` +
      `schema in packages/db before flipping this flag on.`,
  );
}

export const drizzleNotifications: NotificationStore = {
  async list() {
    return notImplemented("list");
  },
  async markRead() {
    return notImplemented("markRead");
  },
  async create() {
    return notImplemented("create");
  },
  async listDeliveries() {
    return notImplemented("listDeliveries");
  },
};
