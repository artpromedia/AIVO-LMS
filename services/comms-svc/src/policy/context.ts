/**
 * Sprint 13 — build a PolicyContext for the live request.
 *
 * Routes call `await buildPolicyContext(db)` and pass the result into
 * the visibility functions. Centralising this here means clients can be
 * stubbed in tests by swapping `buildPolicyContext`.
 */
import { eq } from "drizzle-orm";
import { messageConsent } from "@aivo/db";
import { createIdentityClient } from "../clients/identity-client.js";
import { createFamilyClient } from "../clients/family-client.js";
import type { PolicyContext } from "./visibility.js";

export function buildPolicyContext(db: any): PolicyContext {
  const identity = createIdentityClient();
  const family = createFamilyClient();
  return {
    identity,
    family,
    async loadConsent(userId: string) {
      const rows = await db
        .select({
          userId: messageConsent.userId,
          channel: messageConsent.channel,
          optedIn: messageConsent.optedIn,
        })
        .from(messageConsent)
        .where(eq(messageConsent.userId, userId));
      return rows.map((r: any) => ({
        userId: r.userId,
        channel: r.channel,
        optedIn: r.optedIn,
      }));
    },
  };
}
