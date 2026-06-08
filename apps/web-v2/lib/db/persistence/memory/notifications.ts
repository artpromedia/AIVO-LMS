/**
 * In-memory NotificationStore — wraps the existing `Map`-backed store
 * with the persistence-adapter interface so callers can be migrated
 * without changing semantics. This is the default implementation
 * (selected when AIVO_PERSISTENCE_NOTIFICATIONS=memory).
 */
import { getStore, nowIso } from "@/lib/db/store";
import type {
  NotificationDelivery,
  NotificationPreference,
  DigestSchedule,
} from "@/lib/db/types";
import type { NotificationStore } from "../types";

export const memoryNotifications: NotificationStore = {
  async list({ tenantId, userId, unreadOnly }) {
    let arr = Array.from(getStore().notifications.values()).filter(
      (n) => n.tenantId === tenantId && n.userId === userId,
    );
    if (unreadOnly) arr = arr.filter((n) => n.readAt === null);
    return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async markRead({ tenantId, userId, ids }) {
    let count = 0;
    const store = getStore();
    for (const id of ids) {
      const n = store.notifications.get(id);
      if (n && n.userId === userId && n.tenantId === tenantId && n.readAt === null) {
        n.readAt = nowIso();
        count += 1;
      }
    }
    return count;
  },
  async create({ notification, deliveries }) {
    const store = getStore();
    store.notifications.set(notification.id, notification);
    for (const d of deliveries) {
      store.notificationDeliveries.set(d.id, d);
    }
    return { notification, deliveries };
  },
  async listDeliveries(notificationId) {
    const out: NotificationDelivery[] = [];
    for (const d of getStore().notificationDeliveries.values()) {
      if (d.notificationId === notificationId) out.push(d);
    }
    return out;
  },

  async getPreference(userId): Promise<NotificationPreference | null> {
    return getStore().notificationPreferences.get(userId) ?? null;
  },
  async upsertPreference(pref): Promise<NotificationPreference> {
    getStore().notificationPreferences.set(pref.userId, pref);
    return pref;
  },
  async listDigestSchedules(): Promise<DigestSchedule[]> {
    return Array.from(getStore().digestSchedules.values());
  },
};
