/**
 * Sprint 13 — message attachment routes.
 *
 *   POST /api/comms/messages/:id/attachments
 *     Records an attachment row with sanitizer_status='pending' and
 *     returns a presigned upload URL. Real S3/GCS presign lives in
 *     @aivo/storage; here we surface a stub that production overrides
 *     via STORAGE_SIGNER_URL.
 *
 *   POST /api/comms/sanitizer/webhook
 *     Called by the file-sanitizer worker with the result of an AV /
 *     content scan. Flips the row to 'clean' or 'rejected'.
 */
import type { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { createHmac, timingSafeEqual } from "node:crypto";
import { messageAttachments, messages, messageThreads } from "@aivo/db";
import { eq } from "drizzle-orm";
import { booleanFromEnv, ENTERPRISE_FLAG_ENV_VARS } from "@aivo/feature-flags";
import {
  canPostToThread,
  type MessageThreadRow,
  type PolicyActor,
  type ThreadKind,
} from "../policy/visibility.js";
import { buildPolicyContext } from "../policy/context.js";
import { emitCommsAudit } from "../lib/audit.js";

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

function actorFromRequest(req: any): PolicyActor {
  const u = req.user ?? {};
  return {
    userId: String(u.sub ?? ""),
    tenantId: String(u.tenantId ?? req.headers["x-active-tenant"] ?? ""),
    role: String(u.role ?? "").toLowerCase(),
  };
}

function rowToThread(r: any): MessageThreadRow {
  return {
    id: r.id,
    kind: r.kind as ThreadKind,
    tenantId: r.tenantId,
    learnerId: r.learnerId ?? null,
    lessonId: r.lessonId ?? null,
    createdBy: r.createdBy,
    archivedAt: r.archivedAt ?? null,
  };
}

function flagEnabled(): boolean {
  return booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.messaging, false);
}

function verifySanitizerSignature(rawBody: string, header: string | undefined): boolean {
  const secret = process.env.SANITIZER_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function registerAttachmentRoutes(app: FastifyInstance, db: any) {
  app.post(
    "/api/comms/messages/:id/attachments",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!flagEnabled()) return reply.code(404).send({ error: "messaging_disabled" });
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as {
        mimeType?: string;
        sizeBytes?: number;
        filename?: string;
      };
      if (!body.mimeType || typeof body.sizeBytes !== "number") {
        return reply.code(400).send({ error: "mimeType_and_sizeBytes_required" });
      }
      const actor = actorFromRequest(request);
      const [msg] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
      if (!msg) return reply.code(404).send({ error: "not_found" });
      const [threadRow] = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.id, msg.threadId))
        .limit(1);
      if (!threadRow) return reply.code(404).send({ error: "thread_not_found" });
      const ctx = buildPolicyContext(db);
      const decision = await canPostToThread(actor, rowToThread(threadRow), ctx);
      if (!decision.allowed) {
        return reply.code(403).send({ error: "forbidden", reason: decision.reason });
      }

      // Stubbed storage URL — production builds wire @aivo/storage to
      // produce a real S3/GCS presigned PUT. Returning a placeholder keeps
      // the API contract stable so the frontend can ship in parallel.
      const objectKey = `messages/${msg.id}/${crypto.randomUUID()}-${(body.filename ?? "file").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageUrl = `${process.env.STORAGE_BASE_URL ?? "https://storage.local"}/${objectKey}`;

      const [row] = await db
        .insert(messageAttachments)
        .values({
          messageId: msg.id,
          storageUrl,
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes,
          sanitizerStatus: "pending",
        })
        .returning();

      await emitCommsAudit({
        db,
        request,
        eventType: "NOTIFICATION_QUEUED",
        tenantId: actor.tenantId,
        resourceId: row.id,
        details: { op: "attachment_uploaded", mimeType: body.mimeType, sizeBytes: body.sizeBytes },
      });

      // The real presign hits @aivo/storage; for now we hand back the URL
      // and let the caller PUT directly with the auth header it already has.
      return reply.code(201).send({
        attachment: row,
        uploadUrl: storageUrl,
        method: "PUT",
        headers: { "x-amz-meta-sanitizer": "pending" },
      });
    },
  );

  // Sanitizer webhook — flips sanitizer_status to clean | rejected.
  // No JWT here; this comes from the internal sanitizer worker via a
  // shared HMAC secret.
  app.post(
    "/api/comms/sanitizer/webhook",
    { config: { rawBody: true } },
    async (request, reply) => {
      const sigHeader = request.headers["x-sanitizer-signature"] as string | undefined;
      const raw = (request as any).rawBody as string | undefined;
      const bodyText = raw ?? JSON.stringify(request.body ?? {});
      if (!verifySanitizerSignature(bodyText, sigHeader)) {
        return reply.code(403).send({ error: "invalid_signature" });
      }
      const body = (request.body ?? {}) as {
        attachmentId?: string;
        status?: "clean" | "rejected";
        reason?: string;
      };
      if (!body.attachmentId || (body.status !== "clean" && body.status !== "rejected")) {
        return reply.code(400).send({ error: "attachmentId_and_status_required" });
      }
      const [updated] = await db
        .update(messageAttachments)
        .set({ sanitizerStatus: body.status })
        .where(eq(messageAttachments.id, body.attachmentId))
        .returning();
      if (!updated) return reply.code(404).send({ error: "not_found" });
      await emitCommsAudit({
        db,
        request,
        eventType: "NOTIFICATION_QUEUED",
        tenantId: null,
        resourceId: body.attachmentId,
        details: { op: "sanitizer_result", status: body.status, reason: body.reason },
      });
      return reply.send({ status: "ok", attachment: updated });
    },
  );
}
