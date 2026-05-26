import { ServerClient, Models } from "postmark";
import { createLogger } from "@aivo/observability";

const logger = createLogger("comms-svc:postmark");

const POSTMARK_TOKEN = process.env.POSTMARK_API_TOKEN || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@aivolearning.com";
const FROM_NAME = process.env.FROM_NAME || "AIVO Learning";

let client: ServerClient | null = null;

function getClient(): ServerClient {
  if (!client) {
    if (!POSTMARK_TOKEN) {
      throw new Error("POSTMARK_API_TOKEN is not configured");
    }
    client = new ServerClient(POSTMARK_TOKEN);
  }
  return client;
}

export interface EmailOptions {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  tag?: string;
  replyTo?: string;
  metadata?: Record<string, string>;
  /** Optional idempotency key; identical values within the unique-index lifetime collapse to one outbox row. */
  dedupeKey?: string;
}

export interface TemplateEmailOptions {
  to: string;
  templateAlias: string;
  templateModel: Record<string, unknown>;
  tag?: string;
  dedupeKey?: string;
}

export interface SendResult {
  /**
   * For the durable (outbox) path: the outbox row id. The eventual Postmark
   * MessageID is recorded on the row once the worker sends it. For the
   * direct path: the Postmark MessageID itself.
   */
  messageId: string;
  /** "queued" when persisted to the outbox, "sent"/"failed" on the direct path. */
  status: "queued" | "sent" | "failed";
}

// ─── Outbox wiring ─────────────────────────────────────────────────────────
// comms-svc calls setEmailOutboxDb(db) during boot. When set (and the
// EMAIL_OUTBOX_DISABLED env opt-out isn't on), every sendEmail call persists
// to the outbox table first; the drain worker is the only thing that talks
// to Postmark. Tests and one-shot scripts that don't wire a db keep the old
// direct path so they still work without DATABASE_URL.

interface OutboxDbLike {
  execute: (q: any) => Promise<unknown>;
}

let outboxDb: OutboxDbLike | null = null;

export function setEmailOutboxDb(db: OutboxDbLike | null): void {
  outboxDb = db;
}

function outboxEnabled(): boolean {
  return !!outboxDb && process.env.EMAIL_OUTBOX_DISABLED !== "1";
}

// ─── Public surface ────────────────────────────────────────────────────────
// Existing callers (17 sites across notifications.ts) keep importing
// sendEmail / sendTemplateEmail / sendBatchEmails and get durable delivery
// for free once setEmailOutboxDb has been called.

export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  if (outboxEnabled()) {
    const { enqueueEmail } = await import("./email-outbox.js");
    const { id, status } = await enqueueEmail(outboxDb!, {
      kind: "raw",
      to: options.to,
      subject: options.subject,
      htmlBody: options.htmlBody,
      textBody: options.textBody,
      tag: options.tag,
      replyTo: options.replyTo,
      metadata: options.metadata,
      dedupeKey: options.dedupeKey,
    });
    logger.info(
      { to: options.to, outboxId: id, status, durable: true },
      "Email enqueued to outbox",
    );
    return { messageId: id, status: "queued" };
  }
  return _sendEmailDirect(options);
}

export async function sendTemplateEmail(options: TemplateEmailOptions): Promise<SendResult> {
  if (outboxEnabled()) {
    const { enqueueEmail } = await import("./email-outbox.js");
    const { id, status } = await enqueueEmail(outboxDb!, {
      kind: "template",
      to: options.to,
      templateAlias: options.templateAlias,
      templateModel: options.templateModel,
      tag: options.tag,
      dedupeKey: options.dedupeKey,
    });
    logger.info(
      { to: options.to, template: options.templateAlias, outboxId: id, status, durable: true },
      "Template email enqueued to outbox",
    );
    return { messageId: id, status: "queued" };
  }
  return _sendTemplateEmailDirect(options);
}

// ─── Direct senders ────────────────────────────────────────────────────────
// These talk to Postmark synchronously and are used by (a) the outbox drain
// worker, (b) callers that explicitly bypass the queue (none right now),
// and (c) tests that want to assert against the raw Postmark response.

export async function _sendEmailDirect(
  options: EmailOptions,
): Promise<SendResult> {
  const pm = getClient();

  const result = await pm.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: options.to,
    Subject: options.subject,
    HtmlBody: options.htmlBody || "",
    TextBody: options.textBody || "",
    Tag: options.tag,
    ReplyTo: options.replyTo,
    TrackOpens: true,
    TrackLinks: Models.LinkTrackingOptions.HtmlAndText,
    MessageStream: "outbound",
    Metadata: options.metadata,
  });

  logger.info({ to: options.to, messageId: result.MessageID }, "Email sent (direct)");

  return {
    messageId: result.MessageID,
    status: result.ErrorCode === 0 ? "sent" : "failed",
  };
}

export async function _sendTemplateEmailDirect(
  options: TemplateEmailOptions,
): Promise<SendResult> {
  const pm = getClient();

  const result = await pm.sendEmailWithTemplate({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: options.to,
    TemplateAlias: options.templateAlias,
    TemplateModel: options.templateModel,
    Tag: options.tag,
    TrackOpens: true,
    TrackLinks: Models.LinkTrackingOptions.HtmlAndText,
    MessageStream: "outbound",
  });

  logger.info(
    { to: options.to, template: options.templateAlias, messageId: result.MessageID },
    "Template email sent (direct)",
  );

  return {
    messageId: result.MessageID,
    status: result.ErrorCode === 0 ? "sent" : "failed",
  };
}

export async function sendBatchEmails(
  emails: EmailOptions[],
): Promise<{ sent: number; failed: number; queued?: number }> {
  // Batch goes through the outbox too — every entry becomes its own row so
  // each gets independent retries. The Postmark batch API is then only used
  // by the drain worker (one row at a time today, but could be coalesced).
  if (outboxEnabled()) {
    const { enqueueEmail } = await import("./email-outbox.js");
    let queued = 0;
    for (const e of emails) {
      await enqueueEmail(outboxDb!, {
        kind: "raw",
        to: e.to,
        subject: e.subject,
        htmlBody: e.htmlBody,
        textBody: e.textBody,
        tag: e.tag,
        replyTo: e.replyTo,
        metadata: e.metadata,
        dedupeKey: e.dedupeKey,
      });
      queued++;
    }
    logger.info({ queued }, "Batch emails enqueued to outbox");
    return { sent: 0, failed: 0, queued };
  }

  const pm = getClient();

  const messages = emails.map((e) => ({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: e.to,
    Subject: e.subject,
    HtmlBody: e.htmlBody || "",
    TextBody: e.textBody || "",
    Tag: e.tag,
    TrackOpens: true,
    TrackLinks: Models.LinkTrackingOptions.HtmlAndText,
    MessageStream: "outbound",
  }));

  const results = await pm.sendEmailBatch(messages);
  const sent = results.filter((r) => r.ErrorCode === 0).length;
  const failed = results.length - sent;

  logger.info({ total: results.length, sent, failed }, "Batch emails sent (direct)");

  return { sent, failed };
}

export function isConfigured(): boolean {
  return !!POSTMARK_TOKEN;
}
