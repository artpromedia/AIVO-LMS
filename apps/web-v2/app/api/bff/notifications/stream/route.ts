/**
 * Server-Sent Events stream for in-app notifications.
 *
 * Establishes a long-lived SSE connection and forwards newly-created
 * notifications for the signed-in user as `notification` events. Falls
 * back to a periodic `refresh` ping so the client re-syncs even if a
 * new notification is missed (or the in-memory store rolls over in
 * dev). When the connection closes, the interval is cleared.
 */
import { requireSession } from "@/lib/bff/guards";
import { getRequestId } from "@/lib/bff/response";
import { listNotifications } from "@/lib/db/repos";

export const dynamic = "force-dynamic";
// SSE responses must not be cached at any layer.
export const revalidate = 0;

const POLL_MS = 5_000;
// Keep-alive ping cadence; far below most idle proxies' close window.
const KEEPALIVE_MS = 25_000;

export async function GET(req: Request): Promise<Response> {
  const requestId = getRequestId(req);
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;

  const tenantId = session!.tenantId;
  const userId = session!.userId;
  const initial = await listNotifications({ tenantId, userId });
  const seenIds = new Set<string>(initial.map((n) => n.id));

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Initial hello so the client knows the channel is live.
      send("hello", { ok: true, requestId });

      const pollHandle = setInterval(() => {
        listNotifications({ tenantId, userId })
          .then((current) => {
            for (const n of current) {
              if (seenIds.has(n.id)) continue;
              seenIds.add(n.id);
              send("message", { type: "notification", item: n });
            }
          })
          .catch(() => {
            // Swallow: the next tick will retry. Don't close the stream
            // for transient errors.
          });
      }, POLL_MS);

      const keepaliveHandle = setInterval(() => {
        // Comment lines are valid SSE keep-alive pings.
        controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
      }, KEEPALIVE_MS);

      const onAbort = () => {
        clearInterval(pollHandle);
        clearInterval(keepaliveHandle);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", onAbort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-request-id": requestId,
    },
  });
}
