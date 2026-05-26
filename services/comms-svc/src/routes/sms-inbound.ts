/**
 * Sprint 13 — Twilio inbound SMS webhook.
 *
 * Twilio POSTs every inbound SMS to this URL as
 * application/x-www-form-urlencoded. We:
 *
 *   1. Verify X-Twilio-Signature using TWILIO_WEBHOOK_SIGNING_SECRET
 *      (falls back to TWILIO_AUTH_TOKEN to match Twilio's default).
 *   2. Detect STOP / START keywords.
 *   3. Resolve the From number to a user_id via identity-svc.
 *   4. Upsert message_consent for the sms channel.
 *   5. Emit an audit event.
 */
import type { FastifyInstance } from "fastify";
import { createLogger } from "@aivo/observability";
import { messageConsent } from "@aivo/db";
import { sql } from "drizzle-orm";
import {
  classifyInboundKeyword,
  verifyTwilioSignature,
} from "../providers/twilio-sms.js";
import { createIdentityClient } from "../clients/identity-client.js";
import { emitCommsAudit } from "../lib/audit.js";

const logger = createLogger("comms-svc:sms-inbound");

export function registerSmsInboundRoutes(app: FastifyInstance, db: any) {
  const identity = createIdentityClient();

  app.post(
    "/api/comms/sms/inbound",
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const signingSecret =
        process.env.TWILIO_WEBHOOK_SIGNING_SECRET || process.env.TWILIO_AUTH_TOKEN || "";
      if (!signingSecret) {
        logger.warn("Twilio webhook hit with no signing secret configured");
        return reply.code(503).send({ error: "twilio_not_configured" });
      }

      // Twilio sends application/x-www-form-urlencoded.
      const body = (request.body ?? {}) as Record<string, string>;
      const headerSig =
        (request.headers["x-twilio-signature"] as string | undefined) ?? undefined;

      // Twilio signs against the full URL it called. We reconstruct it
      // from the proxy headers when present so signature verification
      // works behind a load balancer.
      const proto =
        (request.headers["x-forwarded-proto"] as string | undefined) ||
        (request as any).protocol ||
        "https";
      const host =
        (request.headers["x-forwarded-host"] as string | undefined) ||
        (request.headers.host as string | undefined) ||
        "";
      const url = `${proto}://${host}${request.url}`;

      const ok = verifyTwilioSignature({
        signingSecret,
        url,
        params: body,
        header: headerSig,
      });
      if (!ok) {
        logger.warn({ url }, "Rejected inbound SMS – bad signature");
        return reply.code(403).send({ error: "invalid_signature" });
      }

      const fromNumber = body.From ?? body.from ?? "";
      const messageBody = body.Body ?? body.body ?? "";
      const keyword = classifyInboundKeyword(messageBody);

      if (keyword === "other") {
        // Not a consent keyword – ack but do nothing.
        return reply.code(200).header("content-type", "text/xml").send("<Response/>");
      }

      const user = await identity.lookupUserByPhone(fromNumber);
      if (!user) {
        logger.warn({ fromNumber, keyword }, "Inbound consent keyword from unknown number");
        return reply.code(200).header("content-type", "text/xml").send("<Response/>");
      }

      const optedIn = keyword === "start";
      try {
        await db
          .insert(messageConsent)
          .values({
            userId: user.id,
            channel: "sms",
            optedIn,
            source: "twilio_webhook",
          })
          .onConflictDoUpdate({
            target: [messageConsent.userId, messageConsent.channel],
            set: {
              optedIn,
              optedInAt: sql`now()`,
              source: "twilio_webhook",
            },
          });
        await emitCommsAudit({
          db,
          request,
          eventType: "NOTIFICATION_PREFERENCE_UPDATED",
          tenantId: user.tenantId,
          userId: user.id,
          details: { channel: "sms", optedIn, keyword, source: "twilio_webhook" },
        });
      } catch (err: any) {
        logger.error({ err, userId: user.id }, "Failed to upsert SMS consent");
        return reply.code(500).send({ error: "consent_write_failed" });
      }

      return reply.code(200).header("content-type", "text/xml").send("<Response/>");
    },
  );
}
