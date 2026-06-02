/**
 * Sprint 6 (closeout) — SMS notification router.
 *
 * Replaces the bare `sms: "not_available"` stub with a real, provider-agnostic
 * channel. The platform default is `disabled` (no SMS provider configured), so
 * nothing changes for deployments that don't opt in. Setting
 * `SMS_PROVIDER=twilio` (+ `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
 * `TWILIO_FROM_NUMBER`) activates the Twilio adapter.
 *
 * The adapter boundary is identical in spirit to push-router.ts so SMS can be
 * mocked in tests without network/credentials.
 */

export interface SmsMessage {
  /** E.164 destination number, e.g. "+15551234567". */
  to: string;
  body: string;
}

export type SmsStatus = "sent" | "disabled" | "failed";

export interface SmsResult {
  status: SmsStatus;
  /** Provider message id when sent. */
  messageId?: string;
  error?: string;
}

export interface SmsAdapter {
  readonly name: string;
  send(msg: SmsMessage): Promise<SmsResult>;
}

/** Default adapter: no provider configured. Never sends, never throws. */
const disabledAdapter: SmsAdapter = {
  name: "disabled",
  async send() {
    return { status: "disabled" };
  },
};

/**
 * Twilio adapter. Uses the REST API directly (no SDK dependency) so the
 * service stays light; only activated when fully configured.
 */
function createTwilioAdapter(cfg: {
  accountSid: string;
  authToken: string;
  from: string;
}): SmsAdapter {
  return {
    name: "twilio",
    async send(msg) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
      const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");
      const form = new URLSearchParams({ To: msg.to, From: cfg.from, Body: msg.body });
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Basic ${auth}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
        if (!res.ok) {
          return { status: "failed", error: json.message ?? `twilio ${res.status}` };
        }
        return { status: "sent", messageId: json.sid };
      } catch (err) {
        return { status: "failed", error: (err as Error).message };
      }
    },
  };
}

/** Resolve the configured adapter from the environment (memoized). */
let cached: SmsAdapter | null = null;
export function getSmsAdapter(): SmsAdapter {
  if (cached) return cached;
  if (process.env.SMS_PROVIDER === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (accountSid && authToken && from) {
      cached = createTwilioAdapter({ accountSid, authToken, from });
      return cached;
    }
  }
  cached = disabledAdapter;
  return cached;
}

/** True when a real SMS provider is configured (drives the status surface). */
export function isSmsConfigured(): boolean {
  return getSmsAdapter().name !== "disabled";
}

/** Send one SMS through the configured adapter. */
export function sendSms(
  msg: SmsMessage,
  adapter: SmsAdapter = getSmsAdapter(),
): Promise<SmsResult> {
  return adapter.send(msg);
}

/** Test hook — reset the memoized adapter so env changes take effect. */
export function _resetSmsAdapterForTest(): void {
  cached = null;
}
