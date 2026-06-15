import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import {
  isCommsSvcEnabled,
  getCommsBearer,
  listThreadsSvc,
  createThreadSvc,
} from "@/lib/bff/comms-svc";
import { listThreads, createThread } from "@/lib/db/messages-store";
import { audit } from "@/lib/bff/audit";
import { resolveMessageRecipient } from "@/lib/messaging/contacts";
import { checkComposeRateLimit } from "@/lib/messaging/compose-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    const bearer = await getCommsBearer();
    if (isCommsSvcEnabled() && bearer) {
      const r = await listThreadsSvc(bearer);
      if (!r.ok) {
        return fail(
          {
            ...ERRORS.UPSTREAM_UNAVAILABLE,
            message: r.error,
            status: r.status >= 500 ? 502 : r.status,
          },
          requestId,
        );
      }
      return ok(r.data, requestId);
    }
    return ok({ threads: listThreads(session!.tenantId, session!.userId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/**
 * Compose a new thread (parent → care-team member). Access-controlled: the
 * recipient must be an accepted care-team member of the named learner under
 * this parent. Rate-limited per parent. Dual-path: comms-svc when enabled,
 * else the in-memory store.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;

    const json = (await req.json().catch(() => ({}))) as {
      recipientUserId?: unknown;
      learnerId?: unknown;
      subject?: unknown;
      body?: unknown;
    };
    const recipientUserId = typeof json.recipientUserId === "string" ? json.recipientUserId : "";
    const learnerId = typeof json.learnerId === "string" ? json.learnerId : "";
    const messageBody = typeof json.body === "string" ? json.body.trim() : "";
    const subjectRaw = typeof json.subject === "string" ? json.subject.trim() : "";
    if (!recipientUserId || !learnerId || !messageBody) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "recipientUserId, learnerId and body are required" },
        requestId,
      );
    }
    if (messageBody.length > 4000) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "message is too long" }, requestId);
    }

    // Access control: the recipient must be on this learner's care team.
    const contact = await resolveMessageRecipient(
      session!.userId,
      session!.tenantId,
      recipientUserId,
      learnerId,
    );
    if (!contact) {
      return fail(
        { ...ERRORS.FORBIDDEN_LEARNER, message: "recipient is not on this learner's care team" },
        requestId,
      );
    }

    const rate = checkComposeRateLimit(session!.tenantId, session!.userId);
    if (!rate.ok) {
      return fail(
        {
          ...ERRORS.RATE_LIMITED,
          message: `new-thread limit reached; retry in ${rate.retryAfterSeconds}s`,
        },
        requestId,
      );
    }

    const subject = (subjectRaw || contact.learnerName).slice(0, 200);

    const bearer = await getCommsBearer();
    let threadId: string;
    if (isCommsSvcEnabled() && bearer) {
      const r = await createThreadSvc(bearer, {
        subject,
        participantUserIds: [recipientUserId],
        body: messageBody,
        learnerId,
      });
      if (!r.ok) {
        return fail(
          { ...ERRORS.UPSTREAM_UNAVAILABLE, message: r.error, status: r.status >= 500 ? 502 : r.status },
          requestId,
        );
      }
      threadId = r.data.thread.id;
    } else {
      const created = createThread(session!.tenantId, session!.userId, {
        subject,
        participantUserIds: [recipientUserId],
        body: messageBody,
        learnerId,
      });
      threadId = created.id;
    }

    audit(session, "message.thread.create", requestId, {
      learnerId,
      metadata: { recipientUserId, role: contact.role },
    });
    return ok({ threadId }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
