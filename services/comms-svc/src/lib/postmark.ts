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
}

export interface TemplateEmailOptions {
  to: string;
  templateAlias: string;
  templateModel: Record<string, unknown>;
  tag?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ messageId: string; status: string }> {
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

  logger.info({ to: options.to, messageId: result.MessageID }, "Email sent");

  return {
    messageId: result.MessageID,
    status: result.ErrorCode === 0 ? "sent" : "failed",
  };
}

export async function sendTemplateEmail(options: TemplateEmailOptions): Promise<{ messageId: string; status: string }> {
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

  logger.info({ to: options.to, template: options.templateAlias, messageId: result.MessageID }, "Template email sent");

  return {
    messageId: result.MessageID,
    status: result.ErrorCode === 0 ? "sent" : "failed",
  };
}

export async function sendBatchEmails(emails: EmailOptions[]): Promise<{ sent: number; failed: number }> {
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

  logger.info({ total: results.length, sent, failed }, "Batch emails sent");

  return { sent, failed };
}

export function isConfigured(): boolean {
  return !!POSTMARK_TOKEN;
}
