/**
 * Sprint 10 — `Deprecation` + `Sunset` headers (RFC 8594 / draft-ietf-httpapi-deprecation).
 *
 * Used to signal that legacy identity-svc admin reads have moved to
 * admin-svc. The headers are advisory; clients can keep calling these
 * paths until the sunset date, after which we remove them.
 *
 * `link` lets us point callers at the canonical replacement (per
 * `rel=successor-version` in the deprecation draft).
 */
import { FastifyReply } from "fastify";

const DEFAULT_SUNSET_DAYS = 90;

export function deprecateRoute(opts: { successor: string; sunsetDays?: number }) {
  const days = opts.sunsetDays ?? DEFAULT_SUNSET_DAYS;
  const sunset = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  return async (_req: any, reply: FastifyReply) => {
    reply.header("Deprecation", "true");
    reply.header("Sunset", sunset);
    reply.header("Link", `<${opts.successor}>; rel="successor-version"`);
  };
}
