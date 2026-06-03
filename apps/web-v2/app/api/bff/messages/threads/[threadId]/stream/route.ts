/**
 * BFF SSE proxy for `services/comms-svc` inbox streams.
 *
 * Browsers' EventSource is same-origin and can't attach a custom
 * Authorization header — so the BFF holds the service bearer, opens the
 * upstream SSE socket, and pipes the byte stream straight back to the
 * caller without buffering. The response is a streaming Web Response so
 * Next.js (Node runtime) hands the upstream `ReadableStream` to the
 * client in real time.
 *
 * Polling on the JSON endpoint
 * (`/api/bff/messages/threads/[threadId]/messages`) remains the
 * documented fallback: when this stream errors or the server isn't
 * configured for service-stack mode the client keeps its visibility-aware
 * `setInterval` running.
 */
import { requireSession } from "@/lib/bff/guards";
import { getCommsBearer, isCommsSvcEnabled } from "@/lib/bff/comms-svc";
import { serverEnv } from "@/lib/env";
import { getRequestId } from "@/lib/bff/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ threadId: string }> };

function sseError(status: number, message: string): Response {
  return new Response(`event: error\ndata: ${JSON.stringify({ status, message })}\n\n`, {
    status,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { threadId } = await params;
  const requestId = getRequestId(req);

  // Reuse the JSON BFF's session contract — same cookie, same shape, same
  // failure mode. `requireSession` returns a `response` on auth failure
  // that we just forward as-is (it'll be a JSON 401 — the client treats
  // any non-200 here as "fall back to polling").
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  if (!session) return sseError(401, "unauthorized");

  if (!isCommsSvcEnabled()) {
    // No real backend to stream from — tell the client up front so it
    // commits to the polling fallback instead of reconnecting forever.
    return sseError(503, "comms-svc disabled");
  }
  const bearer = await getCommsBearer();
  if (!bearer) return sseError(401, "no bearer");

  let upstream: Response;
  try {
    upstream = await fetch(
      `${serverEnv.COMMS_SVC_URL}/api/comms/threads/${encodeURIComponent(threadId)}/stream`,
      {
        method: "GET",
        headers: {
          authorization: bearer,
          accept: "text/event-stream",
          ...(serverEnv.COMMS_SVC_SERVICE_TOKEN
            ? { "x-service-token": serverEnv.COMMS_SVC_SERVICE_TOKEN }
            : {}),
        },
        // Do NOT set a timeout / cache here — this is a long-lived stream.
      },
    );
  } catch (err) {
    return sseError(502, `upstream unreachable: ${(err as Error).message}`);
  }

  if (!upstream.ok || !upstream.body) {
    return sseError(upstream.status || 502, `upstream ${upstream.status}`);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
