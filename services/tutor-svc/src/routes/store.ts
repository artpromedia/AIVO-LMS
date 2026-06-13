import { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { TUTORS } from "@aivo/brand";
import { tutorSubscriptions } from "@aivo/db";
import { resolveTenantIdForUser } from "../lib/tenant.js";
import {
  buildLearnerEntitlementPayload,
  resolveLearnerForEntitlements,
} from "../lib/learner-entitlements.js";
import {
  getTutorsCatalogSchema,
  getTutorsActiveByUserIdSchema,
  getTutorsEntitlementsByLearnerIdSchema,
  tutorsSubscribeSchema,
  tutorsSubscribeBundleSchema,
  tutorsUnsubscribeSchema,
} from "./schemas.js";

const TUTOR_SKU_MAP: Record<string, string> = {
  nova: "ADDON_TUTOR_MATH",
  sage: "ADDON_TUTOR_ELA",
  spark: "ADDON_TUTOR_SCIENCE",
  chrono: "ADDON_TUTOR_HISTORY",
  pixel: "ADDON_TUTOR_CODING",
  echo: "ADDON_TUTOR_SPEECH",
  harmony: "ADDON_TUTOR_SEL",
  atlas: "ADDON_TUTOR_SOCIAL_STUDIES",
  cadence: "ADDON_TUTOR_ARTS",
  vigor: "ADDON_TUTOR_PE_HEALTH",
  lingua: "ADDON_TUTOR_LANGUAGES",
  forge: "ADDON_TUTOR_STEM_DESIGN",
  compass: "ADDON_TUTOR_LIFE_SKILLS",
  muse: "ADDON_TUTOR_CREATIVE_WRITING",
};

const BUNDLE_PRICING = {
  core7: {
    name: "Core 7",
    price: 1499,
    tutors: ["nova", "sage", "spark", "chrono", "pixel", "echo", "harmony"],
  },
  expansion7: {
    name: "Expansion 7",
    price: 1499,
    tutors: ["atlas", "cadence", "vigor", "lingua", "forge", "compass", "muse"],
  },
  full14: { name: "Full K-12", price: 2499, tutors: Object.keys(TUTOR_SKU_MAP) },
  stem: { name: "STEM Pack", price: 999, tutors: ["nova", "spark", "pixel", "forge"] },
  humanities: { name: "Humanities Pack", price: 999, tutors: ["sage", "chrono", "atlas", "muse"] },
  wellness: { name: "Wellness Pack", price: 999, tutors: ["echo", "harmony", "vigor", "compass"] },
  individual: { name: "Individual Tutor", price: 499, tutors: [] },
};

export function registerStoreRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>,
) {
  app.get("/api/tutors/catalog", { schema: getTutorsCatalogSchema }, async () => {
    const catalog = Object.entries(TUTORS).map(([key, tutor]) => ({
      key,
      sku: TUTOR_SKU_MAP[key],
      name: tutor.name,
      domain: tutor.domain,
      color: tutor.color,
      tier: tutor.tier,
      avatar: tutor.avatar,
      price: tutor.tier === "core" ? 499 : 499,
    }));
    return { tutors: catalog, bundles: BUNDLE_PRICING };
  });

  app.get(
    "/api/tutors/active/:userId",
    { schema: getTutorsActiveByUserIdSchema },
    async (request) => {
      const { userId } = request.params as { userId: string };
      const subs = await db
        .select()
        .from(tutorSubscriptions)
        .where(and(eq(tutorSubscriptions.userId, userId), eq(tutorSubscriptions.status, "active")));
      return subs;
    },
  );

  app.get(
    "/api/tutors/entitlements/:learnerId",
    { schema: getTutorsEntitlementsByLearnerIdSchema },
    async (request, reply) => {
      const { learnerId } = request.params as { learnerId: string };
      const auth = request.auth as { sub?: string; tenantId?: string; role?: string } | undefined;
      const callerTenant = auth?.tenantId || null;
      const callerSub = auth?.sub || null;

      const resolved = await resolveLearnerForEntitlements(db, learnerId, callerTenant, callerSub);
      if ("error" in resolved) {
        if (resolved.error === "not_found") {
          return reply.code(404).send({ error: "learner_not_found", learnerId });
        }
        return reply.code(403).send({ error: "tenant_mismatch", learnerId });
      }

      const payload = await buildLearnerEntitlementPayload(db, {
        learnerId,
        tenantId: resolved.tenantId,
      });
      return payload;
    },
  );

  app.post("/api/tutors/subscribe", { schema: tutorsSubscribeSchema }, async (request, reply) => {
    // User-facing tutor purchases must go through billing-svc so they
    // hit Stripe Checkout. This route is now the internal endpoint used
    // by billing-svc webhook handlers after `customer.subscription.*`
    // events confirm payment; service-token callers only.
    if ((request as any).auth?.role !== "service") {
      return (reply as any).code(403).send({
        error:
          "Tutors are no longer purchased individually — every plan includes all tutors. Subscribe via billing-svc Stripe Checkout.",
      });
    }
    const { userId, tutorSku, tenantId } = request.body as {
      userId: string;
      tutorSku: string;
      tenantId?: string;
    };
    if (!userId || !tutorSku) {
      return reply.code(400).send({ error: "userId and tutorSku required" });
    }

    const existing = await db
      .select()
      .from(tutorSubscriptions)
      .where(
        and(
          eq(tutorSubscriptions.userId, userId),
          eq(tutorSubscriptions.tutorSku, tutorSku),
          eq(tutorSubscriptions.status, "active"),
        ),
      );

    if (existing.length > 0) {
      return reply.code(409).send({ error: "Already subscribed to this tutor" });
    }

    const deactivated = await db
      .select()
      .from(tutorSubscriptions)
      .where(and(eq(tutorSubscriptions.userId, userId), eq(tutorSubscriptions.tutorSku, tutorSku)));

    if (deactivated.length > 0) {
      await db
        .update(tutorSubscriptions)
        .set({ status: "active", activatedAt: new Date(), deactivatedAt: null, graceEndsAt: null })
        .where(eq(tutorSubscriptions.id, deactivated[0].id));
      return { status: "reactivated", subscription: { ...deactivated[0], status: "active" } };
    }

    const resolvedTenantId = await resolveTenantIdForUser(request, db, userId, tenantId);
    if (!resolvedTenantId) {
      return reply.code(400).send({ error: "Unable to resolve tenantId for user" });
    }

    const [sub] = await db
      .insert(tutorSubscriptions)
      .values({
        tenantId: resolvedTenantId,
        userId,
        tutorSku,
        status: "active",
      })
      .returning();

    return { status: "activated", subscription: sub };
  });

  app.post(
    "/api/tutors/subscribe-bundle",
    { schema: tutorsSubscribeBundleSchema },
    async (request, reply) => {
      if ((request as any).auth?.role !== "service") {
        return (reply as any).code(403).send({
          error:
            "Tutor bundles are retired — every plan includes all tutors. Subscribe via billing-svc Stripe Checkout.",
        });
      }
      const { userId, bundleKey, tenantId } = request.body as {
        userId: string;
        bundleKey: string;
        tenantId?: string;
      };
      if (!userId || !bundleKey) {
        return reply.code(400).send({ error: "userId and bundleKey required" });
      }

      const bundle = BUNDLE_PRICING[bundleKey as keyof typeof BUNDLE_PRICING];
      if (!bundle) {
        return reply.code(400).send({ error: "Invalid bundle key" });
      }

      const resolvedTenantId = await resolveTenantIdForUser(request, db, userId, tenantId);
      if (!resolvedTenantId) {
        return reply.code(400).send({ error: "Unable to resolve tenantId for user" });
      }

      const results = [];
      for (const tutorKey of bundle.tutors) {
        const sku = TUTOR_SKU_MAP[tutorKey];
        if (!sku) continue;

        const existing = await db
          .select()
          .from(tutorSubscriptions)
          .where(
            and(
              eq(tutorSubscriptions.userId, userId),
              eq(tutorSubscriptions.tutorSku, sku),
              eq(tutorSubscriptions.status, "active"),
            ),
          );

        if (existing.length > 0) {
          results.push({ sku, status: "already_active" });
          continue;
        }

        const [sub] = await db
          .insert(tutorSubscriptions)
          .values({
            tenantId: resolvedTenantId,
            userId,
            tutorSku: sku,
            status: "active",
          })
          .returning();
        results.push({ sku, status: "activated", subscription: sub });
      }

      return { bundle: bundleKey, results };
    },
  );

  app.post(
    "/api/tutors/unsubscribe",
    { schema: tutorsUnsubscribeSchema },
    async (request, reply) => {
      if ((request as any).auth?.role !== "service") {
        return (reply as any).code(403).send({
          error:
            "Tutors can't be individually removed — they're included with your plan. Manage your subscription via the billing portal.",
        });
      }
      const { userId, tutorSku } = request.body as { userId: string; tutorSku: string };
      if (!userId || !tutorSku) {
        return reply.code(400).send({ error: "userId and tutorSku required" });
      }

      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db
        .update(tutorSubscriptions)
        .set({ status: "grace_period", deactivatedAt: new Date(), graceEndsAt })
        .where(
          and(
            eq(tutorSubscriptions.userId, userId),
            eq(tutorSubscriptions.tutorSku, tutorSku),
            eq(tutorSubscriptions.status, "active"),
          ),
        );

      return { status: "grace_period", graceEndsAt };
    },
  );
}
