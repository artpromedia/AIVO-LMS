import { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { sendEmail, sendBatchEmails, isConfigured } from "../lib/postmark.js";
import { getOutboxCounts } from "../lib/email-outbox.js";
import { renderTemplate, AVAILABLE_TEMPLATES } from "../lib/templates.js";
import { createLogger } from "@aivo/observability";
import { emitCommsAudit } from "../lib/audit.js";
import { sendSms, isSmsConfigured } from "../providers/sms-router.js";
import {
  CHANNELS,
  isChannelAllowedForTenant,
  snapshotChannelStatus,
  type ChannelDisabledResult,
  type ChannelSkipReason,
} from "../lib/channels.js";
import {
  registerDeviceToken,
  listDeviceTargets,
  deleteDeviceToken,
  deleteInvalidTokens,
} from "../lib/device-tokens.js";
import {
  sendNotificationSchema,
  sendEmailSchema,
  sendBatchEmailSchema,
  sendPushSchema,
  registerDeviceSchema,
  deleteDeviceSchema,
  getPreferencesSchema,
  updatePreferencesSchema,
  listTemplatesSchema,
  internalMfaCodeSchema,
  internalInAppNotifySchema,
  internalIepNotifySchema,
  internalTeamInviteSchema,
  internalPasswordResetSchema,
  internalDistrictAdminInviteSchema,
  internalParentInviteSchema,
  internalTrialEndingSchema,
  internalSchoolAdminInviteSchema,
  internalTeacherInviteSchema,
  internalStaffCredentialsSchema,
  internalTeacherInviteParentSchema,
  internalAdminAlertSchema,
  internalSpeechBuddySafetySchema,
  internalBillingAlertSchema,
  internalNewsletterConfirmSchema,
  listInAppNotificationsSchema,
  markInAppNotificationsReadSchema,
  publicContactSchema,
  publicDemoRequestSchema,
  publicNewsletterSchema,
  commsStatusSchema,
} from "./schemas.js";

const logger = createLogger("comms-svc:notifications");

async function requireAuth(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

async function requireAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(payload.role as string)) {
      return reply.status(403).send({ error: "Admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export function registerNotificationRoutes(app: FastifyInstance, db: any) {
  app.post(
    "/api/comms/send",
    { schema: sendNotificationSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { channel, recipient, template, data } = request.body as any;
      if (!channel || !recipient || !template) {
        return reply.code(400).send({ error: "channel, recipient, and template required" });
      }

      if (channel === "email") {
        if (!isConfigured()) {
          return reply.code(503).send({ error: "Email service not configured" });
        }

        const rendered = renderTemplate(template, data || {});
        try {
          const result = await sendEmail({
            to: recipient,
            subject: rendered.subject,
            htmlBody: rendered.html,
            textBody: rendered.text,
            tag: template,
          });
          await emitCommsAudit({
            db,
            request,
            eventType: "NOTIFICATION_SENT",
            tenantId: (request as any).auth?.tenantId ?? null,
            resourceId: result.messageId ?? null,
            details: { channel, template, status: result.status },
          });
          return { status: result.status, messageId: result.messageId, channel, template };
        } catch (err: any) {
          logger.error({ err, template, recipient }, "Failed to send email");
          await emitCommsAudit({
            db,
            request,
            eventType: "NOTIFICATION_FAILED",
            tenantId: (request as any).auth?.tenantId ?? null,
            details: { channel, template, error: err.message },
          });
          return reply.code(500).send({ error: "Failed to send email", details: err.message });
        }
      }

      if (channel === "sms") {
        const tenantId = ((request as any).auth?.tenantId ?? null) as string | null;
        // First-class channel registry decides: configured? tenant-allowed?
        // Either failure mode returns a typed `channel_disabled` body and
        // emits NOTIFICATION_SKIPPED — never a silent stub success and
        // never a bare 503.
        const buildDisabled = async (
          reason: ChannelSkipReason,
          detail?: string,
        ): Promise<ChannelDisabledResult> => {
          await emitCommsAudit({
            db,
            request,
            eventType: "NOTIFICATION_SKIPPED",
            tenantId,
            details: { channel, template, reason, ...(detail ? { detail } : {}) },
          });
          return {
            status: "channel_disabled",
            channel: CHANNELS.sms.id,
            reason,
            ...(detail ? { detail } : {}),
          };
        };
        if (!isSmsConfigured()) {
          return reply.code(200).send(await buildDisabled("provider_not_configured"));
        }
        if (!isChannelAllowedForTenant("sms", tenantId)) {
          return reply.code(200).send(await buildDisabled("tenant_opted_out"));
        }
        const rendered = renderTemplate(template, data || {});
        // SMS is text-only: prefer the template's text body, fall back to subject.
        const body = (rendered.text || rendered.subject || "").trim();
        const result = await sendSms({ to: recipient, body });
        if (result.status === "failed") {
          await emitCommsAudit({
            db,
            request,
            eventType: "NOTIFICATION_FAILED",
            tenantId,
            details: { channel, template, error: result.error },
          });
          return reply.code(500).send({ error: "Failed to send SMS", details: result.error });
        }
        // Defense-in-depth: the adapter should never return `disabled`
        // here (we gated above), but if a misconfiguration races us,
        // surface it as channel_disabled rather than a fake send.
        if (result.status === "disabled") {
          return reply
            .code(200)
            .send(await buildDisabled("provider_not_configured", "adapter returned disabled"));
        }
        await emitCommsAudit({
          db,
          request,
          eventType: "NOTIFICATION_SENT",
          tenantId,
          resourceId: result.messageId ?? null,
          details: { channel, template, status: result.status },
        });
        return { status: result.status, messageId: result.messageId, channel, template };
      }

      const queuedId = crypto.randomUUID();
      await emitCommsAudit({
        db,
        request,
        eventType: "NOTIFICATION_QUEUED",
        tenantId: (request as any).auth?.tenantId ?? null,
        resourceId: queuedId,
        details: { channel, template },
      });
      return {
        status: "queued",
        messageId: queuedId,
        channel,
        recipient,
        template,
        queuedAt: new Date().toISOString(),
      };
    },
  );

  app.post(
    "/api/comms/email",
    { schema: sendEmailSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { to, subject, template, data, htmlBody, textBody } = request.body as any;
      if (!to || (!subject && !template)) {
        return reply.code(400).send({ error: "to and (subject or template) required" });
      }

      if (!isConfigured()) {
        return reply.code(503).send({ error: "Email service not configured" });
      }

      let finalSubject = subject;
      let finalHtml = htmlBody || "";
      let finalText = textBody || "";

      if (template) {
        const rendered = renderTemplate(template, data || {});
        finalSubject = finalSubject || rendered.subject;
        finalHtml = finalHtml || rendered.html;
        finalText = finalText || rendered.text;
      }

      try {
        const result = await sendEmail({
          to,
          subject: finalSubject,
          htmlBody: finalHtml,
          textBody: finalText,
          tag: template || "custom",
        });
        return { status: result.status, messageId: result.messageId, to, subject: finalSubject };
      } catch (err: any) {
        logger.error({ err, to, subject: finalSubject }, "Failed to send email");
        return reply.code(500).send({ error: "Failed to send email", details: err.message });
      }
    },
  );

  app.post(
    "/api/comms/email/batch",
    { schema: sendBatchEmailSchema, preHandler: requireAdmin },
    async (request, reply) => {
      const { emails } = request.body as any;
      if (!Array.isArray(emails) || emails.length === 0) {
        return reply.code(400).send({ error: "emails array required" });
      }
      if (emails.length > 500) {
        return reply.code(400).send({ error: "Maximum 500 emails per batch" });
      }

      if (!isConfigured()) {
        return reply.code(503).send({ error: "Email service not configured" });
      }

      const prepared = emails.map((e: any) => {
        if (e.template) {
          const rendered = renderTemplate(e.template, e.data || {});
          return {
            to: e.to,
            subject: e.subject || rendered.subject,
            htmlBody: rendered.html,
            textBody: rendered.text,
            tag: e.template,
          };
        }
        return { to: e.to, subject: e.subject, htmlBody: e.htmlBody, textBody: e.textBody };
      });

      try {
        const result = await sendBatchEmails(prepared);
        return { status: "completed", ...result };
      } catch (err: any) {
        logger.error({ err }, "Failed to send batch emails");
        return reply.code(500).send({ error: "Failed to send batch emails", details: err.message });
      }
    },
  );

  app.post(
    "/api/comms/push",
    { schema: sendPushSchema, preHandler: requireAdmin },
    async (request, reply) => {
      const { userId, title, body, data } = request.body as any;
      if (!userId || !title) return reply.code(400).send({ error: "userId and title required" });

      // Resolve the user's registered devices, fan out via the push-router,
      // and prune any tokens the provider reports as invalid. Previously this
      // returned a fake "queued" status without delivering anything.
      const targets = await listDeviceTargets(db, userId);
      if (targets.length === 0) {
        return { status: "no_devices", sent: 0, devices: 0 };
      }
      const { defaultPushRouter } = await import("../providers/push-router.js");
      const results = await defaultPushRouter.send(targets, { title, body, data });
      const invalid = results.filter((r) => r.invalidToken).map((r) => r.token);
      if (invalid.length) await deleteInvalidTokens(db, invalid);
      const sent = results.filter((r) => r.ok).length;
      return {
        status: sent > 0 ? "sent" : "failed",
        sent,
        devices: targets.length,
        pruned: invalid.length,
      };
    },
  );

  // Register/refresh the caller's own push device token (mobile/web client
  // posts this on login + token refresh).
  app.post(
    "/api/comms/devices",
    { schema: registerDeviceSchema, preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request as any).user?.sub as string | undefined;
      if (!userId) return reply.code(401).send({ error: "Missing user context" });
      const { token, kind, platform, topic } = request.body as any;
      await registerDeviceToken(db, { userId, token, kind, platform, topic });
      return { status: "registered" };
    },
  );

  // Unregister one of the caller's device tokens (logout / token rotation).
  app.delete(
    "/api/comms/devices/:token",
    { schema: deleteDeviceSchema, preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request as any).user?.sub as string | undefined;
      if (!userId) return reply.code(401).send({ error: "Missing user context" });
      const { token } = request.params as { token: string };
      const removed = await deleteDeviceToken(db, userId, token);
      if (!removed) return reply.code(404).send({ error: "Token not found for this user" });
      return { status: "unregistered" };
    },
  );

  app.get(
    "/api/comms/preferences/:userId",
    { schema: getPreferencesSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.params as any;
      const user = (request as any).user;
      if (user.sub !== userId && !["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(user.role)) {
        return reply.status(403).send({ error: "Access denied" });
      }
      return {
        userId,
        email: { enabled: true, digest: "daily", marketing: false },
        push: { enabled: true, sessionReminders: true, progressUpdates: true },
        // SMS is opt-in and only available when a provider is configured.
        sms: { enabled: false, available: isSmsConfigured() },
      };
    },
  );

  app.put(
    "/api/comms/preferences/:userId",
    { schema: updatePreferencesSchema, preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.params as any;
      const user = (request as any).user;
      if (user.sub !== userId && !["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(user.role)) {
        return reply.status(403).send({ error: "Access denied" });
      }
      const prefs = request.body as any;
      return { status: "updated", userId, preferences: prefs };
    },
  );

  app.get(
    "/api/comms/templates",
    { schema: listTemplatesSchema, preHandler: requireAuth },
    async () => {
      return { templates: AVAILABLE_TEMPLATES };
    },
  );

  app.post(
    "/api/comms/internal/mfa-code",
    { schema: internalMfaCodeSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, code, name } = request.body as any;
      if (!to || !code) {
        return reply.code(400).send({ error: "to and code required" });
      }
      if (!isConfigured()) {
        logger.warn({ to }, "MFA code requested but email not configured, code logged for dev");
        return { status: "dev_mode", code };
      }
      const rendered = renderTemplate("mfa_code", { code, name: name || "there" });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "mfa_code",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send MFA code email");
        return reply.code(500).send({ error: "Failed to send MFA code" });
      }
    },
  );

  // ───────── IN-APP NOTIFICATIONS (parent dashboard) ─────────
  // Internal-only create endpoint: called by assessment-svc whenever an
  // IEP-related event fires AND the parent has `inApp: true` in their
  // preferences. The parent dashboard polls the list/unread endpoints
  // below to show an unread badge that decrements when items are viewed.
  app.post(
    "/api/comms/internal/in-app-notify",
    { schema: internalInAppNotifySchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { parentId, learnerId, category, template, title, body, link } =
        (request.body as any) || {};
      if (!parentId || !category || !template || !title) {
        return reply
          .code(400)
          .send({ error: "parentId, category, template and title are required" });
      }
      try {
        const { parentInAppNotifications } = await import("@aivo/db");
        const [row] = await db
          .insert(parentInAppNotifications)
          .values({
            parentId,
            learnerId: learnerId || null,
            category,
            template,
            title: String(title).slice(0, 255),
            body: body ? String(body).slice(0, 4000) : null,
            link: link ? String(link).slice(0, 1024) : null,
          })
          .returning();
        return { status: "created", id: row.id };
      } catch (err: any) {
        logger.error({ err, parentId, template }, "Failed to create in-app notification");
        return reply.code(500).send({ error: "Failed to create in-app notification" });
      }
    },
  );

  // ───────── RECOMMENDATION-PENDING NOTIFY (Sprint 5) ─────────
  // Internal endpoint called by recommendation-svc when new PENDING
  // recommendations are persisted for a learner. Sends the guardian an
  // email (when configured) AND an in-app notification deep-linking to the
  // approval panel. Digest suppression lives HERE, against the durable
  // in-app table: at most one notification per learner per 24h — additional
  // pending recommendations fold into the one the parent already has.
  app.post("/api/comms/internal/recommendation-pending", async (request, reply) => {
    const internalKey = request.headers["x-internal-key"];
    const expectedKey =
      process.env.INTERNAL_SERVICE_KEY ||
      (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
    if (!internalKey || !expectedKey || internalKey !== expectedKey) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const { parentId, parentEmail, learnerId, learnerName, count, topTitle } =
      (request.body as any) || {};
    if (!parentId || !learnerId || !topTitle) {
      return reply.code(400).send({ error: "parentId, learnerId and topTitle are required" });
    }

    const { parentInAppNotifications } = await import("@aivo/db");
    const { and, eq, gte } = await import("drizzle-orm");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db
      .select({ id: parentInAppNotifications.id })
      .from(parentInAppNotifications)
      .where(
        and(
          eq(parentInAppNotifications.parentId, parentId),
          eq(parentInAppNotifications.learnerId, learnerId),
          eq(parentInAppNotifications.template, "recommendation_pending"),
          gte(parentInAppNotifications.createdAt, since),
        ),
      )
      .limit(1);
    if (recent.length > 0) {
      return { status: "suppressed", reason: "digest_24h" };
    }

    const n = Math.max(1, Number(count) || 1);
    const name = learnerName || "your learner";
    const reviewUrl = `${process.env.WEB_APP_URL || "http://localhost:3000"}/parent/learners/${learnerId}#recommendations`;
    const [row] = await db
      .insert(parentInAppNotifications)
      .values({
        parentId,
        learnerId,
        category: "recommendations",
        template: "recommendation_pending",
        title:
          n > 1
            ? `${n} learning recommendations await your approval`
            : `A learning recommendation awaits your approval`,
        body: `Starting with: ${String(topTitle).slice(0, 500)}. Nothing changes until you approve it.`,
        link: `/parent/learners/${learnerId}#recommendations`,
      })
      .returning();

    let emailStatus: string = "skipped";
    if (parentEmail && isConfigured()) {
      const rendered = renderTemplate("recommendation_pending", {
        learnerName: name,
        count: n,
        topTitle,
        reviewUrl,
      });
      try {
        const result = await sendEmail({
          to: parentEmail,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "recommendation_pending",
        });
        emailStatus = result.status;
      } catch (err: any) {
        logger.error({ err, parentId, learnerId }, "recommendation-pending email failed");
        emailStatus = "failed";
      }
    }
    await emitCommsAudit({
      db,
      request,
      eventType: "NOTIFICATION_SENT",
      tenantId: null,
      resourceId: row.id,
      details: { channel: "in_app+email", template: "recommendation_pending", emailStatus },
    });
    return { status: "created", id: row.id, emailStatus };
  });

  // Authenticated reads/writes for the signed-in parent on their own
  // notifications. We never let one user read another's inbox.
  app.get(
    "/api/comms/in-app-notifications",
    { schema: listInAppNotificationsSchema, preHandler: requireAuth },
    async (request) => {
      const user = (request as any).user;
      const { parentInAppNotifications } = await import("@aivo/db");
      const { desc, eq, and, isNull, sql } = await import("drizzle-orm");
      const q = (request.query as any) || {};
      const onlyUnread = q.unread === "true" || q.unread === "1";
      const learnerFilter = typeof q.learnerId === "string" ? q.learnerId : null;
      const where = [eq(parentInAppNotifications.parentId, user.sub)];
      if (onlyUnread) where.push(isNull(parentInAppNotifications.readAt));
      if (learnerFilter) where.push(eq(parentInAppNotifications.learnerId, learnerFilter));
      const items = await db
        .select()
        .from(parentInAppNotifications)
        .where(and(...where))
        .orderBy(desc(parentInAppNotifications.createdAt))
        .limit(100);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(parentInAppNotifications)
        .where(
          and(
            eq(parentInAppNotifications.parentId, user.sub),
            isNull(parentInAppNotifications.readAt),
            ...(learnerFilter ? [eq(parentInAppNotifications.learnerId, learnerFilter)] : []),
          ),
        );
      return { items, unreadCount: count };
    },
  );

  // Mark notifications as read. Pass `{ ids: [...] }` to mark specific
  // rows, or `{ all: true, learnerId? }` to mark every unread notification
  // (optionally scoped to one learner). Always scoped to the caller — no
  // cross-user mutation possible.
  app.post(
    "/api/comms/in-app-notifications/mark-read",
    { schema: markInAppNotificationsReadSchema, preHandler: requireAuth },
    async (request, reply) => {
      const user = (request as any).user;
      const { parentInAppNotifications } = await import("@aivo/db");
      const { eq, and, inArray, isNull } = await import("drizzle-orm");
      const body = (request.body as any) || {};
      const ids: string[] = Array.isArray(body.ids)
        ? body.ids.filter((s: any) => typeof s === "string")
        : [];
      const all = body.all === true;
      const learnerId = typeof body.learnerId === "string" ? body.learnerId : null;
      if (!all && ids.length === 0) {
        return reply.code(400).send({ error: "Provide ids[] or { all: true }" });
      }
      const where = [
        eq(parentInAppNotifications.parentId, user.sub),
        isNull(parentInAppNotifications.readAt),
      ];
      if (!all) where.push(inArray(parentInAppNotifications.id, ids));
      if (learnerId) where.push(eq(parentInAppNotifications.learnerId, learnerId));
      const updated = await db
        .update(parentInAppNotifications)
        .set({ readAt: new Date() })
        .where(and(...where))
        .returning({ id: parentInAppNotifications.id });
      return { status: "ok", updated: updated.length };
    },
  );

  // ── Mobile-shaped aliases ───────────────────────────────────────────
  // The mobile app fetches a flat list by userId and marks a single item
  // read by id. Both read/write the same `parent_in_app_notifications`
  // table as the web in-app routes above; callers may only act on their
  // own rows (the path userId must equal the token subject).

  app.get(
    "/api/comms/notifications/:userId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = (request as any).user;
      const { userId } = request.params as { userId: string };
      if (user.sub !== userId && !["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(user.role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const { parentInAppNotifications } = await import("@aivo/db");
      const { desc, eq } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(parentInAppNotifications)
        .where(eq(parentInAppNotifications.parentId, userId))
        .orderBy(desc(parentInAppNotifications.createdAt))
        .limit(100);
      // Flat shape the mobile useNotifications hook expects.
      return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        body: r.body ?? null,
        readAt: r.readAt instanceof Date ? r.readAt.toISOString() : r.readAt,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        link: r.link ?? null,
      }));
    },
  );

  app.post(
    "/api/comms/notifications/:id/read",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = (request as any).user;
      const { id } = request.params as { id: string };
      const { parentInAppNotifications } = await import("@aivo/db");
      const { and, eq, isNull } = await import("drizzle-orm");
      const updated = await db
        .update(parentInAppNotifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(parentInAppNotifications.id, id),
            eq(parentInAppNotifications.parentId, user.sub),
            isNull(parentInAppNotifications.readAt),
          ),
        )
        .returning({ id: parentInAppNotifications.id });
      return { status: "ok", updated: updated.length };
    },
  );

  app.post(
    "/api/comms/internal/iep-notify",
    { schema: internalIepNotifySchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { template, to, data } = request.body as any;
      const allowed = new Set([
        "iep_in_review_parent",
        "iep_finalised_parent",
        "iep_comment_mention",
        "iep_progress_note",
        "iep_progress_report_sent",
        "iep_amendment_proposed",
        "iep_amendment_acknowledged",
        "iep_review_reminder",
      ]);
      if (!template || !to || !allowed.has(template)) {
        return reply.code(400).send({ error: "template and to required" });
      }
      if (!isConfigured()) {
        logger.warn({ to, template }, "IEP notify requested but email not configured (dev mode)");
        return { status: "dev_mode" };
      }
      const rendered = renderTemplate(template, data || {});
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: template,
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to, template }, "Failed to send IEP notification");
        // Best-effort; do not propagate failure beyond a 200-with-error.
        return { status: "failed" };
      }
    },
  );

  // Sends a "you've been invited to a learning team" email when a parent
  // invites a caregiver / co-parent / teacher / therapist via family-svc.
  // Internal-key auth — same pattern as the other /internal/* endpoints.
  app.post(
    "/api/comms/internal/team-invite",
    { schema: internalTeamInviteSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, inviterName, learnerName, role, acceptUrl } = (request.body as any) || {};
      if (!to || !acceptUrl) {
        return reply.code(400).send({ error: "to and acceptUrl required" });
      }
      if (!isConfigured()) {
        logger.warn({ to, role }, "Team invite requested but email not configured (dev mode)");
        return { status: "dev_mode", acceptUrl };
      }
      const rendered = renderTemplate("collaboration_invite", {
        inviterName: inviterName || "A parent",
        learnerName: learnerName || "their child",
        role: role || "team member",
        acceptUrl,
      });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "collaboration_invite",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send team invite email");
        return { status: "failed" };
      }
    },
  );

  app.post(
    "/api/comms/internal/password-reset",
    { schema: internalPasswordResetSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, resetUrl, name } = request.body as any;
      if (!to || !resetUrl) {
        return reply.code(400).send({ error: "to and resetUrl required" });
      }
      if (!isConfigured()) {
        logger.warn(
          { to },
          "Password reset requested but email not configured, link logged for dev",
        );
        return { status: "dev_mode", resetUrl };
      }
      const rendered = renderTemplate("password_reset", { resetUrl, name: name || "there" });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "password_reset",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send password reset email");
        return reply.code(500).send({ error: "Failed to send password reset" });
      }
    },
  );

  app.post(
    "/api/comms/internal/district-admin-invite",
    { schema: internalDistrictAdminInviteSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, name, districtName, inviteUrl } = request.body as any;
      if (!to || !inviteUrl) {
        return reply.code(400).send({ error: "to and inviteUrl required" });
      }
      if (!isConfigured()) {
        logger.warn(
          { to },
          "District admin invite requested but email not configured, link logged for dev",
        );
        return { status: "dev_mode", inviteUrl };
      }
      const rendered = renderTemplate("district_admin_invite", {
        name: name || "there",
        districtName: districtName || "your district",
        inviteUrl,
      });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "district_admin_invite",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send district admin invite email");
        return reply.code(500).send({ error: "Failed to send invite" });
      }
    },
  );

  app.post(
    "/api/comms/internal/parent-invite",
    { schema: internalParentInviteSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, name, districtName, schoolName, inviteUrl } = request.body as any;
      if (!to || !inviteUrl) {
        return reply.code(400).send({ error: "to and inviteUrl required" });
      }
      if (!isConfigured()) {
        logger.warn(
          { to },
          "Parent invite requested but email not configured, link logged for dev",
        );
        return { status: "dev_mode", inviteUrl };
      }
      const rendered = renderTemplate("parent_invite", {
        name: name || "there",
        districtName: districtName || "your district",
        schoolName: schoolName || "",
        inviteUrl,
      });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "parent_invite",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send parent invite email");
        return reply.code(500).send({ error: "Failed to send invite" });
      }
    },
  );

  app.post(
    "/api/comms/internal/trial-ending",
    { schema: internalTrialEndingSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, name, trialEndDate, daysLeft, renewalUrl, parentId, learnerId } =
        (request.body as any) || {};
      if (!to && !parentId) {
        return reply.code(400).send({ error: "to or parentId required" });
      }

      const rendered = renderTemplate("trial_ending", {
        name: name || "there",
        trialEndDate: trialEndDate || "soon",
        daysLeft,
        renewalUrl: renewalUrl || "#",
      });

      let emailStatus: string | undefined;
      let messageId: string | undefined;
      // Email (best-effort — only when an address is present and email is set up).
      if (to && isConfigured()) {
        try {
          const result = await sendEmail({
            to,
            subject: rendered.subject,
            htmlBody: rendered.html,
            textBody: rendered.text,
            tag: "trial_ending",
          });
          emailStatus = result.status;
          messageId = result.messageId;
        } catch (err: any) {
          logger.error({ err, to }, "Failed to send trial-ending email");
        }
      } else if (to) {
        emailStatus = "dev_mode";
      }

      // In-app notification for the parent (best-effort).
      let inAppId: string | undefined;
      if (parentId) {
        try {
          const { parentInAppNotifications } = await import("@aivo/db");
          const [row] = await db
            .insert(parentInAppNotifications)
            .values({
              parentId,
              learnerId: learnerId || null,
              category: "billing",
              template: "trial_ending",
              title: rendered.subject.slice(0, 255),
              body: `Add a plan to keep your learner's tutors and progress.`,
              link: (renewalUrl || "#").slice(0, 1024),
            })
            .returning();
          inAppId = row?.id;
        } catch (err: any) {
          logger.error({ err, parentId }, "Failed to create trial-ending in-app notification");
        }
      }

      return { status: emailStatus ?? "in_app_only", messageId, inAppId };
    },
  );

  app.post(
    "/api/comms/internal/school-admin-invite",
    { schema: internalSchoolAdminInviteSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, name, schoolName, inviteUrl } = request.body as any;
      if (!to || !inviteUrl) {
        return reply.code(400).send({ error: "to and inviteUrl required" });
      }
      if (!isConfigured()) {
        logger.warn(
          { to },
          "School admin invite requested but email not configured, link logged for dev",
        );
        return { status: "dev_mode", inviteUrl };
      }
      const rendered = renderTemplate("school_admin_invite", {
        name: name || "there",
        schoolName: schoolName || "your school",
        inviteUrl,
      });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "school_admin_invite",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send school admin invite email");
        return reply.code(500).send({ error: "Failed to send invite" });
      }
    },
  );

  app.post(
    "/api/comms/internal/teacher-invite",
    { schema: internalTeacherInviteSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, name, schoolName, inviteUrl } = request.body as any;
      if (!to || !inviteUrl) {
        return reply.code(400).send({ error: "to and inviteUrl required" });
      }
      if (!isConfigured()) {
        logger.warn(
          { to },
          "Teacher invite requested but email not configured, link logged for dev",
        );
        return { status: "dev_mode", inviteUrl };
      }
      const rendered = renderTemplate("teacher_invite", {
        name: name || "there",
        schoolName: schoolName || "your school",
        inviteUrl,
      });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "teacher_invite",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send teacher invite email");
        return reply.code(500).send({ error: "Failed to send invite" });
      }
    },
  );

  app.post(
    "/api/comms/internal/teacher-invite-parent",
    { schema: internalTeacherInviteParentSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, teacherName, schoolName, childName, notes, acceptUrl } = request.body as any;
      if (!to || !acceptUrl) {
        return reply.code(400).send({ error: "to and acceptUrl required" });
      }
      if (!isConfigured()) {
        logger.warn(
          { to },
          "Teacher→parent invite requested but email not configured, link logged for dev",
        );
        return { status: "dev_mode", acceptUrl };
      }
      const rendered = renderTemplate("teacher_invite_parent", {
        teacherName: teacherName || "Your child's teacher",
        schoolName: schoolName || "the school",
        childName: childName || "your child",
        notes,
        acceptUrl,
      });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "teacher_invite_parent",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send teacher→parent invite email");
        return reply.code(500).send({ error: "Failed to send invite" });
      }
    },
  );

  app.post(
    "/api/comms/internal/staff-credentials",
    { schema: internalStaffCredentialsSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, name, roleLabel, schoolName, tempPassword, loginUrl } = request.body as any;
      if (!to || !tempPassword) {
        return reply.code(400).send({ error: "to and tempPassword required" });
      }
      if (!isConfigured()) {
        logger.warn(
          { to },
          "Staff credentials requested but email not configured, link logged for dev",
        );
        return { status: "dev_mode" };
      }
      const rendered = renderTemplate("staff_credentials", {
        name: name || "there",
        roleLabel: roleLabel || "staff member",
        schoolName: schoolName || "your school",
        tempPassword,
        loginUrl: loginUrl || "#",
      });
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "staff_credentials",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send staff credentials email");
        return reply.code(500).send({ error: "Failed to send credentials" });
      }
    },
  );

  app.post(
    "/api/comms/internal/admin-alert",
    { schema: internalAdminAlertSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const body = request.body as any;
      const {
        to,
        severity,
        tutorSku,
        modelUsed,
        learnerId,
        flagReason,
        flagConfidence,
        contentSnippet,
        timestamp,
      } = body || {};
      if (!to || !flagReason) {
        return reply.code(400).send({ error: "to and flagReason required" });
      }
      const subject = `[AIVO Safety ${String(severity || "alert").toUpperCase()}] ${flagReason} flagged on ${tutorSku || "unknown tutor"}`;
      const anonLearner = learnerId
        ? `learner:${String(learnerId).slice(0, 8)}…`
        : "unknown learner";
      const lines = [
        `Severity: ${severity || "high"}`,
        `Time: ${timestamp || new Date().toISOString()}`,
        `Tutor SKU: ${tutorSku || "n/a"}`,
        `Model: ${modelUsed || "n/a"}`,
        `Learner (anonymized): ${anonLearner}`,
        `Flag reason: ${flagReason}`,
        `Confidence: ${flagConfidence != null ? flagConfidence : "n/a"}`,
        ``,
        `--- Content snippet ---`,
        String(contentSnippet || "").slice(0, 500),
      ];
      const text = lines.join("\n");
      const html = `<pre style="font-family:ui-monospace,monospace;font-size:13px;line-height:1.5">${text.replace(/[<>&]/g, (c) => (({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }) as any)[c])}</pre>`;

      if (!isConfigured()) {
        logger.warn(
          { to, flagReason, tutorSku },
          "Admin safety alert (email not configured, logged to stdout)",
        );
        return { status: "logged_only", to, subject };
      }
      try {
        const result = await sendEmail({
          to,
          subject,
          htmlBody: html,
          textBody: text,
          tag: "safety_alert",
        });
        return { status: result.status, messageId: result.messageId, to };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send admin safety alert");
        return reply.code(500).send({ error: "Failed to send admin alert" });
      }
    },
  );

  // ───────── SPEECH BUDDY safety alert (internal) ─────────
  // Called by ai-svc whenever the multi-layer safety filter raises a
  // hard flag (self-harm or abuse-disclosure). The payload deliberately
  // contains NO transcript text — only category, severity, correlation id,
  // anonymised learner hash, and ageBand. The guardian is paged through
  // their preferred channel; on-call moderators are CC'd for self_harm
  // and abuse_disclosure (15-minute SLA per the safety policy).
  app.post(
    "/api/comms/internal/speech-buddy-safety",
    { schema: internalSpeechBuddySafetySchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to, learnerIdHash, category, severity, correlationId, ageBand, raisedAt } =
        (request.body as any) || {};
      if (!category || !correlationId) {
        return reply.code(400).send({ error: "category and correlationId required" });
      }
      const moderatorAddr = process.env.SAFETY_MODERATOR_EMAIL || "safety@aivo.local";
      const guardianAddr = typeof to === "string" && to.length > 0 ? to : null;
      const subject = `[AIVO Speech Buddy] ${String(severity || "hard").toUpperCase()} flag: ${category}`;
      const lines = [
        `Severity: ${severity || "hard"}`,
        `Category: ${category}`,
        `Age band: ${ageBand || "unknown"}`,
        `Learner (anonymised): ${(learnerIdHash || "").toString().slice(0, 16)}…`,
        `Correlation id: ${correlationId}`,
        `Raised at: ${raisedAt || new Date().toISOString()}`,
        ``,
        `This notification deliberately contains NO transcript text.`,
        `A reviewer-role JWT can fetch the redacted transcript on demand using the correlation id.`,
      ];
      const text = lines.join("\n");
      const html = `<pre style="font-family:ui-monospace,monospace;font-size:13px;line-height:1.5">${text.replace(/[<>&]/g, (c) => (({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }) as any)[c])}</pre>`;
      const recipients: string[] = [];
      if (guardianAddr) recipients.push(guardianAddr);
      // Hard flags always page the on-call safety moderator (self_harm /
      // abuse_disclosure / any escalated soft-on-repeat). This guarantees
      // a human is informed even if the guardian email lookup failed.
      if (severity === "hard") recipients.push(moderatorAddr);
      else if (category === "self_harm" || category === "abuse_disclosure")
        recipients.push(moderatorAddr);
      if (!isConfigured() || recipients.length === 0) {
        // Never silently drop a hard flag. Persist to the safety-queue
        // file so an out-of-band cron / on-call sweep can pick it up; if
        // SAFETY_HARD_FLAG_FAIL_FATAL=1 we 500 to force the caller to
        // retry instead of believing delivery succeeded.
        const isHard =
          severity === "hard" || category === "self_harm" || category === "abuse_disclosure";
        if (isHard) {
          try {
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            const dir = process.env.SAFETY_QUEUE_DIR || ".data/safety-queue";
            await fs.mkdir(dir, { recursive: true });
            const file = path.join(dir, `${correlationId}.json`);
            await fs.writeFile(
              file,
              JSON.stringify({
                category,
                severity,
                correlationId,
                ageBand,
                raisedAt,
                learnerIdHash,
                queued_at: new Date().toISOString(),
              }),
            );
            logger.error(
              { file, category, correlationId },
              "Speech Buddy hard flag queued — no recipients/comms unconfigured",
            );
          } catch (qErr) {
            logger.error(
              { err: qErr, category, correlationId },
              "Failed to queue hard flag locally",
            );
          }
          if (process.env.SAFETY_HARD_FLAG_FAIL_FATAL === "1") {
            return reply
              .code(500)
              .send({ error: "no recipients available for hard flag", category, correlationId });
          }
          return reply.code(202).send({ status: "queued", recipients, subject, correlationId });
        }
        logger.warn(
          { recipients, category, severity, correlationId },
          "Speech Buddy safety alert (email not configured or no recipients; logged only)",
        );
        return { status: "logged_only", recipients, subject };
      }
      const results: Array<{ to: string; status: string; messageId?: string; error?: string }> = [];
      for (const addr of recipients) {
        try {
          const r = await sendEmail({
            to: addr,
            subject,
            htmlBody: html,
            textBody: text,
            tag: "speech_buddy_safety",
          });
          results.push({ to: addr, status: r.status, messageId: r.messageId });
        } catch (err: any) {
          logger.error({ err, addr, category }, "Failed to send Speech Buddy safety alert");
          results.push({ to: addr, status: "failed", error: err.message });
        }
      }
      return { status: "ok", results };
    },
  );

  // Sprint 9 — billing alert for district seat-self-service requests.
  // Internal-only; identity-svc calls this when a district admin asks
  // for more seats. Same internal-key auth as the other /internal/*
  // endpoints, dedicated payload shape so we don't piggy-back on the
  // safety-alert handler.
  app.post(
    "/api/comms/internal/billing-alert",
    { schema: internalBillingAlertSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const {
        kind,
        tenantId,
        tenantName,
        currentSeats,
        requestedSeats,
        requesterEmail,
        justification,
        requestId,
      } = (request.body as any) || {};
      if (!kind || !tenantId) {
        return reply.code(400).send({ error: "kind and tenantId required" });
      }
      const to = process.env.BILLING_ALERT_EMAIL || "billing@aivo.local";
      const subject = `[AIVO Billing] ${kind} — ${tenantName || tenantId}`;
      const lines = [
        `Kind: ${kind}`,
        `Tenant: ${tenantName || ""} (${tenantId})`,
        `Requester: ${requesterEmail || "n/a"}`,
        `Current seats: ${currentSeats ?? "n/a"}`,
        `Requested seats: ${requestedSeats ?? "n/a"}`,
        `Request id: ${requestId || "n/a"}`,
        ``,
        `--- Justification ---`,
        String(justification || "").slice(0, 2000),
      ];
      const text = lines.join("\n");
      const html = `<pre style="font-family:ui-monospace,monospace;font-size:13px;line-height:1.5">${text.replace(/[<>&]/g, (c) => (({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }) as any)[c])}</pre>`;
      if (!isConfigured()) {
        logger.warn(
          { to, kind, tenantId, requestId },
          "Billing alert (email not configured, logged to stdout)",
        );
        return { status: "logged_only", to, subject };
      }
      try {
        const result = await sendEmail({
          to,
          subject,
          htmlBody: html,
          textBody: text,
          tag: "billing_alert",
        });
        return { status: result.status, messageId: result.messageId, to };
      } catch (err: any) {
        logger.error({ err, to, kind }, "Failed to send billing alert");
        return reply.code(500).send({ error: "Failed to send billing alert" });
      }
    },
  );

  app.get("/api/comms/status", { schema: commsStatusSchema }, async () => {
    // Sprint 12.7 — replaced `push: "stub"` with real adapter discovery.
    // FCM and APNs are independent; we report each one's configured
    // state. The actual fan-out runs through providers/push-router.ts.
    const fcm = process.env.FCM_SERVICE_ACCOUNT_JSON ? "connected" : "not_configured";
    const apns =
      process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY
        ? "connected"
        : "not_configured";
    const push = fcm === "connected" || apns === "connected" ? "connected" : "not_configured";
    return {
      postmark: isConfigured() ? "connected" : "not_configured",
      push,
      pushDetail: { fcm, apns },
      sms: isSmsConfigured() ? "connected" : "not_configured",
      // Channel registry snapshot — documents every channel as
      // first-class (real vs descoped) so SMS is never a silent stub.
      channels: snapshotChannelStatus(),
    };
  });

  // Sprint 12.7 — outbound push fan-out, durable retry mirroring the
  // email outbox pattern. Bodies pass through the router to FCM/APNs.
  app.post(
    "/api/comms/push/send",
    {
      schema: {
        body: {
          type: "object",
          required: ["targets", "message"],
          properties: {
            targets: {
              type: "array",
              items: {
                type: "object",
                required: ["token", "kind"],
                properties: {
                  token: { type: "string" },
                  kind: { type: "string", enum: ["fcm", "apns"] },
                  topic: { type: "string" },
                },
              },
            },
            message: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string" },
                data: { type: "object", additionalProperties: { type: "string" } },
                collapseId: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { defaultPushRouter } = await import("../providers/push-router.js");
      const { targets, message } = request.body as any;
      try {
        const results = await defaultPushRouter.send(targets, message);
        const invalidTokens = results.filter((r) => r.invalidToken).map((r) => r.token);
        return {
          sent: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          invalidTokens,
          results,
        };
      } catch (err: any) {
        logger.error({ err }, "push fan-out failed");
        return reply.code(500).send({ error: "push_failed" });
      }
    },
  );

  app.post("/api/comms/public/contact", { schema: publicContactSchema }, async (request, reply) => {
    const { name, email, message, source } = request.body as any;
    try {
      const { contactSubmissions } = await import("@aivo/db");
      await db.insert(contactSubmissions).values({
        type: "contact",
        name: name || null,
        email,
        message,
        source: source || "website",
      });
      logger.info({ email, source }, "Contact form submission stored");
      return { success: true };
    } catch (err: any) {
      logger.error({ err }, "Failed to store contact submission");
      return reply.code(500).send({ error: "Failed to submit contact form" });
    }
  });

  app.post(
    "/api/comms/public/demo-request",
    { schema: publicDemoRequestSchema },
    async (request, reply) => {
      const { name, email, company, role, schoolSize, message } = request.body as any;
      try {
        const { contactSubmissions } = await import("@aivo/db");
        await db.insert(contactSubmissions).values({
          type: "demo_request",
          name,
          email,
          company: company || null,
          role: role || null,
          schoolSize: schoolSize || null,
          message: message || null,
          source: "website",
        });
        logger.info({ email, company }, "Demo request stored");
        return { success: true };
      } catch (err: any) {
        logger.error({ err }, "Failed to store demo request");
        return reply.code(500).send({ error: "Failed to submit demo request" });
      }
    },
  );

  app.post(
    "/api/comms/public/newsletter",
    { schema: publicNewsletterSchema },
    async (request, reply) => {
      const { email, source } = request.body as any;
      try {
        const { contactSubmissions } = await import("@aivo/db");
        await db.insert(contactSubmissions).values({
          type: "newsletter",
          email,
          source: source || "footer",
        });
        logger.info({ email }, "Newsletter signup stored");
        return { success: true };
      } catch (err: any) {
        logger.error({ err }, "Failed to store newsletter signup");
        return reply.code(500).send({ error: "Failed to subscribe" });
      }
    },
  );

  // Sends a subscription confirmation email via Postmark.
  // Called by admin-svc after persisting the newsletter lead — internal-key
  // auth matches all other /internal/* endpoints.
  app.post(
    "/api/comms/internal/newsletter-confirm",
    { schema: internalNewsletterConfirmSchema },
    async (request, reply) => {
      const internalKey = request.headers["x-internal-key"];
      const expectedKey =
        process.env.INTERNAL_SERVICE_KEY ||
        (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
      if (!internalKey || !expectedKey || internalKey !== expectedKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { to } = (request.body as any) || {};
      if (!to) {
        return reply.code(400).send({ error: "to is required" });
      }
      if (!isConfigured()) {
        logger.warn({ to }, "Newsletter confirm requested but email not configured (dev mode)");
        return { status: "dev_mode" };
      }
      const rendered = renderTemplate("newsletter_confirmation", {});
      try {
        const result = await sendEmail({
          to,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          tag: "newsletter_confirmation",
        });
        return { status: result.status, messageId: result.messageId };
      } catch (err: any) {
        logger.error({ err, to }, "Failed to send newsletter confirmation email");
        // Fail-soft: subscription is already stored; email failure is non-fatal.
        return { status: "failed" };
      }
    },
  );

  // Outbox health snapshot. Used by the admin console + readiness probes
  // to surface a growing dead_letter or pending backlog.
  app.get("/api/comms/outbox/stats", { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      const counts = await getOutboxCounts(db);
      return { counts };
    } catch (err: any) {
      logger.error({ err }, "failed to read email outbox counts");
      return reply.code(500).send({ error: "outbox_stats_failed" });
    }
  });
}
