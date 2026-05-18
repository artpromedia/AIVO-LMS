/**
 * Step-up authentication routes (Sprint 3).
 *
 * Two endpoints:
 *   POST /api/auth/step-up/initiate  → returns { factor, challengeToken, ... }
 *   POST /api/auth/step-up/verify    → returns { stepUpToken }
 *
 * Plus the `requireStepUp(scope)` Fastify preHandler factory used by routes
 * that perform destructive or sensitive operations.
 */
import { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import {
  signJWT,
  verifyJWT,
  hashOtpCode,
  ADMIN_ENTERPRISE,
  STEP_UP_SCOPES,
  type StepUpScope,
  type StepUpJWT,
  type JWTPayload,
  type WebauthnChallengeJWT,
} from "@aivo/security";
import { users, mfaCodes, webauthnCredentials, auditEvents, appendAudit } from "@aivo/db";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import {
  selectFactor,
  issueStepUpChallenge,
  verifyStepUpChallengeToken,
  issueStepUpToken,
  verifyTotpForUser,
  verifyEmailOtpForUser,
  verifyRecoveryCodeForUser,
  checkAndConsumeJti,
} from "../services/step-up.js";
import { isMfaLocked, recordMfaFailure, clearMfaFailures } from "../services/mfa-lockout.js";
import {
  getRpId,
  getExpectedOrigin,
  signWebauthnChallenge,
  verifyWebauthnChallengeToken,
} from "../services/mfa-webauthn.js";
import { authStepUpVerifyInternalSchema } from "./schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`identity-svc: ${name} must be set in production`);
  return devDefault;
}
const COMMS_URL = requireUrl("COMMS_SVC_URL", "http://localhost:3010");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

function isValidScope(s: unknown): s is StepUpScope {
  return typeof s === "string" && (STEP_UP_SCOPES as readonly string[]).includes(s);
}

async function requireUserFromBearer(req: any, reply: any): Promise<JWTPayload | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return null;
  }
  try {
    return await verifyJWT(auth.slice(7));
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return null;
  }
}

/**
 * Build a step-up preHandler. Routes wired via `{ preHandler: requireStepUp("user:delete") }`
 * receive a 403 with `{ error, code: "STEP_UP_REQUIRED", scope }` when the
 * `x-step-up-token` header is missing/invalid/expired/wrong-scope, so the
 * web client can intercept and run the challenge UI.
 *
 * When `ADMIN_ENTERPRISE.STEP_UP_AUTH` is `false` the preHandler is a no-op
 * — this keeps the rollout gated and lets us land enforcement code ahead
 * of the flag flip.
 */
export function requireStepUp(scope: StepUpScope) {
  return async function stepUpPreHandler(req: any, reply: any) {
    if (!ADMIN_ENTERPRISE.STEP_UP_AUTH) return; // flag-gated rollout

    const callerSub: string | undefined = req.user?.sub;
    if (!callerSub) {
      // Defensive: requireAdmin / requirePlatformAdmin must run first and
      // populate req.user. If we get here without it, fail closed.
      return reply.status(401).send({ error: "Unauthenticated", code: "STEP_UP_REQUIRED", scope });
    }

    const token = (req.headers["x-step-up-token"] || "") as string;
    if (!token) {
      return reply.status(403).send({ error: "Step-up required", code: "STEP_UP_REQUIRED", scope });
    }

    let claims: StepUpJWT;
    try {
      claims = await verifyJWT<StepUpJWT>(token);
    } catch {
      return reply
        .status(403)
        .send({ error: "Step-up token invalid or expired", code: "STEP_UP_REQUIRED", scope });
    }
    if (claims.purpose !== "step-up") {
      return reply
        .status(403)
        .send({ error: "Wrong token purpose", code: "STEP_UP_REQUIRED", scope });
    }
    if (claims.sub !== callerSub) {
      return reply
        .status(403)
        .send({ error: "Step-up token subject mismatch", code: "STEP_UP_REQUIRED", scope });
    }
    if (claims.scope !== scope) {
      return reply
        .status(403)
        .send({ error: "Step-up token scope mismatch", code: "STEP_UP_REQUIRED", scope });
    }
    // Single-use replay protection. Tokens issued before the jti rollout (no
    // jti claim) are rejected outright once flagged on, forcing a fresh
    // challenge — an acceptable one-time UX cost for the security gain.
    if (!claims.jti) {
      return reply
        .status(403)
        .send({ error: "Step-up token missing jti", code: "STEP_UP_REQUIRED", scope });
    }
    if (checkAndConsumeJti(claims.jti)) {
      return reply
        .status(403)
        .send({ error: "Step-up token already used", code: "STEP_UP_REQUIRED", scope });
    }
    (req as any).stepUp = claims;
  };
}

function maskEmail(e: string | undefined | null): string {
  if (!e) return "";
  const [local, domain] = e.split("@");
  if (!domain) return e;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

async function sendStepUpEmailOtp(
  db: any,
  userId: string,
  email: string,
  name: string | null,
): Promise<void> {
  // Invalidate any prior step-up codes; step-up codes never share rows with login codes thanks to the `purpose` discriminator.
  await db
    .delete(mfaCodes)
    .where(and(eq(mfaCodes.userId, userId), eq(mfaCodes.purpose, "step-up")));
  const code = crypto.randomInt(100000, 999999).toString();
  await db.insert(mfaCodes).values({
    userId,
    codeHash: hashOtpCode(code),
    purpose: "step-up",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  const r = await fetch(`${COMMS_URL}/api/comms/internal/mfa-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
    body: JSON.stringify({ to: email, code, name: name ?? "" }),
  }).catch(() => null);
  if (!r || !r.ok) {
    throw new Error("Failed to send step-up email code");
  }
}

export async function registerStepUpRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.post(
    "/api/auth/step-up/initiate",
    {
      schema: {
        tags: ["Step-up"],
        body: {
          type: "object",
          required: ["scope"],
          properties: {
            scope: { type: "string" },
            factor: { type: "string", enum: ["webauthn", "totp", "email"] },
          },
        },
      },
    },
    async (req, reply) => {
      const caller = await requireUserFromBearer(req, reply);
      if (!caller) return;
      const { scope, factor: requested } = req.body as {
        scope: string;
        factor?: "webauthn" | "totp" | "email";
      };
      if (!isValidScope(scope)) return reply.status(400).send({ error: "Unknown scope" });

      if (await isMfaLocked(db, caller.sub)) {
        return reply.status(429).send({ error: "Account temporarily locked" });
      }

      const [u] = await db
        .select({ email: users.email, name: users.name, totp: users.totpSecretEncrypted })
        .from(users)
        .where(eq(users.id, caller.sub))
        .limit(1);
      if (!u) return reply.status(404).send({ error: "User not found" });

      const strongest = await selectFactor(db, caller.sub);
      if (!strongest) return reply.status(400).send({ error: "No factor available" });

      // Caller may downgrade (e.g. choose TOTP when both passkey+TOTP exist) but
      // cannot upgrade past what they actually enrolled.
      let factor: "webauthn" | "totp" | "email" = strongest;
      if (requested === "webauthn" && strongest === "webauthn") factor = "webauthn";
      else if (requested === "totp" && (strongest === "webauthn" || strongest === "totp") && u.totp)
        factor = "totp";
      else if (requested === "email" && u.email) factor = "email";

      const { challengeToken, nonce } = await issueStepUpChallenge(
        { sub: caller.sub, tenantId: caller.tenantId, role: caller.role, email: caller.email },
        scope,
        factor,
      );

      if (factor === "webauthn") {
        const creds = await db
          .select({
            credentialId: webauthnCredentials.credentialId,
            transports: webauthnCredentials.transports,
          })
          .from(webauthnCredentials)
          .where(eq(webauthnCredentials.userId, caller.sub));
        const options = await generateAuthenticationOptions({
          rpID: getRpId(req as any),
          timeout: 60_000,
          userVerification: "preferred",
          allowCredentials: creds.map((c: any) => ({
            id: c.credentialId,
            transports: c.transports ? c.transports.split(",") : undefined,
          })),
          challenge: Buffer.from(nonce, "base64url"),
        });
        // Re-use the existing webauthn challenge envelope so we can call
        // verifyAuthenticationResponse with the same expectedChallenge format
        // already battle-tested in the login flow.
        const webauthnChallengeToken = await signWebauthnChallenge({
          userId: caller.sub,
          challenge: options.challenge,
          purpose: "login",
        });
        return { factor, challengeToken, webauthn: { options, webauthnChallengeToken } };
      }

      if (factor === "totp") {
        return { factor, challengeToken };
      }

      // email factor
      try {
        await sendStepUpEmailOtp(db, caller.sub, u.email, u.name);
      } catch {
        return reply.status(502).send({ error: "Failed to send step-up code" });
      }
      return { factor, challengeToken, email: { sentTo: maskEmail(u.email) } };
    },
  );

  app.post(
    "/api/auth/step-up/verify",
    {
      schema: {
        tags: ["Step-up"],
        body: {
          type: "object",
          required: ["challengeToken"],
          properties: {
            challengeToken: { type: "string" },
            totpCode: { type: "string" },
            emailCode: { type: "string" },
            recoveryCode: { type: "string" },
            webauthnResponse: { type: "object" },
            webauthnChallengeToken: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const caller = await requireUserFromBearer(req, reply);
      if (!caller) return;
      const body = req.body as any;
      const { challengeToken } = body;

      if (await isMfaLocked(db, caller.sub)) {
        return reply.status(429).send({ error: "Account temporarily locked" });
      }

      let claims;
      try {
        claims = await verifyJWT(challengeToken);
      } catch {
        return reply.status(400).send({ error: "Challenge expired or invalid" });
      }
      const challenge = claims as any;
      if (challenge.purpose !== "step-up-challenge") {
        return reply.status(400).send({ error: "Wrong challenge purpose" });
      }
      if (challenge.sub !== caller.sub) {
        return reply.status(400).send({ error: "Challenge subject mismatch" });
      }
      if (!isValidScope(challenge.scope)) {
        return reply.status(400).send({ error: "Unknown scope" });
      }

      let ok = false;
      let usedFactor: "webauthn" | "totp" | "email" | "recovery" = challenge.factor;

      if (challenge.factor === "webauthn") {
        const { webauthnResponse, webauthnChallengeToken } = body;
        if (!webauthnResponse || !webauthnChallengeToken) {
          return reply.status(400).send({ error: "Missing webauthn response" });
        }
        let wac;
        try {
          wac = await verifyWebauthnChallengeToken(webauthnChallengeToken, "login");
        } catch {
          return reply.status(400).send({ error: "WebAuthn challenge expired" });
        }
        if (wac.userId !== caller.sub) {
          return reply.status(400).send({ error: "WebAuthn challenge subject mismatch" });
        }
        const responseId =
          webauthnResponse?.id ||
          (webauthnResponse?.rawId &&
            Buffer.from(webauthnResponse.rawId, "base64url").toString("base64url"));
        if (!responseId) return reply.status(400).send({ error: "Malformed response" });
        const [cred] = await db
          .select()
          .from(webauthnCredentials)
          .where(
            and(
              eq(webauthnCredentials.userId, caller.sub),
              eq(webauthnCredentials.credentialId, responseId),
            ),
          )
          .limit(1);
        if (!cred) return reply.status(400).send({ error: "Unknown credential" });
        try {
          const verification = await verifyAuthenticationResponse({
            response: webauthnResponse,
            expectedChallenge: wac.challenge,
            expectedOrigin: getExpectedOrigin(req as any),
            expectedRPID: getRpId(req as any),
            credential: {
              id: cred.credentialId,
              publicKey: Buffer.from(cred.publicKey, "base64"),
              counter: Number(cred.counter || 0),
              transports: cred.transports ? cred.transports.split(",") : undefined,
            } as any,
            requireUserVerification: false,
          });
          ok = !!verification.verified;
          if (ok) {
            await db
              .update(webauthnCredentials)
              .set({
                counter: verification.authenticationInfo.newCounter,
                lastUsedAt: new Date(),
              })
              .where(eq(webauthnCredentials.id, cred.id));
          }
        } catch (err: any) {
          app.log.warn({ err: err.message }, "step-up webauthn verify failed");
          ok = false;
        }
      } else if (challenge.factor === "totp") {
        const code = body.totpCode || body.recoveryCode;
        if (body.recoveryCode) {
          ok = await verifyRecoveryCodeForUser(db, caller.sub, body.recoveryCode);
          if (ok) usedFactor = "recovery";
        } else {
          ok = await verifyTotpForUser(db, caller.sub, code);
        }
      } else if (challenge.factor === "email") {
        const code = body.emailCode || body.recoveryCode;
        if (body.recoveryCode) {
          ok = await verifyRecoveryCodeForUser(db, caller.sub, body.recoveryCode);
          if (ok) usedFactor = "recovery";
        } else {
          ok = await verifyEmailOtpForUser(db, caller.sub, code, "step-up");
        }
      }

      if (!ok) {
        const fail = await recordMfaFailure(db, caller.sub);
        // Audit every failed step-up so brute-force attempts against destructive
        // scopes are visible in the SIEM.
        try {
          await appendAudit(db, "audit_events", auditEvents, {
            tenantId: caller.tenantId || null,
            userId: caller.sub,
            eventType: "STEP_UP_FAILED",
            resourceType: "step-up",
            resourceId: challenge.scope,
            details: { scope: challenge.scope, factor: usedFactor, locked: fail.locked },
            ipAddress: (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
              req.ip ||
              null) as any,
            userAgent: (req.headers["user-agent"] as string) || null,
          });
        } catch (err: any) {
          app.log.warn({ err: err.message }, "step-up audit insert failed");
        }
        return reply.status(400).send({
          error: fail.locked ? "Account temporarily locked" : "Verification failed",
          locked: fail.locked,
        });
      }
      await clearMfaFailures(db, caller.sub);

      const stepUpToken = await issueStepUpToken(
        { sub: caller.sub, tenantId: caller.tenantId, role: caller.role, email: caller.email },
        challenge.scope,
        challenge.factor,
      );

      await appendAudit(db, "audit_events", auditEvents, {
        tenantId: caller.tenantId || null,
        userId: caller.sub,
        eventType: "STEP_UP_VERIFIED",
        resourceType: "step-up",
        resourceId: challenge.scope,
        details: { scope: challenge.scope, factor: usedFactor },
        ipAddress: (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
          req.ip ||
          null) as any,
        userAgent: (req.headers["user-agent"] as string) || null,
      });

      return { stepUpToken, scope: challenge.scope, factor: usedFactor, expiresIn: 300 };
    },
  );

  /**
   * Sprint 11 — internal endpoint so other services (admin-svc) can
   * delegate step-up verification here. Centralizing keeps the in-memory
   * single-use jti store authoritative across the platform.
   *
   * Caller supplies `{ token, scope, callerSub }`; we reuse the same
   * `requireStepUp` checks (purpose, sub match, scope match, jti single-
   * use). Authenticated with the shared `x-internal-key`.
   */
  app.post(
    "/api/auth/step-up/verify-internal",
    { schema: authStepUpVerifyInternalSchema },
    async (req: any, reply) => {
      const internalKey = req.headers["x-internal-key"];
      if (!INTERNAL_KEY || internalKey !== INTERNAL_KEY) {
        return reply.status(401).send({ valid: false, reason: "internal-key-mismatch" });
      }
      if (!ADMIN_ENTERPRISE.STEP_UP_AUTH) {
        // Step-up flag off → consider every call valid; keeps behavior
        // identical to the in-process `requireStepUp` no-op branch.
        return { valid: true, skipped: true };
      }
      const { token, scope, callerSub } = (req.body || {}) as {
        token?: string;
        scope?: string;
        callerSub?: string;
      };
      if (!token || !scope || !callerSub) {
        return reply.status(400).send({ valid: false, reason: "missing-fields" });
      }
      let claims: StepUpJWT;
      try {
        claims = await verifyJWT<StepUpJWT>(token);
      } catch {
        return reply.status(403).send({ valid: false, reason: "invalid-or-expired" });
      }
      if (claims.purpose !== "step-up")
        return reply.status(403).send({ valid: false, reason: "wrong-purpose" });
      if (claims.sub !== callerSub)
        return reply.status(403).send({ valid: false, reason: "sub-mismatch" });
      if (claims.scope !== scope)
        return reply.status(403).send({ valid: false, reason: "scope-mismatch" });
      if (!claims.jti) return reply.status(403).send({ valid: false, reason: "missing-jti" });
      if (checkAndConsumeJti(claims.jti)) {
        return reply.status(403).send({ valid: false, reason: "already-used" });
      }
      return { valid: true, jti: claims.jti, scope: claims.scope };
    },
  );
}

// Avoid unused-import warnings for verifyStepUpChallengeToken (exported for tests).
export { verifyStepUpChallengeToken };
