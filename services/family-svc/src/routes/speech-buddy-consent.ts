/**
 * Speech Buddy parent-consent store + verification.
 *
 * Parent-facing (JWT bearer + learner ownership):
 *   GET  /api/family/speech-buddy/consent/:learnerId          → status
 *   POST /api/family/speech-buddy/consent/:learnerId          → grant {ageBand}
 *   POST /api/family/speech-buddy/consent/:learnerId/revoke   → revoke
 *
 * Internal (x-internal-key — called by tutor-svc on every Speech Buddy
 * session start):
 *   POST /api/family/internal/speech-buddy/consent/verify     → {granted}
 *
 * Backed by the `speech_buddy_consents` table. The legacy
 * `SPEECH_BUDDY_DEV_CONSENTS` env allow-list is kept ONLY as a dev/test
 * fallback for the internal verify path (so tutor-svc's offline tests keep
 * working); a real DB grant always takes precedence.
 *
 *   SPEECH_BUDDY_DEV_CONSENTS=tenant1:learner1:c1,tenantA:learnerB:cAB
 */

import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull } from "drizzle-orm";
import { speechBuddyConsents } from "@aivo/db";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import {
  internalSpeechBuddyConsentVerifySchema,
  getSpeechBuddyConsentSchema,
  grantSpeechBuddyConsentSchema,
  revokeSpeechBuddyConsentSchema,
} from "./schemas.js";

const AGE_BANDS = ["3-5", "6-9", "10-12", "13-15"];
const SCOPE = "speech_buddy";

function devLookup(tenantId: string, learnerId: string): string | null {
  const raw = process.env.SPEECH_BUDDY_DEV_CONSENTS || "";
  if (!raw) return null;
  for (const entry of raw.split(",")) {
    const [t, l, c] = entry.trim().split(":");
    if (t === tenantId && l === learnerId && c) return c;
  }
  return null;
}

/** Most-recent active (non-revoked) consent row for a learner, or null. */
async function activeConsent(
  db: any,
  tenantId: string | null,
  learnerId: string,
): Promise<{ id: string; ageBand: string } | null> {
  const conds = [
    eq(speechBuddyConsents.learnerId, learnerId),
    eq(speechBuddyConsents.scope, SCOPE),
    isNull(speechBuddyConsents.revokedAt),
  ];
  if (tenantId) conds.push(eq(speechBuddyConsents.tenantId, tenantId));
  const rows = await db
    .select()
    .from(speechBuddyConsents)
    .where(and(...conds))
    .orderBy(desc(speechBuddyConsents.grantedAt))
    .limit(1);
  if (rows.length === 0) return null;
  return { id: rows[0].id, ageBand: rows[0].ageBand };
}

export async function registerSpeechBuddyConsentRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  // --- Parent: read current consent status -------------------------------
  app.get(
    "/api/family/speech-buddy/consent/:learnerId",
    { schema: getSpeechBuddyConsentSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { learnerId } = req.params as { learnerId: string };
      if (!(await verifyParentOwnership(db, auth.sub, learnerId))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const active = await activeConsent(db, auth.tenantId, learnerId);
      return reply.send({
        learnerId,
        granted: Boolean(active),
        consent: active ? { id: active.id, ageBand: active.ageBand, scope: SCOPE } : null,
      });
    },
  );

  // --- Parent: grant consent ---------------------------------------------
  app.post(
    "/api/family/speech-buddy/consent/:learnerId",
    { schema: grantSpeechBuddyConsentSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { learnerId } = req.params as { learnerId: string };
      const { ageBand } = (req.body as any) || {};
      if (!ageBand || !AGE_BANDS.includes(ageBand)) {
        return reply.code(400).send({ error: "ageBand must be 3-5 / 6-9 / 10-12 / 13-15" });
      }
      if (!(await verifyParentOwnership(db, auth.sub, learnerId))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      // Supersede any existing active grant, then record the new one (history
      // is retained for audit).
      await db
        .update(speechBuddyConsents)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(speechBuddyConsents.learnerId, learnerId),
            eq(speechBuddyConsents.scope, SCOPE),
            isNull(speechBuddyConsents.revokedAt),
          ),
        );
      const [row] = await db
        .insert(speechBuddyConsents)
        .values({
          tenantId: auth.tenantId,
          learnerId,
          parentUserId: auth.sub,
          ageBand,
          scope: SCOPE,
        })
        .returning();
      return reply.send({
        granted: true,
        consentRecordId: row.id,
        learnerId,
        ageBand,
        scope: SCOPE,
      });
    },
  );

  // --- Parent: revoke consent --------------------------------------------
  app.post(
    "/api/family/speech-buddy/consent/:learnerId/revoke",
    { schema: revokeSpeechBuddyConsentSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { learnerId } = req.params as { learnerId: string };
      if (!(await verifyParentOwnership(db, auth.sub, learnerId))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      await db
        .update(speechBuddyConsents)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(speechBuddyConsents.learnerId, learnerId),
            eq(speechBuddyConsents.scope, SCOPE),
            isNull(speechBuddyConsents.revokedAt),
          ),
        );
      return reply.send({ revoked: true, learnerId });
    },
  );

  // --- Internal: verify (tutor-svc) --------------------------------------
  app.post(
    "/api/family/internal/speech-buddy/consent/verify",
    { schema: internalSpeechBuddyConsentVerifySchema },
    async (req, reply) => {
      const internalKey = req.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const { tenantId, learnerId, ageBand } = (req.body as any) || {};
      if (!tenantId || !learnerId || !ageBand) {
        return reply.code(400).send({ error: "tenantId, learnerId and ageBand required" });
      }
      if (!AGE_BANDS.includes(ageBand)) {
        return reply.code(400).send({ error: "ageBand must be 3-5 / 6-9 / 10-12 / 13-15" });
      }

      // Real DB grant takes precedence. Guard against malformed (non-uuid)
      // ids in dev by falling through to the env allow-list on error.
      try {
        const active = await activeConsent(db, tenantId, learnerId);
        if (active) {
          return reply.send({
            granted: true,
            consentRecordId: active.id,
            ageBand: active.ageBand,
            scope: SCOPE,
          });
        }
      } catch (err) {
        (req as any).log?.warn?.(
          { err },
          "speech-buddy consent DB lookup failed; trying dev allow-list",
        );
      }

      const devConsentId = devLookup(tenantId, learnerId);
      if (devConsentId) {
        return reply.send({ granted: true, consentRecordId: devConsentId, ageBand, scope: SCOPE });
      }
      return reply.code(404).send({ granted: false });
    },
  );
}
