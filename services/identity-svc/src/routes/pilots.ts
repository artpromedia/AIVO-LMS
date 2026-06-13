/**
 * Sprint 1 — first-class pilot provisioning.
 *
 *   POST /api/admin/pilots   (PLATFORM_ADMIN + step-up "pilot:create", rate-limited)
 *
 * One auditable action that creates a district tenant AND provisions its pilot
 * entitlement, so a district is born WITH its seat cap + ACTIVE subscription —
 * no human re-keys a coupon. Reuses the district-onboarding primitives and
 * delegates the money/seat write to billing-svc's internal provision endpoint.
 *
 * Ordering is chosen for clean compensation: the bare tenant is inserted, then
 * billing provisions; only on success do we write the `district.created` audit
 * and send the admin invite. If billing fails we delete the bare (un-audited,
 * un-subscribed) tenant — never leaving a district with no entitlement.
 */
import { FastifyInstance } from "fastify";
import { tenants } from "@aivo/db";
import { eq } from "drizzle-orm";
import { requireStepUp } from "./step-up.js";
import { requirePlatformAdmin } from "./admin.js";
import {
  ensureFirstAdminAvailable,
  insertDistrictTenant,
  recordDistrictCreated,
  inviteFirstDistrictAdmin,
  DistrictInviteDeliveryError,
} from "../lib/district-onboarding.js";

const BILLING_SVC_URL = process.env.BILLING_SVC_URL || "http://localhost:3009";
const IS_PROD = process.env.NODE_ENV === "production";

const DEFAULT_SEAT_LIMIT = 50;
const DEFAULT_DURATION_DAYS = 90;
const PILOT_TIER = "enterprise";
// Pilots provision the all-access Enterprise plan (B2B path). Historically
// this was the legacy "district" slug; it is now "enterprise" so the
// subscription's plan is a recognized PlanId and resolves to all tutors
// without relying on the legacy-row fallback.
const PILOT_PLAN = "enterprise";

function internalToken(): string {
  return (
    process.env.INTERNAL_SERVICE_TOKEN ||
    process.env.INTERNAL_SERVICE_KEY ||
    (IS_PROD ? "" : "aivo-internal-dev-token")
  );
}

function clientIp(req: any): string | null {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
}

interface BillingProvisionResult {
  ok: boolean;
  provisioned?: boolean;
  couponCode?: string;
  tier?: string;
  plan?: string;
  seatLimit?: number | null;
  expiresAt?: string | null;
}

export async function registerPilotRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.post(
    "/api/admin/pilots",
    {
      preHandler: [requirePlatformAdmin, requireStepUp("pilot:create")],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
          keyGenerator: (request: any) => request.headers.authorization || request.ip,
        },
      },
      schema: {
        tags: ["Admin"],
        body: {
          type: "object",
          required: ["districtName", "adminName", "adminEmail"],
          properties: {
            districtName: { type: "string", minLength: 1 },
            adminName: { type: "string", minLength: 1 },
            adminEmail: { type: "string", format: "email" },
            seatLimit: { type: "integer", minimum: 1 },
            durationDays: { type: "integer", minimum: 1, maximum: 3650 },
          },
        },
      },
    },
    async (req: any, reply) => {
      const { districtName, adminName, adminEmail, seatLimit, durationDays } = req.body as {
        districtName: string;
        adminName: string;
        adminEmail: string;
        seatLimit?: number;
        durationDays?: number;
      };
      const email = adminEmail.trim().toLowerCase();
      const seatCap =
        Number.isInteger(seatLimit) && (seatLimit as number) > 0
          ? (seatLimit as number)
          : DEFAULT_SEAT_LIMIT;
      const days =
        Number.isInteger(durationDays) && (durationDays as number) > 0
          ? (durationDays as number)
          : DEFAULT_DURATION_DAYS;
      const actor = { sub: req.user.sub, email: req.user.email, role: req.user.role };
      const ip = clientIp(req);
      const userAgent = (req.headers["user-agent"] as string) || null;

      const avail = await ensureFirstAdminAvailable(db, email);
      if (!avail.ok) {
        return reply.status(409).send({ error: avail.error });
      }

      // 1) Bare tenant — no audit yet, so a compensating delete stays legal.
      const tenant = await insertDistrictTenant(db, {
        districtName,
        extraSettings: {
          pilot: {
            seatLimit: seatCap,
            durationDays: days,
            provisionedAt: new Date().toISOString(),
          },
        },
      });

      // 2) Provision the pilot entitlement for the new tenant (server-to-server).
      let pilot: BillingProvisionResult;
      try {
        const res = await fetch(`${BILLING_SVC_URL}/api/billing/internal/pilots/provision`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-service-token": internalToken() },
          body: JSON.stringify({
            tenantId: tenant.id,
            plan: PILOT_PLAN,
            tier: PILOT_TIER,
            seatLimit: seatCap,
            durationDays: days,
            actorUserId: req.user.sub,
          }),
          signal: AbortSignal.timeout(8000),
        });
        const payload = (await res.json().catch(() => ({}))) as BillingProvisionResult;
        if (!res.ok || !payload.ok) {
          await db.delete(tenants).where(eq(tenants.id, tenant.id));
          req.log.error(
            { tenantId: tenant.id, status: res.status, payload },
            "pilot billing provision failed",
          );
          return reply.status(502).send({
            error: "Pilot entitlement provisioning failed. No district was created — try again.",
          });
        }
        pilot = payload;
      } catch (err) {
        await db.delete(tenants).where(eq(tenants.id, tenant.id));
        req.log.error(
          { tenantId: tenant.id, err: String(err) },
          "pilot billing provision unreachable",
        );
        return reply
          .status(502)
          .send({ error: "Billing service unreachable; no district was created. Try again." });
      }

      // 3) Entitlement exists — now write district.created and invite the admin.
      await recordDistrictCreated(db, {
        tenant,
        actor,
        clientIp: ip,
        userAgent,
        details: { seatLimit: seatCap, durationDays: days, couponCode: pilot.couponCode },
      });

      try {
        const { invite, delivery } = await inviteFirstDistrictAdmin(db, {
          tenant,
          adminName,
          adminEmail: email,
          actor,
          clientIp: ip,
          userAgent,
        });
        return {
          district: {
            id: tenant.id,
            name: tenant.name,
            type: tenant.type,
            createdAt: tenant.createdAt,
          },
          invite: { id: invite.id, email: invite.email, expiresAt: invite.expiresAt, ...delivery },
          pilot: {
            plan: pilot.plan,
            tier: pilot.tier,
            seatLimit: pilot.seatLimit ?? seatCap,
            expiresAt: pilot.expiresAt ?? null,
            couponCode: pilot.couponCode,
          },
        };
      } catch (err) {
        if (err instanceof DistrictInviteDeliveryError) {
          // The district IS provisioned/entitled; only the invite email failed.
          // Surface resend guidance — never delete (entitlement must not be lost).
          req.log.error(
            { tenantId: tenant.id, inviteId: err.invite.id },
            "pilot admin invite delivery failed",
          );
          return reply.status(502).send({
            error:
              "Pilot provisioned, but the admin invitation email could not be sent. Resend the invite.",
            district: { id: tenant.id, name: tenant.name, type: tenant.type },
            invite: { id: err.invite.id, email: err.invite.email, expiresAt: err.invite.expiresAt },
            pilot: {
              plan: pilot.plan,
              seatLimit: pilot.seatLimit ?? seatCap,
              expiresAt: pilot.expiresAt ?? null,
              couponCode: pilot.couponCode,
            },
          });
        }
        throw err;
      }
    },
  );
}
