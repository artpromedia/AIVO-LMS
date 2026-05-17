/**
 * Speech Buddy parent-consent verification (internal endpoint).
 *
 * Called by tutor-svc on every `POST /speech-buddy/sessions`. Looks up the
 * (tenantId, learnerId) consent record and confirms it covers the requested
 * age band.
 *
 * The full consent storage table + parent UI land in the next task
 * (Speech Buddy child UI + consent + dashboards). Until then this endpoint
 * is backed by an env-stub allow-list so end-to-end testing of the agent
 * core can run today:
 *
 *   SPEECH_BUDDY_DEV_CONSENTS=tenant1:learner1:c1,tenantA:learnerB:cAB
 *
 * The wire format is final — when the real consent store lands, only the
 * lookup body changes.
 */

import type { FastifyInstance } from "fastify";
import { internalSpeechBuddyConsentVerifySchema } from "./schemas.js";

function devLookup(tenantId: string, learnerId: string): string | null {
  const raw = process.env.SPEECH_BUDDY_DEV_CONSENTS || "";
  if (!raw) return null;
  for (const entry of raw.split(",")) {
    const [t, l, c] = entry.trim().split(":");
    if (t === tenantId && l === learnerId && c) return c;
  }
  return null;
}

export async function registerSpeechBuddyConsentRoutes(app: FastifyInstance) {
  app.post("/api/family/internal/speech-buddy/consent/verify", { schema: internalSpeechBuddyConsentVerifySchema }, async (req, reply) => {
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
    if (!["6-9", "10-12", "13-15"].includes(ageBand)) {
      return reply.code(400).send({ error: "ageBand must be 6-9 / 10-12 / 13-15" });
    }
    const consentRecordId = devLookup(tenantId, learnerId);
    if (!consentRecordId) {
      return reply.code(404).send({ granted: false });
    }
    return reply.send({ granted: true, consentRecordId, ageBand, scope: "speech_buddy" });
  });
}
