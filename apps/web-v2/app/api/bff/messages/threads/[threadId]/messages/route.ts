import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import {
  isCommsSvcEnabled,
  getCommsBearer,
  getThreadMessagesSvc,
  sendMessageSvc,
} from "@/lib/bff/comms-svc";
import { getThreadMessages, sendMessage } from "@/lib/db/messages-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ threadId: string }> };

function upstreamFail(requestId: string, status: number, message: string) {
  return fail(
    { ...ERRORS.UPSTREAM_UNAVAILABLE, message, status: status >= 500 ? 502 : status },
    requestId,
  );
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { threadId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    const bearer = await getCommsBearer();
    if (isCommsSvcEnabled() && bearer) {
      const r = await getThreadMessagesSvc(bearer, threadId);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
      return ok(r.data, requestId);
    }
    const data = getThreadMessages(threadId, session!.tenantId, session!.userId);
    if (!data) return fail({ ...ERRORS.NOT_FOUND, message: "Thread not found." }, requestId);
    return ok(data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const postSchema = z.object({ body: z.string().min(1).max(5000) });

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { threadId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "Message body is required." }, requestId);
    }

    const bearer = await getCommsBearer();
    if (isCommsSvcEnabled() && bearer) {
      const r = await sendMessageSvc(bearer, threadId, parsed.data.body);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
      return ok(r.data, requestId);
    }
    const message = sendMessage(threadId, session!.tenantId, session!.userId, parsed.data.body);
    if (!message) return fail({ ...ERRORS.NOT_FOUND, message: "Thread not found." }, requestId);
    return ok({ message }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
