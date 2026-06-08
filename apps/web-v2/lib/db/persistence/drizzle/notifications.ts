/**
 * Drizzle-backed NotificationStore (web_notifications +
 * web_notification_deliveries). Mirrors the memory store: list is
 * newest-first and tenant+user scoped; markRead only flips unread rows
 * and returns the count; readAt is authoritative on the column so
 * reconstructed objects always reflect the latest state.
 */
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  webNotifications,
  webNotificationDeliveries,
  webNotificationPreferences,
  webDigestSchedules,
} from "@aivo/db";
import { nowIso } from "@/lib/db/store";
import type {
  Notification,
  NotificationDelivery,
  NotificationPreference,
  DigestSchedule,
} from "@/lib/db/types";
import type { NotificationStore } from "../types";
import { getDb } from "./client";

function toNotification(row: typeof webNotifications.$inferSelect): Notification {
  return { ...(row.data as Notification), readAt: row.readAt };
}

export const drizzleNotifications: NotificationStore = {
  async list({ tenantId, userId, unreadOnly }) {
    const db = getDb();
    const where = unreadOnly
      ? and(
          eq(webNotifications.tenantId, tenantId),
          eq(webNotifications.userId, userId),
          isNull(webNotifications.readAt),
        )
      : and(eq(webNotifications.tenantId, tenantId), eq(webNotifications.userId, userId));
    const rows = await db
      .select()
      .from(webNotifications)
      .where(where)
      .orderBy(desc(webNotifications.createdAt));
    return rows.map(toNotification);
  },

  async markRead({ tenantId, userId, ids }) {
    if (ids.length === 0) return 0;
    const db = getDb();
    const flipped = await db
      .update(webNotifications)
      .set({ readAt: nowIso() })
      .where(
        and(
          inArray(webNotifications.id, ids),
          eq(webNotifications.userId, userId),
          eq(webNotifications.tenantId, tenantId),
          isNull(webNotifications.readAt),
        ),
      )
      .returning({ id: webNotifications.id });
    return flipped.length;
  },

  async create({ notification, deliveries }) {
    const db = getDb();
    await db
      .insert(webNotifications)
      .values({
        id: notification.id,
        tenantId: notification.tenantId,
        userId: notification.userId,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        data: notification,
      })
      .onConflictDoUpdate({
        target: webNotifications.id,
        set: { readAt: notification.readAt, data: notification },
      });
    if (deliveries.length > 0) {
      await db
        .insert(webNotificationDeliveries)
        .values(deliveries.map((d) => ({ id: d.id, notificationId: d.notificationId, data: d })))
        .onConflictDoNothing({ target: webNotificationDeliveries.id });
    }
    return { notification, deliveries };
  },

  async listDeliveries(notificationId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(webNotificationDeliveries)
      .where(eq(webNotificationDeliveries.notificationId, notificationId));
    return rows.map((r) => r.data as NotificationDelivery);
  },

  async getPreference(userId): Promise<NotificationPreference | null> {
    const [row] = await getDb()
      .select()
      .from(webNotificationPreferences)
      .where(eq(webNotificationPreferences.userId, userId))
      .limit(1);
    return row ? (row.data as NotificationPreference) : null;
  },
  async upsertPreference(pref): Promise<NotificationPreference> {
    await getDb()
      .insert(webNotificationPreferences)
      .values({ userId: pref.userId, tenantId: pref.tenantId, data: pref })
      .onConflictDoUpdate({
        target: webNotificationPreferences.userId,
        set: { tenantId: pref.tenantId, data: pref },
      });
    return pref;
  },
  async listDigestSchedules(): Promise<DigestSchedule[]> {
    const rows = await getDb().select().from(webDigestSchedules);
    return rows.map((r) => r.data as DigestSchedule);
  },
};
