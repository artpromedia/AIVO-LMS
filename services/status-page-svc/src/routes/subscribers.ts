/**
 * Subscribers: email / webhook / RSS (Sprint 8).
 *   GET    /api/statuspage/subscribers
 *   POST   /api/statuspage/subscribers            (any admin or self-serve)
 *   DELETE /api/statuspage/subscribers/:id
 *   GET    /api/statuspage/rss                     public RSS feed of incidents
 */
import type { FastifyInstance } from "fastify";
import { getStatusStore, spId } from "../statuspage/store.js";
import type { Subscriber, SubscriberChannel } from "../statuspage/types.js";

const CHANNELS: SubscriberChannel[] = ["email", "webhook", "rss"];

function escapeXml(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );
}

export function registerSubscriberRoutes(app: FastifyInstance): void {
  const base = "/api/statuspage/subscribers";

  app.get(base, async () => {
    const store = getStatusStore();
    // Never echo raw targets in bulk; mask for privacy.
    const subscribers = [...store.subscribers.values()].map((s) => ({
      ...s,
      target: s.channel === "email" ? s.target.replace(/(.).*(@.*)/, "$1***$2") : s.target,
    }));
    return { subscribers };
  });

  app.post<{ Body: Partial<Subscriber> }>(base, async (request, reply) => {
    const b = request.body ?? {};
    if (!b.channel || !CHANNELS.includes(b.channel)) {
      return reply.code(400).send({ error: `channel must be one of ${CHANNELS.join(", ")}` });
    }
    if (!b.target) return reply.code(400).send({ error: "target is required" });
    const store = getStatusStore();
    const subscriber: Subscriber = {
      id: spId("sub"),
      channel: b.channel,
      target: b.target,
      componentIds: b.componentIds ?? [],
      tenantId: b.tenantId ?? null,
      createdAt: new Date().toISOString(),
    };
    store.subscribers.set(subscriber.id, subscriber);
    return reply.code(201).send({ subscriber: { ...subscriber } });
  });

  app.delete<{ Params: { id: string } }>(`${base}/:id`, async (request, reply) => {
    const store = getStatusStore();
    if (!store.subscribers.delete(request.params.id)) {
      return reply.code(404).send({ error: "Subscriber not found" });
    }
    return { removed: true };
  });

  // Public RSS feed (no auth) of recent incidents.
  app.get("/api/statuspage/rss", async (_request, reply) => {
    const store = getStatusStore();
    const incidents = [...store.incidents.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);
    const items = incidents
      .map(
        (i) =>
          `<item><title>${escapeXml(i.title)}</title>` +
          `<description>${escapeXml(i.lifecycle)} — impact ${escapeXml(i.impact)}</description>` +
          `<pubDate>${new Date(i.createdAt).toUTCString()}</pubDate>` +
          `<guid isPermaLink="false">${i.id}</guid></item>`,
      )
      .join("");
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>` +
      `<title>AIVO Status</title><link>https://status.aivo.example</link>` +
      `<description>AIVO platform incident feed</description>${items}</channel></rss>`;
    reply.header("content-type", "application/rss+xml; charset=utf-8");
    return xml;
  });
}
