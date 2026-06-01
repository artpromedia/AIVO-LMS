import type { FastifyInstance } from "fastify";
import * as jose from "jose";
import { validateLtiLaunch, type LtiLaunchPayload } from "../services/lti13-launch-validator.js";
import { getRemoteJwks } from "../lti/jwks-cache.js";
import { mapLisRolesToAivoRole, type AivoRole } from "../lti/role-mapping.js";
import {
  persistLaunch,
  upsertAgsLineitem,
  UnregisteredPlatformError,
  type LtiDb,
} from "../lti/persistence.js";

/**
 * Sprint 12.7 — LTI 1.3 launch + deep linking + AGS routes.
 *
 * The original `/api/lti/validate` route is kept for the existing
 * fixture-driven contract test. The new endpoints make the validator
 * useful in a real launch: JWKS verification, role mapping, context /
 * resource-link upsert, AGS score write-back.
 *
 * Persistence (Sprint 1 production-readiness): when a Drizzle `db` handle is
 * supplied the launch is written into the migration-0045 tables
 * (lti_platforms → lti_deployments → lti_contexts → lti_resource_links, and
 * lti_ags_lineitems on score write-back). Launches for an unregistered
 * platform are rejected. When no `db` is supplied (unit tests / stateless
 * dev), the route falls back to the original verify-and-redirect behaviour.
 */

interface LaunchClaims extends jose.JWTPayload {
  "https://purl.imsglobal.org/spec/lti/claim/deployment_id"?: string;
  "https://purl.imsglobal.org/spec/lti/claim/message_type"?: string;
  "https://purl.imsglobal.org/spec/lti/claim/version"?: string;
  "https://purl.imsglobal.org/spec/lti/claim/target_link_uri"?: string;
  "https://purl.imsglobal.org/spec/lti/claim/roles"?: string[];
  "https://purl.imsglobal.org/spec/lti/claim/context"?: {
    id?: string;
    label?: string;
    title?: string;
  };
  "https://purl.imsglobal.org/spec/lti/claim/resource_link"?: {
    id?: string;
    title?: string;
  };
  email?: string;
  name?: string;
  nonce?: string;
}

async function verifyLaunchJwt(
  idToken: string,
  platformJwksUrl: string,
  expectedIssuer: string,
  expectedAudience: string,
): Promise<LaunchClaims> {
  const jwks = await getRemoteJwks(platformJwksUrl);
  const { payload } = await jose.jwtVerify(idToken, jwks, {
    issuer: expectedIssuer,
    audience: expectedAudience,
  });
  return payload as LaunchClaims;
}

export function registerLtiRoutes(app: FastifyInstance, db?: LtiDb): void {
  app.post<{
    Body: { payload: LtiLaunchPayload; productionMode?: boolean; trustedIssuers?: string[] };
  }>("/api/lti/validate", async (request, reply) => {
    if (!request.body?.payload) {
      return reply.code(400).send({ error: "payload is required" });
    }
    const result = validateLtiLaunch(request.body.payload, {
      productionMode: request.body.productionMode,
      trustedIssuers: request.body.trustedIssuers
        ? new Set(request.body.trustedIssuers)
        : undefined,
    });
    return result;
  });

  /**
   * POST /api/lti/launch
   *
   * Body:
   *   id_token         — the JWT signed by the LTI platform
   *   state            — opaque value the tool sent during oidc init
   *   platform_jwks_url, issuer, audience — pinned per-platform config
   *   target_link_uri  — where the platform expects the tool to redirect
   *
   * Returns 302 to the deep-linked AIVO lesson with a short-lived AIVO
   * session JWT in the query string.
   */
  app.post<{
    Body: {
      id_token: string;
      state?: string;
      platform_jwks_url: string;
      issuer: string;
      audience: string;
      target_link_uri?: string;
    };
  }>("/api/lti/launch", async (request, reply) => {
    const { id_token, platform_jwks_url, issuer, audience, target_link_uri } = request.body ?? {};
    if (!id_token || !platform_jwks_url || !issuer || !audience) {
      return reply.code(400).send({ error: "missing_launch_parameters" });
    }
    let claims: LaunchClaims;
    try {
      claims = await verifyLaunchJwt(id_token, platform_jwks_url, issuer, audience);
    } catch (err: any) {
      request.log?.warn({ err: err.message }, "LTI launch JWT verify failed");
      return reply.code(401).send({ error: "invalid_id_token", detail: err.message });
    }
    const deploymentId =
      claims["https://purl.imsglobal.org/spec/lti/claim/deployment_id"];
    if (!deploymentId) return reply.code(400).send({ error: "missing_deployment_id" });
    if (!claims.nonce) return reply.code(400).send({ error: "missing_nonce" });

    const roles = claims["https://purl.imsglobal.org/spec/lti/claim/roles"] ?? [];
    const aivoRole: AivoRole = mapLisRolesToAivoRole(roles);
    const context = claims["https://purl.imsglobal.org/spec/lti/claim/context"] ?? {};
    const resourceLink = claims["https://purl.imsglobal.org/spec/lti/claim/resource_link"] ?? {};
    const linkTarget =
      claims["https://purl.imsglobal.org/spec/lti/claim/target_link_uri"] ?? target_link_uri ?? "/";

    // Persist the launch structure when a DB is wired. A launch from a
    // platform AIVO is not registered against is rejected — we never trust
    // an unknown issuer to drive a session.
    let resourceLinkDbId: string | null = null;
    if (db) {
      try {
        const persisted = await persistLaunch(db, {
          issuer,
          clientId: audience,
          deploymentId,
          context,
          resourceLink,
          targetLinkUri: linkTarget,
        });
        resourceLinkDbId = persisted.resourceLinkRowId;
      } catch (err) {
        if (err instanceof UnregisteredPlatformError) {
          request.log?.warn({ issuer, audience }, "LTI launch from unregistered platform");
          return reply.code(403).send({ error: "unregistered_platform" });
        }
        throw err;
      }
    }

    // Issue a short-lived AIVO session token. The launching browser
    // will follow the redirect to the lesson page, which exchanges the
    // token for a normal session cookie. `resourceLinkDbId` lets the lesson
    // runtime address the persisted resource link on AGS score write-back.
    const session = await new jose.SignJWT({
      sub: String(claims.sub ?? `lti:${context.id ?? "anon"}:${resourceLink.id ?? "noLink"}`),
      email: claims.email,
      name: claims.name,
      role: aivoRole,
      lti: {
        issuer,
        deploymentId,
        contextId: context.id,
        contextTitle: context.title,
        resourceLinkId: resourceLink.id,
        resourceLinkDbId,
      },
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.LTI_SESSION_SECRET ?? "lti-launch-dev-secret"));

    const sep = linkTarget.includes("?") ? "&" : "?";
    reply.redirect(`${linkTarget}${sep}aivo_lti_session=${encodeURIComponent(session)}`);
  });

  /**
   * POST /api/lti/deeplinking/select
   *
   * Returns a signed DeepLinkingResponse JWT. The tool builds an
   * auto-submitting form that POSTs this back to the platform's
   * deep_link_return_url.
   */
  app.post<{
    Body: {
      deployment_id: string;
      issuer: string;
      audience: string;
      content_items: Array<{ type: string; url?: string; title?: string }>;
    };
  }>("/api/lti/deeplinking/select", async (request, reply) => {
    const { deployment_id, issuer, audience, content_items } = request.body ?? {};
    if (!deployment_id || !issuer || !audience || !Array.isArray(content_items)) {
      return reply.code(400).send({ error: "missing_parameters" });
    }
    const pem = process.env.LTI_PRIVATE_KEY;
    if (!pem) {
      return reply.code(500).send({ error: "LTI_PRIVATE_KEY not configured" });
    }
    const key = await jose.importPKCS8(pem, "RS256");
    const jwt = await new jose.SignJWT({
      "https://purl.imsglobal.org/spec/lti/claim/deployment_id": deployment_id,
      "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingResponse",
      "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
      "https://purl.imsglobal.org/spec/lti-dl/claim/content_items": content_items,
    })
      .setProtectedHeader({ alg: "RS256", kid: process.env.LTI_KID ?? "aivo-lti-key-1" })
      .setIssuer(audience)
      .setAudience(issuer)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);
    reply.send({ jwt });
  });

  /**
   * POST /api/lti/ags/score
   *
   * Assignment & Grade Services score write-back. AIVO is acting as a
   * tool here so we POST the score to the platform's lineitem URL with
   * a client-credentials access token. The token mint is done by the
   * caller and passed in `access_token`.
   */
  app.post<{
    Body: {
      lineitem_url: string;
      access_token: string;
      score: number;
      max_score: number;
      user_id: string;
      activity_progress?: string;
      grading_progress?: string;
      timestamp?: string;
      /** db id of the resource link this score belongs to (from launch). */
      resource_link_db_id?: string;
      /** human-readable line item label, stored when persisting. */
      lineitem_label?: string;
    };
  }>("/api/lti/ags/score", async (request, reply) => {
    const {
      lineitem_url,
      access_token,
      score,
      max_score,
      user_id,
      activity_progress = "Completed",
      grading_progress = "FullyGraded",
      timestamp = new Date().toISOString(),
      resource_link_db_id,
      lineitem_label,
    } = request.body ?? ({} as any);
    if (!lineitem_url || !access_token || typeof score !== "number") {
      return reply.code(400).send({ error: "missing_parameters" });
    }

    // Track the line item against its resource link so write-back history is
    // queryable. Best-effort: a persistence hiccup must not block the score
    // reaching the platform.
    if (db && resource_link_db_id && typeof max_score === "number") {
      try {
        await upsertAgsLineitem(db, {
          resourceLinkRowId: resource_link_db_id,
          lineitemUrl: lineitem_url,
          scoreMaximum: max_score,
          label: lineitem_label,
        });
      } catch (err: any) {
        request.log?.warn({ err: err?.message }, "AGS lineitem persistence failed");
      }
    }

    const url = `${lineitem_url.replace(/\/$/, "")}/scores`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${access_token}`,
        "content-type": "application/vnd.ims.lis.v1.score+json",
      },
      body: JSON.stringify({
        userId: user_id,
        scoreGiven: score,
        scoreMaximum: max_score,
        activityProgress: activity_progress,
        gradingProgress: grading_progress,
        timestamp,
      }),
    });
    if (!res.ok) {
      return reply.code(res.status).send({ error: "platform_rejected_score", status: res.status });
    }
    reply.send({ ok: true });
  });
}
