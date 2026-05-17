/**
 * Sprint 7 — `POST /api/comms/webhook/email-events` (Task #64).
 *
 * Provider-agnostic email-events ingester. Verifies the provider signature
 * before doing anything with the payload, then normalizes Postmark / Mailgun /
 * SES events to the same internal shape and updates the originating message's
 * delivery status.
 *
 * Signature schemes:
 *   - Postmark — HMAC-SHA1 of the raw body, base64. Header: `X-Postmark-Signature`.
 *   - Mailgun  — HMAC-SHA256 of `timestamp + token`, hex. Body fields:
 *                `signature.timestamp`, `signature.token`, `signature.signature`.
 *   - SES      — SNS-relayed; we accept a wrapper that the SNS->HTTP relay
 *                signs with `X-Aivo-Webhook-Signature` (HMAC-SHA256 of body).
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { emailEventsWebhookSchema } from "./schemas.js";

export type EmailProvider = "postmark" | "mailgun" | "ses";
export type EmailEventType = "delivered" | "bounced" | "complained" | "opened" | "clicked";

export interface NormalizedEmailEvent {
  provider: EmailProvider;
  type: EmailEventType;
  messageId: string;
  recipient: string;
  occurredAt: string;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function verifyPostmarkSignature(rawBody: string, headerSignature: string, secret: string): boolean {
  const expected = createHmac("sha1", secret).update(rawBody).digest("base64");
  return safeEqual(headerSignature, expected);
}

export function verifyMailgunSignature(
  signature: { timestamp: string; token: string; signature: string },
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(signature.timestamp + signature.token)
    .digest("hex");
  return safeEqual(signature.signature, expected);
}

export function verifyAivoSnsSignature(rawBody: string, headerSignature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(headerSignature, expected);
}

export function normalizePostmark(payload: any): NormalizedEmailEvent | null {
  if (!payload?.MessageID || !payload?.RecordType) return null;
  const map: Record<string, EmailEventType> = {
    Delivery: "delivered",
    Bounce: "bounced",
    SpamComplaint: "complained",
    Open: "opened",
    Click: "clicked",
  };
  const t = map[payload.RecordType];
  if (!t) return null;
  return {
    provider: "postmark",
    type: t,
    messageId: payload.MessageID,
    recipient: payload.Email ?? payload.Recipient ?? "",
    occurredAt: payload.DeliveredAt ?? payload.BouncedAt ?? payload.ReceivedAt ?? new Date().toISOString(),
  };
}

export function normalizeMailgun(payload: any): NormalizedEmailEvent | null {
  const ev = payload?.["event-data"] ?? payload;
  if (!ev?.message?.headers?.["message-id"]) return null;
  const map: Record<string, EmailEventType> = {
    delivered: "delivered",
    failed: "bounced",
    complained: "complained",
    opened: "opened",
    clicked: "clicked",
  };
  const t = map[ev.event];
  if (!t) return null;
  return {
    provider: "mailgun",
    type: t,
    messageId: ev.message.headers["message-id"],
    recipient: ev.recipient ?? "",
    occurredAt: ev.timestamp
      ? new Date(Number(ev.timestamp) * 1000).toISOString()
      : new Date().toISOString(),
  };
}

export function normalizeSes(payload: any): NormalizedEmailEvent | null {
  const message = typeof payload?.Message === "string" ? safeParseJson(payload.Message) : payload?.Message ?? payload;
  if (!message) return null;
  const map: Record<string, EmailEventType> = {
    Delivery: "delivered",
    Bounce: "bounced",
    Complaint: "complained",
    Open: "opened",
    Click: "clicked",
  };
  const t = map[message.eventType ?? message.notificationType];
  if (!t) return null;
  return {
    provider: "ses",
    type: t,
    messageId: message.mail?.messageId ?? "",
    recipient:
      message.mail?.destination?.[0] ??
      message.bounce?.bouncedRecipients?.[0]?.emailAddress ??
      "",
    occurredAt: message.mail?.timestamp ?? new Date().toISOString(),
  };
}

function safeParseJson(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export interface EmailEventsRouteDeps {
  /** Persist a normalized event. Receives the normalized shape. */
  recordEvent?: (ev: NormalizedEmailEvent) => Promise<void>;
}

export function registerEmailEventsRoutes(app: FastifyInstance, deps: EmailEventsRouteDeps = {}) {
  const recordEvent = deps.recordEvent ?? (async () => {});

  // Capture the raw body so signature verification can run on the exact bytes
  // the provider signed. Fastify only does this when content-type is JSON.
  app.addHook("onRequest", (req, _reply, done) => {
    if (req.url.startsWith("/api/comms/webhook/email-events")) {
      (req as any).rawBody = "";
    }
    done();
  });
  app.addHook("preParsing", (req, _reply, payload, done) => {
    if (req.url.startsWith("/api/comms/webhook/email-events")) {
      const chunks: Buffer[] = [];
      payload.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      payload.on("end", () => {
        (req as any).rawBody = Buffer.concat(chunks).toString("utf8");
      });
    }
    done(null, payload);
  });

  app.post("/api/comms/webhook/email-events", { schema: emailEventsWebhookSchema }, async (req: FastifyRequest, reply) => {
    const raw = (req as any).rawBody as string | undefined;
    const provider = (req.headers["x-email-provider"] as string | undefined) ?? "postmark";

    let event: NormalizedEmailEvent | null = null;
    let verified = false;

    if (provider === "postmark") {
      const secret = process.env.POSTMARK_WEBHOOK_SECRET ?? "";
      const sig = (req.headers["x-postmark-signature"] as string) ?? "";
      verified = !!secret && !!sig && !!raw && verifyPostmarkSignature(raw, sig, secret);
      if (verified) event = normalizePostmark(req.body);
    } else if (provider === "mailgun") {
      const secret = process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? "";
      const body = req.body as any;
      const signature = body?.signature ?? {};
      verified = !!secret && !!signature?.signature && verifyMailgunSignature(signature, secret);
      if (verified) event = normalizeMailgun(body);
    } else if (provider === "ses") {
      const secret = process.env.AIVO_SNS_WEBHOOK_SECRET ?? "";
      const sig = (req.headers["x-aivo-webhook-signature"] as string) ?? "";
      verified = !!secret && !!sig && !!raw && verifyAivoSnsSignature(raw, sig, secret);
      if (verified) event = normalizeSes(req.body);
    } else {
      reply.code(400).send({ error: "unknown_provider" });
      return;
    }

    if (!verified) {
      reply.code(401).send({ error: "signature_invalid" });
      return;
    }
    if (!event) {
      reply.code(202).send({ ok: true, ignored: true });
      return;
    }
    await recordEvent(event);
    return { ok: true, event };
  });
}
