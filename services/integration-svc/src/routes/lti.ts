import type { FastifyInstance } from "fastify";
import * as jose from "jose";
import { validateLtiLaunch, type LtiLaunchPayload } from "../services/lti13-launch-validator.js";
import { getRemoteJwks } from "../lti/jwks-cache.js";
import { mapLisRolesToAivoRole, type AivoRole } from "../lti/role-mapping.js";

/**
 * Sprint 12.7 — LTI 1.3 launch + deep linking + AGS routes.
 *
 * The original `/api/lti/validate` route is kept for the existing
 * fixture-driven contract test. The new endpoints make the validator
 * useful in a real launch: JWKS verification, role mapping, context /
 * resource-link upsert, AGS score write-back.
 *
 * Persistence is intentionally minimal here — we surface the structured
 * launch into a session token and let the downstream learning runtime
 * persist context membership. A future sprint will wire the
 * lti_contexts / lti_resource_links / lti_ags_lineitems tables
 * (migration 0045) directly.
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

export function registerLtiRoutes(app: FastifyInstance): void {
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

    // Issue a short-lived AIVO session token. The launching browser
    // will follow the redirect to the lesson page, which exchanges the
    // token for a normal session cookie.
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
    } = request.body ?? ({} as any);
    if (!lineitem_url || !access_token || typeof score !== "number") {
      return reply.code(400).send({ error: "missing_parameters" });
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
