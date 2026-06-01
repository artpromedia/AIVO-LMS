/**
 * Device-token store for user-addressed push.
 *
 * Resolves a userId to the FCM/APNs `PushTarget`s the push-router needs,
 * upserts on (re-)registration, and prunes tokens the provider reports as
 * invalid. Backed by the `device_tokens` Postgres table.
 */
import { and, eq, inArray } from "drizzle-orm";
import { deviceTokens } from "@aivo/db";
import type { PushTarget, DeviceTokenKind } from "../providers/push-router.js";

export interface RegisterDeviceInput {
  userId: string;
  token: string;
  kind: DeviceTokenKind;
  platform?: string | null;
  topic?: string | null;
}

/** Register or refresh a device token (upsert by the globally-unique token). */
export async function registerDeviceToken(db: any, input: RegisterDeviceInput): Promise<void> {
  await db
    .insert(deviceTokens)
    .values({
      userId: input.userId,
      token: input.token,
      kind: input.kind,
      platform: input.platform ?? null,
      topic: input.topic ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set: {
        userId: input.userId,
        kind: input.kind,
        platform: input.platform ?? null,
        topic: input.topic ?? null,
        lastSeenAt: new Date(),
      },
    });
}

/** Resolve a user's registered devices into push-router targets. */
export async function listDeviceTargets(db: any, userId: string): Promise<PushTarget[]> {
  const rows = await db.select().from(deviceTokens).where(eq(deviceTokens.userId, userId));
  return rows.map((r: any) => ({
    token: r.token as string,
    kind: r.kind as DeviceTokenKind,
    ...(r.topic ? { topic: r.topic as string } : {}),
  }));
}

/** Unregister a token, but only if it belongs to the caller. Returns true if removed. */
export async function deleteDeviceToken(db: any, userId: string, token: string): Promise<boolean> {
  const removed = await db
    .delete(deviceTokens)
    .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)))
    .returning({ id: deviceTokens.id });
  return removed.length > 0;
}

/** Prune tokens the provider reported as invalid (revoked/expired). */
export async function deleteInvalidTokens(db: any, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await db.delete(deviceTokens).where(inArray(deviceTokens.token, tokens));
}
