/**
 * Sprint 13 — Twilio SMS provider.
 *
 * Implements a small `SmsProvider` interface so the comms-svc can swap
 * out Twilio for another vendor later without touching call sites.
 *
 * Env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER
 *   TWILIO_WEBHOOK_SIGNING_SECRET (used by the STOP/UNSTOP webhook)
 *
 * We do NOT pull the Twilio SDK; the SDK adds 20+ MB of deps for a
 * single POST. We hit /Messages.json directly via fetch.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SmsSendInput {
  to: string;
  body: string;
  userId?: string; // for consent lookup; provider will refuse if opted_in=false
}

export interface SmsSendResult {
  status: "sent" | "skipped" | "failed";
  sid?: string;
  reason?: string;
}

export interface SmsProvider {
  send(input: SmsSendInput): Promise<SmsSendResult>;
  isConfigured(): boolean;
}

export interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  webhookSigningSecret?: string;
  fetchImpl?: typeof fetch;
  /**
   * Hook to check a user's per-channel consent before dispatch. Receives
   * the userId and should return true if SMS is allowed for that user.
   * Defaults to "allowed" so callers without a consent system don't get
   * silently dropped.
   */
  isSmsOptedIn?: (userId: string | undefined) => Promise<boolean>;
}

export class TwilioSmsProvider implements SmsProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly webhookSigningSecret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly isSmsOptedIn: (userId: string | undefined) => Promise<boolean>;

  constructor(cfg: TwilioConfig = {}) {
    this.accountSid = cfg.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = cfg.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? "";
    this.fromNumber = cfg.fromNumber ?? process.env.TWILIO_FROM_NUMBER ?? "";
    this.webhookSigningSecret =
      cfg.webhookSigningSecret ?? process.env.TWILIO_WEBHOOK_SIGNING_SECRET ?? this.authToken;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.isSmsOptedIn = cfg.isSmsOptedIn ?? (async () => true);
  }

  isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.fromNumber);
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    if (!input.to || !input.body) {
      return { status: "failed", reason: "missing_to_or_body" };
    }
    if (!this.isConfigured()) {
      return { status: "skipped", reason: "twilio_not_configured" };
    }
    const optedIn = await this.isSmsOptedIn(input.userId);
    if (!optedIn) {
      return { status: "skipped", reason: "user_opted_out" };
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: input.to,
      From: this.fromNumber,
      Body: input.body,
    });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      if (!res.ok) {
        const text = await res.text();
        return { status: "failed", reason: `twilio_${res.status}: ${text.slice(0, 200)}` };
      }
      const payload = (await res.json()) as { sid?: string };
      return { status: "sent", sid: payload.sid };
    } catch (err: any) {
      return { status: "failed", reason: err?.message ?? "fetch_failed" };
    }
  }
}

/**
 * Twilio signs every webhook with HMAC-SHA1 over the canonicalised URL
 * + sorted POST params, base64-encoded, in the `X-Twilio-Signature`
 * header. Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Returns true iff the signature matches.
 */
export function verifyTwilioSignature(opts: {
  signingSecret: string;
  url: string; // full URL Twilio called (scheme + host + path + query)
  params: Record<string, string>;
  header: string | undefined;
}): boolean {
  if (!opts.header) return false;
  const keys = Object.keys(opts.params).sort();
  let data = opts.url;
  for (const k of keys) data += k + opts.params[k];
  const computed = createHmac("sha1", opts.signingSecret).update(data).digest("base64");
  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(opts.header);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Classify an inbound SMS body as opt-out / opt-in / other. Twilio
 * itself handles STOP keywords for compliance, but we keep our own
 * consent table in sync via the webhook so the rest of the platform
 * can read the user-level opt-out flag.
 */
export function classifyInboundKeyword(body: string): "stop" | "start" | "other" {
  const norm = (body ?? "").trim().toUpperCase();
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(norm)) return "stop";
  if (["START", "YES", "UNSTOP"].includes(norm)) return "start";
  return "other";
}
