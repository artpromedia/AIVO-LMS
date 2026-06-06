/**
 * Platform-admin coupon proxy.
 *
 * billing-svc owns `billing_coupons` (the canonical store) and all coupon
 * validation, audit, and metrics. admin-svc is the BFF the admin app talks to,
 * so these routes simply forward platform-admin coupon CRUD to billing-svc with
 * the caller's Bearer token. We keep a single source of truth: no coupon
 * business logic lives here.
 *
 *   GET    /api/admin-svc/billing/coupons          -> billing-svc list
 *   GET    /api/admin-svc/billing/coupons/:code     -> billing-svc detail
 *   POST   /api/admin-svc/billing/coupons          -> billing-svc create
 *   DELETE /api/admin-svc/billing/coupons/:code     -> billing-svc disable
 *
 * Every route is gated by requirePlatformAdmin (strict PLATFORM_ADMIN); the
 * upstream billing-svc enforces the same, so non-platform roles get 403 at
 * both hops.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requirePlatformAdmin } from "../lib/auth.js";

const IS_PROD = process.env.NODE_ENV === "production";

function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`admin-svc: ${name} must be set in production`);
  return devDefault;
}

const BILLING_URL = requireUrl("BILLING_SVC_URL", "http://localhost:3009");

async function proxyToBilling(
  req: FastifyRequest,
  reply: FastifyReply,
  downstreamPath: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown,
): Promise<void> {
  const url = new URL(downstreamPath, BILLING_URL);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        authorization: (req.headers.authorization as string) ?? "",
        "content-type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch (e: unknown) {
    req.log?.error(
      { err: (e as Error)?.message, downstreamPath },
      "billing-svc coupon proxy failed",
    );
    return reply.status(502).send({ error: "upstream_unavailable" });
  }

  // Pass billing-svc's status + body through verbatim so the admin app can map
  // the canonical error codes (invalid_code, invalid_discount, duplicate_code,
  // *_missing_* …) to friendly messages.
  reply.status(res.status);
  const ct = res.headers.get("content-type");
  if (ct) reply.header("content-type", ct);
  return reply.send(await res.text());
}

export function registerBillingCouponRoutes(app: FastifyInstance): void {
  app.get("/api/admin-svc/billing/coupons", async (req, reply) => {
    if (!(await requirePlatformAdmin(req, reply))) return;
    return proxyToBilling(req, reply, "/api/billing/admin/coupons", "GET");
  });

  app.get("/api/admin-svc/billing/coupons/:code", async (req, reply) => {
    if (!(await requirePlatformAdmin(req, reply))) return;
    const { code } = req.params as { code: string };
    return proxyToBilling(
      req,
      reply,
      `/api/billing/admin/coupons/${encodeURIComponent(code)}`,
      "GET",
    );
  });

  app.post("/api/admin-svc/billing/coupons", async (req, reply) => {
    if (!(await requirePlatformAdmin(req, reply))) return;
    return proxyToBilling(req, reply, "/api/billing/admin/coupons", "POST", req.body ?? {});
  });

  app.delete("/api/admin-svc/billing/coupons/:code", async (req, reply) => {
    if (!(await requirePlatformAdmin(req, reply))) return;
    const { code } = req.params as { code: string };
    return proxyToBilling(
      req,
      reply,
      `/api/billing/admin/coupons/${encodeURIComponent(code)}`,
      "DELETE",
    );
  });
}
