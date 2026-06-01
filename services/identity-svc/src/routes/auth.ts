import { FastifyInstance } from "fastify";
import {
  users,
  sessions,
  tenants,
  learners,
  mfaCodes,
  passwordResetTokens,
  webauthnCredentials,
  mfaRecoveryCodes,
  auditEvents,
  appendAudit,
  adminSessions,
  passwordHistory,
  districtAdminInvites,
  schools,
  adminAuditLog,
} from "@aivo/db";
import {
  evaluatePassword,
  isPasswordRotationDue,
  isInternalRoleForPolicy,
  PASSWORD_HISTORY_DEPTH,
} from "@aivo/security";
import {
  signJWT,
  verifyJWT,
  ADMIN_ENTERPRISE,
  encryptSecret,
  decryptSecret,
  hashOtpCode,
  timingSafeEqualHex,
  looksLikeRecoveryCode,
  type MfaChallengeJWT,
} from "@aivo/security";
import { eq, and, sql, lt, isNull } from "drizzle-orm";
import crypto from "crypto";
import argon2 from "argon2";
import QRCode from "qrcode";
import { setSurfaceCookie, clearSurfaceCookie } from "../lib/surface-cookie.js";
import { loadAvailableRoles } from "../lib/available-roles.js";
import {
  isInternalRole,
  refreshTtlMs,
  recordAdminLogin,
  gateAdminRefresh,
  bumpAdminActivity,
  idleDeadline,
  mfaDeadline,
} from "../services/admin-session.js";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { generateTotpSecret, verifyTotpCode, buildOtpauthUrl } from "../services/mfa-totp.js";
import { initiateMfa, pickMfaMethod, type MfaMethod } from "../services/mfa-initiate.js";
import {
  regenerateRecoveryCodes,
  countActiveRecoveryCodes,
  redeemRecoveryCode,
} from "../services/mfa-recovery.js";
import {
  isMfaLocked,
  recordMfaFailure,
  clearMfaFailures,
  lockoutSecondsRemaining,
} from "../services/mfa-lockout.js";
import {
  challengeAllowsEmailOtp,
  challengeAllowsEmailResend,
  userMayUseTotp,
} from "../services/mfa-method-policy.js";
import {
  getRpId,
  getRpName,
  getExpectedOrigin,
  signWebauthnChallenge,
  verifyWebauthnChallengeToken,
} from "../services/mfa-webauthn.js";
import { getAuthPublicKeySchema, updateAuthSessionHeartbeatSchema } from "./schemas.js";

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

/**
 * Build the cross-host login URL the consumer login page should redirect a
 * misrouted user to. Production hosts are pinned to admin.aivolearning.com /
 * district.aivolearning.com (defense-in-depth + middleware host allowlist),
 * so the rejection payload MUST be an absolute URL on the correct host -
 * a relative `/admin/login` would 404 once host pinning is enforced.
 *
 * In development (replit dev domain, localhost) we fall back to the same-host
 * relative path so the dev preview pane keeps working.
 *
 * Override with WEB_ADMIN_LOGIN_URL / WEB_DISTRICT_LOGIN_URL when running
 * against alternative hosts (staging, sandbox).
 */
function buildSurfaceLoginUrl(
  req: { headers: Record<string, string | string[] | undefined> },
  envVar: "WEB_ADMIN_LOGIN_URL" | "WEB_DISTRICT_LOGIN_URL",
  prodDefault: string,
  devPath: string,
): string {
  const override = process.env[envVar];
  if (override) return override;
  if (process.env.NODE_ENV === "production") return prodDefault;
  const host = (req.headers["x-forwarded-host"] || req.headers.host) as string | undefined;
  if (host && /aivolearning\.com$/i.test(host)) return prodDefault;
  return devPath;
}

function adminLoginUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
  return buildSurfaceLoginUrl(
    req,
    "WEB_ADMIN_LOGIN_URL",
    "https://admin.aivolearning.com/admin/login",
    "/admin/login",
  );
}

function districtLoginUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
  return buildSurfaceLoginUrl(
    req,
    "WEB_DISTRICT_LOGIN_URL",
    "https://district.aivolearning.com/district/login",
    "/district/login",
  );
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function deleteLearnerCascade(db: any, learnerId: string) {
  const dependentTables = [
    "assessment_attempts",
    "avatar_inventory",
    "badges",
    "brain_insights",
    "brain_recommendations",
    "brain_state_snapshots",
    "brain_states",
    "break_activities",
    "causal_analyses",
    "challenge_participants",
    "collaboration_invites",
    "currency_transactions",
    "functional_milestones",
    "gradebook_entries",
    "homework_sessions",
    "homework_assignments",
    "iep_documents",
    "iep_goals",
    "iep_profiles",
    "language_profiles",
    "leaderboard_entries",
    "learner_caregivers",
    "learner_functioning_levels",
    "learner_teachers",
    "learner_therapists",
    "learning_paths",
    "lesson_plans",
    "lesson_sessions",
    "parent_assessments",
    "parent_reported_events",
    "quest_progress",
    "sel_checkins",
    "sensory_profiles",
    "streaks",
    "therapy_goals",
    "therapy_sessions",
    "transition_plans",
    "tutor_sessions",
    "virtual_currency",
    "xp_events",
  ];

  for (const t of dependentTables) {
    await db.execute(sql.raw(`DELETE FROM "${t}" WHERE learner_id = '${learnerId}'`));
  }
  await db.execute(sql.raw(`DELETE FROM "learners" WHERE id = '${learnerId}'`));
}

async function deleteUserCascade(db: any, userId: string) {
  await db.execute(
    sql.raw(
      `DELETE FROM "consent_records" WHERE parent_id = '${userId}' OR child_id = '${userId}'`,
    ),
  );
  await db.execute(sql.raw(`DELETE FROM "collaboration_invites" WHERE invited_by = '${userId}'`));
  await db.execute(
    sql.raw(
      `DELETE FROM "learner_caregivers" WHERE caregiver_user_id = '${userId}' OR invited_by = '${userId}'`,
    ),
  );
  await db.execute(
    sql.raw(
      `DELETE FROM "learner_teachers" WHERE teacher_user_id = '${userId}' OR invited_by = '${userId}'`,
    ),
  );
  await db.execute(
    sql.raw(
      `DELETE FROM "learner_therapists" WHERE therapist_user_id = '${userId}' OR invited_by = '${userId}'`,
    ),
  );
  await db.execute(sql.raw(`DELETE FROM "lesson_plans" WHERE teacher_user_id = '${userId}'`));
  // Sprint 4: audit_events is append-only (audit_no_mutate trigger). Rows
  // for the deleted user are intentionally retained as forensic history;
  // user_id is nullable with no FK so the orphan reference is harmless.
  await db.execute(sql.raw(`DELETE FROM "subscriptions" WHERE user_id = '${userId}'`));
  await db.execute(sql.raw(`DELETE FROM "tutor_subscriptions" WHERE user_id = '${userId}'`));
  await db.execute(sql.raw(`DELETE FROM "sessions" WHERE user_id = '${userId}'`));
  await db.execute(sql.raw(`DELETE FROM "users" WHERE id = '${userId}'`));
}

async function verifyGoogleToken(
  idToken: string,
): Promise<{ email: string; name: string; googleId: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      aud?: string;
      iss?: string;
      email?: string;
      email_verified?: string;
      exp?: string;
      name?: string;
      sub?: string;
    };
    if (payload.aud !== clientId) return null;
    if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com")
      return null;
    if (!payload.email || payload.email_verified !== "true") return null;
    if (payload.exp && Number(payload.exp) * 1000 < Date.now()) return null;
    return {
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
      googleId: payload.sub || "",
    };
  } catch {
    return null;
  }
}

const IS_PROD_AUTH = process.env.NODE_ENV === "production";
function requireCommsUrl(): string {
  const v = process.env.COMMS_SVC_URL || process.env.COMMS_SERVICE_URL;
  if (v) return v;
  if (IS_PROD_AUTH) throw new Error("identity-svc: COMMS_SVC_URL must be set in production");
  return "http://localhost:3003";
}
const COMMS_URL = requireCommsUrl();
const INTERNAL_KEY =
  process.env.INTERNAL_SERVICE_KEY || (IS_PROD_AUTH ? "" : "aivo-internal-dev-key");

function generateMfaCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

async function createAndSendMfaCode(
  db: any,
  userId: string,
  email: string,
  name: string,
  purpose = "login",
): Promise<string> {
  await db
    .update(mfaCodes)
    .set({ used: true, usedAt: new Date() })
    .where(and(eq(mfaCodes.userId, userId), eq(mfaCodes.used, false)));

  const code = generateMfaCode();
  const [mfaRecord] = await db
    .insert(mfaCodes)
    .values({
      userId,
      codeHash: hashOtpCode(code),
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
    .returning();

  const commsRes = await fetch(`${COMMS_URL}/api/comms/internal/mfa-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
    body: JSON.stringify({ to: email, code, name }),
  }).catch(() => null);

  if (!commsRes || !commsRes.ok) {
    throw new Error("Failed to send MFA code email");
  }

  return mfaRecord.id;
}

async function signMfaToken(
  userId: string,
  email: string,
  method: MfaMethod = "email",
): Promise<string> {
  const claims: MfaChallengeJWT = {
    sub: userId,
    tenantId: "",
    role: "",
    email,
    purpose: "mfa",
    mfaMethod: method,
  };
  return signJWT<MfaChallengeJWT>(claims, "15m");
}

/**
 * Common MFA challenge initiation used by every login flow. Picks the
 * strongest enrolled factor (passkey when STRONG_MFA, then TOTP, then email)
 * and only side-effects (sends an email OTP) when the method is "email".
 */
async function startMfaForLogin(
  db: any,
  user: { id: string; email: string; name: string; mfaMethod: string | null },
): Promise<{ mfaToken: string; mfaMethod: MfaMethod }> {
  const { mfaToken, mfaMethod } = await initiateMfa(db, user);
  if (mfaMethod === "email") {
    await createAndSendMfaCode(db, user.id, user.email, user.name);
  }
  return { mfaToken, mfaMethod };
}

const MFA_FORCED_ROLES = [
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
];

/**
 * Sprint 8: districts can opt every staff account in their tenant into
 * forced MFA via `district_settings.featureOverrides.forceMfa = true`.
 * Returns true if the user must complete MFA at login regardless of
 * their personal `mfaEnabled` flag. Pure-function override on top of
 * the role-based default — never *removes* a forced role.
 */
async function isTenantForcingMfa(db: any, tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  const { districtSettings } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  const [s] = await db
    .select({ overrides: districtSettings.featureOverrides })
    .from(districtSettings)
    .where(eq(districtSettings.tenantId, tenantId))
    .limit(1);
  return !!(s?.overrides as any)?.forceMfa;
}

async function mfaRequiredFor(
  db: any,
  user: { role: string; mfaEnabled?: boolean | null; tenantId?: string | null },
): Promise<boolean> {
  if (user.mfaEnabled) return true;
  if (MFA_FORCED_ROLES.includes(user.role)) return true;
  // Tenant-wide force-MFA: applies to all non-anon users in the tenant
  // including TEACHER/THERAPIST/CAREGIVER who would otherwise be opt-in.
  return await isTenantForcingMfa(db, user.tenantId);
}

/**
 * Drizzle returns timestamp columns as `Date` with the pg driver but as
 * ISO strings in some test/serialized paths. Normalize to a real `Date`
 * (or `null`) so password-policy helpers can rely on `.getTime()`.
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Returns true when the given user must change their password before
 * they're allowed to use any other surface. Mirrors the logic in
 * `/api/auth/refresh` so SPA and mobile callers can drive a forced-rotation
 * UX directly off the login response without needing a follow-up refresh.
 */
function computeMustChangePassword(user: {
  mustChangePassword?: boolean | null;
  passwordChangedAt?: Date | string | null;
  role: string;
}): boolean {
  return (
    !!user.mustChangePassword || isPasswordRotationDue(toDate(user.passwordChangedAt), user.role)
  );
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/public-key", { schema: getAuthPublicKeySchema }, async (_req, reply) => {
    const { getPublicKeyPEM } = await import("@aivo/security");
    const pem = await getPublicKeyPEM();
    if (!pem) {
      return reply.status(503).send({ error: "Keys not initialized" });
    }
    return { publicKey: pem, algorithm: "RS256" };
  });

  app.post(
    "/api/auth/register",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "password", "name", "role"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string", minLength: 1 },
            role: { type: "string", enum: ["PARENT"] },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password, name, role } = req.body as any;
      const db = (app as any).db;

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        return reply.status(409).send({ error: "Email already registered" });
      }

      const [tenant] = await db
        .insert(tenants)
        .values({
          name: `${name}'s Family`,
          type: "B2C_FAMILY",
        })
        .returning();

      const policy = await evaluatePassword(password, { role, email, name });
      if (!policy.ok) {
        // We created a tenant a few lines up; tear it back down so we don't
        // leak orphan rows on a rejected registration.
        await db.delete(tenants).where(eq(tenants.id, tenant.id));
        return reply.status(400).send({
          error: "Password does not meet our policy",
          reasons: policy.reasons,
          strengthScore: policy.strengthScore,
        });
      }
      const newHash = await hashPassword(password);
      const [user] = await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          email,
          passwordHash: newHash,
          name,
          role,
          passwordChangedAt: new Date(),
        } as any)
        .returning();
      await db.insert(passwordHistory).values({ userId: user.id, passwordHash: newHash });

      const accessToken = await signJWT({
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
        email: user.email!,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });

      const rawRefreshToken = crypto.randomUUID();
      await db.insert(sessions).values({
        userId: user.id,
        refreshToken: hashRefreshToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      await setSurfaceCookie(reply, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: tenant.id,
        },
        accessToken,
      };
    },
  );

  app.post(
    "/api/auth/login",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as any;
      const db = (app as any).db;

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      if (user.deactivatedAt) {
        return reply.status(403).send({ error: "Account has been deactivated. Contact support." });
      }

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      if (user.role === "DISTRICT_ADMIN") {
        return reply.status(403).send({
          error: "District administrators must sign in at district.aivolearning.com.",
          redirectTo: districtLoginUrl(req),
          wrongSurface: "district",
        });
      }
      if (
        [
          "PLATFORM_ADMIN",
          "SALES",
          "MARKETING",
          "CUSTOMER_CARE",
          "SUPPORT",
          "FINANCE",
          "DEVOPS",
        ].includes(user.role)
      ) {
        return reply.status(403).send({
          error: "Staff accounts must sign in at admin.aivolearning.com.",
          redirectTo: adminLoginUrl(req),
          wrongSurface: "admin",
        });
      }

      const mfaRequired = await mfaRequiredFor(db, user);
      if (mfaRequired) {
        if (!user.mfaEnabled && MFA_FORCED_ROLES.includes(user.role)) {
          await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, user.id));
        }
        try {
          const challenge = await startMfaForLogin(db, {
            id: user.id,
            email: user.email!,
            name: user.name,
            mfaMethod: user.mfaMethod,
          });
          return { mfaPending: true, mfaToken: challenge.mfaToken, mfaMethod: challenge.mfaMethod };
        } catch {
          return reply
            .status(502)
            .send({ error: "Failed to send verification code. Please try again." });
        }
      }

      const clientIp =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          lastLoginIp: clientIp,
        })
        .where(eq(users.id, user.id));

      const availableRoles = await loadAvailableRoles(db, user.id, user.role);
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        availableRoles,
        email: user.email!,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });

      const rawRefreshToken = crypto.randomUUID();
      const ttlMs = refreshTtlMs(user.role);
      await db.insert(sessions).values({
        userId: user.id,
        refreshToken: hashRefreshToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + ttlMs),
      });
      if (isInternalRole(user.role)) {
        await recordAdminLogin(
          db,
          user.id,
          hashRefreshToken(rawRefreshToken),
          req.headers,
          clientIp,
        );
      }

      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(ttlMs / 1000),
      });
      await setSurfaceCookie(reply, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        accessToken,
        mustChangePassword: computeMustChangePassword(user),
      };
    },
  );

  // Strict surface separation: /api/auth/admin-login is for INTERNAL staff
  // only. DISTRICT_ADMIN must use /api/auth/district-login (different host
  // in production: district.aivolearning.com). The middleware also enforces
  // this at the edge, but rejecting cleanly here gives a better UX with an
  // explicit redirect hint instead of a generic "Invalid credentials".
  const ADMIN_ROLES = [
    "PLATFORM_ADMIN",
    "SALES",
    "MARKETING",
    "CUSTOMER_CARE",
    "SUPPORT",
    "FINANCE",
    "DEVOPS",
  ];

  app.post(
    "/api/auth/admin-login",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as any;
      const db = (app as any).db;

      const genericError = "Invalid credentials";

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: genericError });
      }

      const validPw = await verifyPassword(user.passwordHash, password);
      if (!validPw) {
        return reply.status(401).send({ error: genericError });
      }

      if (user.role === "DISTRICT_ADMIN") {
        // Wrong surface — bounce them to district sign-in with a clear hint.
        return reply.status(403).send({
          error: "District administrators must sign in at district.aivolearning.com.",
          redirectTo: districtLoginUrl(req),
          wrongSurface: "district",
        });
      }

      if (!ADMIN_ROLES.includes(user.role)) {
        return reply.status(401).send({ error: genericError });
      }

      if (user.deactivatedAt) {
        return reply.status(401).send({ error: genericError });
      }

      if (await mfaRequiredFor(db, user)) {
        if (!user.mfaEnabled) {
          await db
            .update(users)
            .set({ mfaEnabled: true, mfaMethod: "email" })
            .where(eq(users.id, user.id));
        }
        try {
          const challenge = await startMfaForLogin(db, {
            id: user.id,
            email: user.email!,
            name: user.name,
            mfaMethod: user.mfaMethod,
          });
          return { mfaPending: true, mfaToken: challenge.mfaToken, mfaMethod: challenge.mfaMethod };
        } catch {
          return reply
            .status(502)
            .send({ error: "Failed to send verification code. Please try again." });
        }
      }

      const clientIp =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          lastLoginIp: clientIp,
        })
        .where(eq(users.id, user.id));

      const availableRoles = await loadAvailableRoles(db, user.id, user.role);
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        availableRoles,
        email: user.email!,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });

      const rawRefreshToken = crypto.randomUUID();
      const ttlMs = refreshTtlMs(user.role);
      const hashedRT = hashRefreshToken(rawRefreshToken);
      await db.insert(sessions).values({
        userId: user.id,
        refreshToken: hashedRT,
        expiresAt: new Date(Date.now() + ttlMs),
      });
      if (isInternalRole(user.role)) {
        await recordAdminLogin(db, user.id, hashedRT, req.headers, clientIp);
      }

      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(ttlMs / 1000),
      });
      await setSurfaceCookie(reply, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        accessToken,
      };
    },
  );

  const DISTRICT_ROLES = ["DISTRICT_ADMIN", "PLATFORM_ADMIN"];

  app.post(
    "/api/auth/district-login",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as any;
      const db = (app as any).db;

      const genericError = "Invalid credentials";

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: genericError });
      }

      const validPw = await verifyPassword(user.passwordHash, password);
      if (!validPw) {
        return reply.status(401).send({ error: genericError });
      }

      if (!DISTRICT_ROLES.includes(user.role)) {
        return reply.status(401).send({ error: genericError });
      }

      if (user.deactivatedAt) {
        return reply.status(401).send({ error: genericError });
      }

      if (await mfaRequiredFor(db, user)) {
        if (!user.mfaEnabled) {
          await db
            .update(users)
            .set({ mfaEnabled: true, mfaMethod: "email" })
            .where(eq(users.id, user.id));
        }
        try {
          const challenge = await startMfaForLogin(db, {
            id: user.id,
            email: user.email!,
            name: user.name,
            mfaMethod: user.mfaMethod,
          });
          return { mfaPending: true, mfaToken: challenge.mfaToken, mfaMethod: challenge.mfaMethod };
        } catch {
          return reply
            .status(502)
            .send({ error: "Failed to send verification code. Please try again." });
        }
      }

      const clientIp =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          lastLoginIp: clientIp,
        })
        .where(eq(users.id, user.id));

      const availableRoles = await loadAvailableRoles(db, user.id, user.role);
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        availableRoles,
        email: user.email!,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });

      const rawRefreshToken = crypto.randomUUID();
      const ttlMs = refreshTtlMs(user.role);
      const hashedRT = hashRefreshToken(rawRefreshToken);
      await db.insert(sessions).values({
        userId: user.id,
        refreshToken: hashedRT,
        expiresAt: new Date(Date.now() + ttlMs),
      });
      if (isInternalRole(user.role)) {
        await recordAdminLogin(db, user.id, hashedRT, req.headers, clientIp);
      }

      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(ttlMs / 1000),
      });
      await setSurfaceCookie(reply, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        accessToken,
      };
    },
  );

  app.post(
    "/api/auth/google",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["idToken"],
          properties: {
            idToken: { type: "string" },
            coppaConsent: { type: "boolean" },
            termsAccepted: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const { idToken, coppaConsent, termsAccepted } = req.body as any;
      const db = (app as any).db;

      const googleUser = await verifyGoogleToken(idToken);
      if (!googleUser) {
        return reply.status(401).send({ error: "Invalid Google token" });
      }

      const [existingByGoogleId] = await db
        .select()
        .from(users)
        .where(eq(users.googleId, googleUser.googleId))
        .limit(1);

      let user;
      if (existingByGoogleId) {
        user = existingByGoogleId;
      } else {
        const [existingByEmail] = await db
          .select()
          .from(users)
          .where(eq(users.email, googleUser.email))
          .limit(1);

        if (existingByEmail) {
          if (existingByEmail.googleId && existingByEmail.googleId !== googleUser.googleId) {
            return reply
              .status(409)
              .send({ error: "This email is already linked to a different Google account" });
          }
          if (!existingByEmail.googleId) {
            await db
              .update(users)
              .set({ googleId: googleUser.googleId })
              .where(eq(users.id, existingByEmail.id));
          }
          user = { ...existingByEmail, googleId: googleUser.googleId };
        } else {
          if (!coppaConsent || !termsAccepted) {
            return reply.status(400).send({
              error: "COPPA consent and terms acceptance required for new accounts",
              requiresConsent: true,
            });
          }

          const [tenant] = await db
            .insert(tenants)
            .values({
              name: `${googleUser.name}'s Family`,
              type: "B2C_FAMILY",
            })
            .returning();

          const [newUser] = await db
            .insert(users)
            .values({
              tenantId: tenant.id,
              email: googleUser.email,
              name: googleUser.name,
              role: "PARENT",
              googleId: googleUser.googleId,
            })
            .returning();
          user = newUser;
        }
      }

      const googleMfaRequired = await mfaRequiredFor(db, user);
      if (googleMfaRequired && user.email) {
        if (!user.mfaEnabled && MFA_FORCED_ROLES.includes(user.role)) {
          await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, user.id));
        }
        try {
          const challenge = await startMfaForLogin(db, {
            id: user.id,
            email: user.email,
            name: user.name,
            mfaMethod: user.mfaMethod,
          });
          return { mfaPending: true, mfaToken: challenge.mfaToken, mfaMethod: challenge.mfaMethod };
        } catch {
          return reply
            .status(502)
            .send({ error: "Failed to send verification code. Please try again." });
        }
      }

      const availableRoles = await loadAvailableRoles(db, user.id, user.role);
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        availableRoles,
        email: user.email!,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });

      const rawRefreshToken = crypto.randomUUID();
      const ttlMs = refreshTtlMs(user.role);
      const hashedRT = hashRefreshToken(rawRefreshToken);
      await db.insert(sessions).values({
        userId: user.id,
        refreshToken: hashedRT,
        expiresAt: new Date(Date.now() + ttlMs),
      });
      if (isInternalRole(user.role)) {
        const clientIp =
          req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
        await recordAdminLogin(db, user.id, hashedRT, req.headers, clientIp);
      }

      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(ttlMs / 1000),
      });
      await setSurfaceCookie(reply, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        accessToken,
        mustChangePassword: computeMustChangePassword(user),
      };
    },
  );

  app.post(
    "/api/auth/pin-login",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["parentId", "pin"],
          properties: {
            parentId: { type: "string" },
            pin: { type: "string", minLength: 4, maxLength: 6 },
          },
        },
      },
    },
    async (req, reply) => {
      const { parentId, pin } = req.body as any;
      const db = (app as any).db;

      const isEmail = parentId.includes("@");
      let parent;
      if (isEmail) {
        const [found] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, parentId), eq(users.role, "PARENT")))
          .limit(1);
        parent = found;
      } else {
        const [found] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, parentId), eq(users.role, "PARENT")))
          .limit(1);
        parent = found;
      }

      if (!parent) {
        return reply.status(401).send({ error: "Invalid parent email or ID" });
      }

      const learnerList = await db.select().from(learners).where(eq(learners.parentId, parent.id));
      const learnerUserIds = learnerList.map((l: any) => l.userId);

      if (learnerUserIds.length === 0) {
        return reply.status(401).send({ error: "No learners found" });
      }

      const allLearnerUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "LEARNER"), eq(users.pin, pin)));
      const matchedLearner = allLearnerUsers.find((u: any) => learnerUserIds.includes(u.id));

      if (!matchedLearner) {
        return reply.status(401).send({ error: "Invalid PIN" });
      }

      const accessToken = await signJWT(
        {
          sub: matchedLearner.id,
          tenantId: matchedLearner.tenantId,
          role: "LEARNER",
          name: matchedLearner.name,
        },
        "2h",
      );

      // Establish a refresh session so the learner's PIN sign-in survives the
      // 2h access-token expiry. It previously had no sessions row / refresh
      // cookie, so the session hard-died at 2h with no silent refresh.
      const rawRefreshToken = crypto.randomUUID();
      const ttlMs = refreshTtlMs("LEARNER");
      await db.insert(sessions).values({
        userId: matchedLearner.id,
        refreshToken: hashRefreshToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + ttlMs),
      });
      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(ttlMs / 1000),
      });
      await setSurfaceCookie(reply, "LEARNER");

      return {
        user: {
          id: matchedLearner.id,
          name: matchedLearner.name,
          role: "LEARNER",
          tenantId: matchedLearner.tenantId,
        },
        accessToken,
      };
    },
  );

  app.post(
    "/api/auth/refresh",
    {
      schema: { tags: ["Auth"] },
    },
    async (req, reply) => {
      const token = req.cookies.refreshToken;
      if (!token) return reply.status(401).send({ error: "No refresh token" });

      const db = (app as any).db;
      const hashedToken = hashRefreshToken(token);
      const [session] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.refreshToken, hashedToken))
        .limit(1);

      if (!session || new Date(session.expiresAt) < new Date()) {
        return reply.status(401).send({ error: "Invalid or expired refresh token" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

      if (!user) return reply.status(401).send({ error: "User not found" });

      if (user.deactivatedAt) {
        await db.delete(sessions).where(eq(sessions.userId, user.id));
        reply.clearCookie("refreshToken", { path: "/" });
        clearSurfaceCookie(reply);
        return reply.status(401).send({ error: "Account has been deactivated" });
      }

      // Sprint 5: enforce idle timeout, MFA freshness, and device-fingerprint
      // binding for internal roles. Lenient backfill creates the
      // admin_sessions row on first hit if one does not yet exist.
      if (isInternalRole(user.role)) {
        const ipAddress = (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
          req.ip ||
          null) as string | null;
        const gate = await gateAdminRefresh(db, hashedToken, user.id, req.headers, ipAddress);
        if (!gate.ok) {
          // Sprint 5: gate failure must be terminal for this refresh token.
          // Without this, an attacker could simply retry refresh and let the
          // lenient backfill recreate the admin_sessions row, defeating idle/
          // device/MFA-freshness controls.
          await db.delete(sessions).where(eq(sessions.refreshToken, hashedToken));
          reply.clearCookie("refreshToken", { path: "/" });
          clearSurfaceCookie(reply);
          return reply.status(gate.status).send(gate.body);
        }
        await bumpAdminActivity(db, hashedToken);
      }

      // Sprint 7: surface mustChangePassword + rotation-due so the SPA can
      // redirect the user to /dashboard/change-password before doing anything
      // else. We do NOT block refresh on this — the user must be able to
      // load the change-password page itself.
      const rotationDue = isPasswordRotationDue(toDate(user.passwordChangedAt), user.role);

      const accessToken = await signJWT({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email || undefined,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });

      return {
        accessToken,
        mustChangePassword: !!user.mustChangePassword || rotationDue,
        passwordRotationDue: rotationDue,
      };
    },
  );

  /**
   * Sprint 5: client heartbeat. Internal-role sessions ping this every
   * minute (throttled) on user activity so the server can keep
   * `adminSessions.lastActivityAt` fresh. Returns the next idle/MFA
   * deadlines so the UI can drive a warning modal.
   */
  app.put(
    "/api/auth/session/heartbeat",
    { schema: updateAuthSessionHeartbeatSchema },
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer "))
        return reply.status(401).send({ error: "Missing authorization header" });
      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }
      if (!isInternalRole(payload.role)) {
        return { serverNow: Date.now(), idleDeadline: 0, mfaDeadline: 0 };
      }
      const cookieToken = req.cookies.refreshToken;
      if (!cookieToken) return reply.status(401).send({ error: "No refresh session" });
      const sessionId = hashRefreshToken(cookieToken);
      const db = (app as any).db;
      const [row] = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.sessionId, sessionId))
        .limit(1);
      if (!row) {
        const ipAddress = (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
          req.ip ||
          null) as string | null;
        await (
          await import("../services/admin-session.js")
        ).recordAdminLogin(db, payload.sub, sessionId, req.headers, ipAddress);
      }
      const updated = await bumpAdminActivity(db, sessionId);
      const fresh = row ?? { mfaVerifiedAt: updated };
      return {
        serverNow: Date.now(),
        idleDeadline: idleDeadline(updated),
        mfaDeadline: mfaDeadline(fresh.mfaVerifiedAt),
      };
    },
  );

  app.post(
    "/api/auth/logout",
    {
      schema: { tags: ["Auth"] },
    },
    async (req, reply) => {
      const token = req.cookies.refreshToken;
      if (token) {
        const db = (app as any).db;
        const hashed = hashRefreshToken(token);
        await db.delete(sessions).where(eq(sessions.refreshToken, hashed));
        await db.delete(adminSessions).where(eq(adminSessions.sessionId, hashed));
      }
      reply.clearCookie("refreshToken", { path: "/" });
      clearSurfaceCookie(reply);
      return { success: true };
    },
  );

  app.post(
    "/api/auth/forgot-password",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email" } },
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email: string };
      const db = (request.server as any).db;
      const normalizedEmail = email.trim().toLowerCase();

      const genericResponse = {
        ok: true,
        message: "If that email is registered, a reset link has been sent.",
      };

      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        // Always return success to avoid account enumeration
        if (!user) {
          return genericResponse;
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        await db
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(and(eq(passwordResetTokens.userId, user.id), sql`used_at IS NULL`));

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const webOrigin = process.env.WEB_APP_URL || request.headers.origin || "";
        const resetUrl = `${webOrigin}/reset-password?token=${rawToken}`;

        const commsRes = await fetch(`${COMMS_URL}/api/comms/internal/password-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
          body: JSON.stringify({ to: user.email, resetUrl, name: user.name }),
        }).catch(() => null);

        if (!commsRes || !commsRes.ok) {
          request.log.error({ email: normalizedEmail }, "Failed to send password reset email");
        }
      } catch (err) {
        request.log.error({ err, email: normalizedEmail }, "forgot-password handler error");
      }

      return genericResponse;
    },
  );

  app.post(
    "/api/auth/reset-password",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["token", "newPassword"],
          properties: {
            token: { type: "string", minLength: 32 },
            newPassword: { type: "string", minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const { token, newPassword } = request.body as { token: string; newPassword: string };
      const db = (request.server as any).db;

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const [record] = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1);

      if (!record || record.usedAt || record.expiresAt < new Date()) {
        return reply.status(400).send({ error: "Invalid or expired reset link" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
      if (!user) return reply.status(400).send({ error: "Invalid or expired reset link" });

      const recent = await db
        .select()
        .from(passwordHistory)
        .where(eq(passwordHistory.userId, user.id))
        .orderBy(sql`${passwordHistory.createdAt} DESC`)
        .limit(PASSWORD_HISTORY_DEPTH);
      const policy = await evaluatePassword(newPassword, {
        role: user.role,
        email: user.email,
        name: user.name,
        historyVerifier: async (cand) => {
          for (const h of recent) {
            try {
              if (await verifyPassword(h.passwordHash, cand)) return true;
            } catch {
              /*skip*/
            }
          }
          return false;
        },
      });
      if (!policy.ok) {
        return reply.status(400).send({
          error: "Password does not meet our policy",
          reasons: policy.reasons,
          strengthScore: policy.strengthScore,
        });
      }

      const newHash = await hashPassword(newPassword);
      await db
        .update(users)
        .set({
          passwordHash: newHash,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, record.userId));
      await db.insert(passwordHistory).values({ userId: user.id, passwordHash: newHash });
      // Trim history beyond the depth so we don't grow forever.
      await db.execute(sql`
      DELETE FROM password_history
      WHERE user_id = ${user.id}
        AND id NOT IN (
          SELECT id FROM password_history
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT ${PASSWORD_HISTORY_DEPTH}
        )
    `);
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, record.id));
      await db.delete(sessions).where(eq(sessions.userId, record.userId));
      return { ok: true };
    },
  );

  // --- STAFF INVITE PREVIEW + ACCEPTANCE ---------------------------
  // Sprint 1 (invite-flows): staff invites (DISTRICT_ADMIN / SCHOOL_ADMIN /
  // TEACHER) created via the district/school admin consoles land the
  // invitee on the web `/accept-invite?token=…` page. These two public,
  // token-keyed endpoints let that page (a) preview who the invite is for
  // and (b) set a password — which creates the real user account and marks
  // the invite accepted. This is the production token-acceptance step that
  // previously only existed in test-helpers; without it, invited staff had
  // no way to actually get an account.
  const INVITE_ACCEPT_ROLES = ["DISTRICT_ADMIN", "SCHOOL_ADMIN", "TEACHER"] as const;

  function hashInviteToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  type InviteLookup =
    | { ok: true; invite: any }
    | { ok: false; status: number; error: string };

  async function lookupValidInvite(db: any, token: string): Promise<InviteLookup> {
    const tokenHash = hashInviteToken(token);
    const [invite] = await db
      .select()
      .from(districtAdminInvites)
      .where(eq(districtAdminInvites.tokenHash, tokenHash))
      .limit(1);
    if (!invite || invite.revokedAt) {
      return { ok: false, status: 400, error: "This invitation link is invalid." };
    }
    if (invite.acceptedAt) {
      return {
        ok: false,
        status: 409,
        error: "This invitation has already been accepted. Sign in instead.",
      };
    }
    if (invite.expiresAt < new Date()) {
      return {
        ok: false,
        status: 410,
        error: "This invitation has expired. Ask your administrator to resend it.",
      };
    }
    return { ok: true, invite };
  }

  // GET preview — public, keyed solely by the token (no bearer).
  app.get(
    "/api/auth/invite/:token",
    {
      schema: {
        tags: ["Auth"],
        params: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string", minLength: 16 } },
        },
      },
    },
    async (req, reply) => {
      const { token } = req.params as { token: string };
      const db = (app as any).db;
      const found = await lookupValidInvite(db, token);
      if (!found.ok) return reply.status(found.status).send({ error: found.error });
      const invite = found.invite;

      let schoolName: string | null = null;
      if (invite.schoolId) {
        const [school] = await db
          .select({ name: schools.name })
          .from(schools)
          .where(eq(schools.id, invite.schoolId))
          .limit(1);
        schoolName = school?.name ?? null;
      }
      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, invite.tenantId))
        .limit(1);

      return {
        invite: {
          email: invite.email,
          name: invite.name,
          role: invite.role,
          schoolName,
          districtName: tenant?.name ?? null,
          expiresAt: invite.expiresAt,
        },
      };
    },
  );

  // POST accept — public; creates the account from the invite + the chosen
  // password, then auto-logs the new user in (mirrors registration).
  app.post(
    "/api/auth/accept-invite",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: { type: "string", minLength: 16 },
            password: { type: "string", minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    async (req, reply) => {
      const { token, password } = req.body as { token: string; password: string };
      const db = (app as any).db;

      const found = await lookupValidInvite(db, token);
      if (!found.ok) return reply.status(found.status).send({ error: found.error });
      const invite = found.invite;

      const role = String(invite.role || "").toUpperCase();
      if (!(INVITE_ACCEPT_ROLES as readonly string[]).includes(role)) {
        return reply.status(400).send({ error: "This invitation has an unsupported role." });
      }

      const email = invite.email.trim().toLowerCase();

      // Guard against a race where the account was created between invite
      // issuance and acceptance (e.g. SSO/SCIM just-in-time provisioning).
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, invite.tenantId), eq(users.email, email)))
        .limit(1);
      if (existing) {
        // Close the invite so it can't be reused, then point them at login.
        await db
          .update(districtAdminInvites)
          .set({ acceptedAt: new Date(), acceptedUserId: existing.id })
          .where(eq(districtAdminInvites.id, invite.id));
        return reply
          .status(409)
          .send({ error: "An account already exists for this email. Sign in instead." });
      }

      const policy = await evaluatePassword(password, { role, email, name: invite.name });
      if (!policy.ok) {
        return reply.status(400).send({
          error: "Password does not meet our policy",
          reasons: policy.reasons,
          strengthScore: policy.strengthScore,
        });
      }

      const passwordHash = await hashPassword(password);
      const [user] = await db
        .insert(users)
        .values({
          tenantId: invite.tenantId,
          email,
          passwordHash,
          name: invite.name,
          role,
          schoolId: invite.schoolId ?? null,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
        } as any)
        .returning();
      await db.insert(passwordHistory).values({ userId: user.id, passwordHash });

      await db
        .update(districtAdminInvites)
        .set({ acceptedAt: new Date(), acceptedUserId: user.id })
        .where(eq(districtAdminInvites.id, invite.id));

      // Audit: the new user is the actor of their own acceptance.
      try {
        await appendAudit(db, "admin_audit_log", adminAuditLog, {
          tenantId: invite.tenantId,
          action: "staff_invite.accepted",
          actorId: user.id,
          actorEmail: email,
          actorRole: role,
          onBehalfOfId: null,
          resourceType: "district_admin_invite",
          resourceId: invite.id,
          details: { role, schoolId: invite.schoolId ?? null },
          ipAddress: req.ip ?? null,
          userAgent: (req.headers["user-agent"] as string) ?? null,
        });
      } catch (err) {
        req.log.warn({ err: String(err) }, "accept-invite audit append failed");
      }

      // Auto-login: mint access token + refresh session like registration.
      const availableRoles = await loadAvailableRoles(db, user.id, user.role);
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        availableRoles,
        email: user.email!,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });
      const rawRefreshToken = crypto.randomUUID();
      await db.insert(sessions).values({
        userId: user.id,
        refreshToken: hashRefreshToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });

      return {
        ok: true,
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          schoolId: user.schoolId ?? null,
        },
      };
    },
  );

  app.put(
    "/api/auth/password",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer "))
        return reply.status(401).send({ error: "Missing authorization" });

      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const db = (app as any).db;
      const { currentPassword, newPassword } = req.body as any;

      const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user || !user.passwordHash) return reply.status(404).send({ error: "User not found" });

      const valid = await verifyPassword(user.passwordHash, currentPassword);
      if (!valid) return reply.status(400).send({ error: "Current password is incorrect" });

      const recent = await db
        .select()
        .from(passwordHistory)
        .where(eq(passwordHistory.userId, user.id))
        .orderBy(sql`${passwordHistory.createdAt} DESC`)
        .limit(PASSWORD_HISTORY_DEPTH);
      const policy = await evaluatePassword(newPassword, {
        role: user.role,
        email: user.email,
        name: user.name,
        historyVerifier: async (cand) => {
          for (const h of recent) {
            try {
              if (await verifyPassword(h.passwordHash, cand)) return true;
            } catch {
              /*skip*/
            }
          }
          try {
            if (await verifyPassword(user.passwordHash, cand)) return true;
          } catch {
            /*skip*/
          }
          return false;
        },
      });
      if (!policy.ok) {
        return reply.status(400).send({
          error: "Password does not meet our policy",
          reasons: policy.reasons,
          strengthScore: policy.strengthScore,
        });
      }
      const newHash = await hashPassword(newPassword);
      await db
        .update(users)
        .set({
          passwordHash: newHash,
          passwordChangedAt: new Date(),
          mustChangePassword: false,
        } as any)
        .where(eq(users.id, payload.sub));
      await db.insert(passwordHistory).values({ userId: user.id, passwordHash: newHash });
      await db.execute(sql`
      DELETE FROM password_history
      WHERE user_id = ${user.id}
        AND id NOT IN (
          SELECT id FROM password_history
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT ${PASSWORD_HISTORY_DEPTH}
        )
    `);
      await db.delete(sessions).where(eq(sessions.userId, payload.sub));
      return { success: true };
    },
  );

  app.put(
    "/api/auth/profile",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            email: { type: "string", format: "email" },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer "))
        return reply.status(401).send({ error: "Missing authorization" });

      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const db = (app as any).db;
      const { name, email } = req.body as any;
      const updates: any = {};
      if (name) updates.name = name;
      if (email) {
        const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existing && existing.id !== payload.sub)
          return reply.status(409).send({ error: "Email already in use" });
        updates.email = email;
      }

      if (Object.keys(updates).length === 0)
        return reply.status(400).send({ error: "No fields to update" });

      await db.update(users).set(updates).where(eq(users.id, payload.sub));
      const [updated] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      return {
        user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
      };
    },
  );

  app.delete(
    "/api/auth/account",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["password"],
          properties: {
            password: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer "))
        return reply.status(401).send({ error: "Missing authorization" });

      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const db = (app as any).db;
      const { password } = req.body as any;

      const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user || !user.passwordHash) return reply.status(404).send({ error: "User not found" });

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) return reply.status(400).send({ error: "Incorrect password" });

      const userLearners = await db
        .select()
        .from(learners)
        .where(eq(learners.parentId, payload.sub));
      for (const l of userLearners) {
        await deleteLearnerCascade(db, l.id);
        if (l.userId) {
          await deleteUserCascade(db, l.userId);
        }
      }
      await deleteUserCascade(db, payload.sub);

      reply.clearCookie("refreshToken", { path: "/" });
      clearSurfaceCookie(reply);
      return { success: true, deleted: true };
    },
  );

  app.delete(
    "/api/auth/learner/:learnerId",
    {
      schema: { tags: ["Auth"] },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer "))
        return reply.status(401).send({ error: "Missing authorization" });

      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const db = (app as any).db;
      const { learnerId } = req.params as any;

      const [learner] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
      if (!learner) return reply.status(404).send({ error: "Learner not found" });
      if (learner.parentId !== payload.sub)
        return reply.status(403).send({ error: "You can only delete your own learners" });

      try {
        await deleteLearnerCascade(db, learnerId);
        if (learner.userId) {
          await deleteUserCascade(db, learner.userId);
        }
      } catch (err: any) {
        app.log.error({ err: err.message, learnerId }, "Failed to delete learner");
        return reply.status(500).send({ error: "Failed to delete learner", detail: err.message });
      }

      return { success: true, deletedLearnerId: learnerId };
    },
  );

  /**
   * Complete MFA challenge. Accepts:
   *   - 6-digit email OTP (from `mfa_codes.code_hash`)
   *   - 6-digit TOTP code (verified against decrypted `users.totp_secret_encrypted`)
   *   - 12-char recovery code (e.g. "ABCD-EFGH-JKLM"; matched against argon2id hash)
   *
   * Counts every wrong submission against the per-user lockout window
   * (5 fails / 10 min => 15 min lock). Successful redemption clears it.
   */
  app.post(
    "/api/auth/verify-mfa",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["mfaToken", "code"],
          properties: {
            mfaToken: { type: "string" },
            code: { type: "string", minLength: 4, maxLength: 32 },
          },
        },
      },
    },
    async (req, reply) => {
      const { mfaToken, code } = req.body as any;
      const db = (app as any).db;

      let payload: any;
      try {
        payload = await verifyJWT<MfaChallengeJWT>(mfaToken);
      } catch {
        return reply.status(401).send({ error: "MFA session expired. Please login again." });
      }
      if (payload.purpose !== "mfa") return reply.status(401).send({ error: "Invalid MFA token" });

      if (await isMfaLocked(db, payload.sub)) {
        const remaining = await lockoutSecondsRemaining(db, payload.sub);
        return reply.status(429).send({
          error: "Account temporarily locked due to too many failed attempts.",
          retryAfterSeconds: remaining,
        });
      }

      const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user) return reply.status(404).send({ error: "User not found" });

      const trimmed = String(code || "").trim();
      let success = false;
      let usedRecovery = false;

      // 1. Recovery code (multi-char, alphanum-with-dashes).
      if (looksLikeRecoveryCode(trimmed)) {
        success = await redeemRecoveryCode(db, user.id, trimmed);
        usedRecovery = success;
      }
      // 2. TOTP if user has an enrolled authenticator app.
      else if (userMayUseTotp(user) && /^\d{6}$/.test(trimmed)) {
        try {
          const secret = decryptSecret(user.totpSecretEncrypted);
          success = verifyTotpCode(secret, trimmed);
        } catch {
          success = false;
        }
      }
      // 3. Email OTP — only when this MFA challenge was issued for the email
      //    method. This prevents downgrade attacks where a user challenged for
      //    WebAuthn or TOTP could submit an emailed code from a stale or
      //    attacker-influenced channel.
      else if (challengeAllowsEmailOtp(payload) && /^\d{6}$/.test(trimmed)) {
        const [mfaRecord] = await db
          .select()
          .from(mfaCodes)
          .where(
            and(
              eq(mfaCodes.userId, user.id),
              eq(mfaCodes.used, false),
              eq(mfaCodes.purpose, "login"),
            ),
          )
          .orderBy(sql`created_at DESC`)
          .limit(1);
        if (!mfaRecord)
          return reply.status(400).send({ error: "No active MFA code. Please login again." });
        if (new Date(mfaRecord.expiresAt) < new Date())
          return reply.status(400).send({ error: "Code expired. Please request a new one." });
        if (mfaRecord.attempts >= 5) {
          await db
            .update(mfaCodes)
            .set({ used: true, usedAt: new Date() })
            .where(eq(mfaCodes.id, mfaRecord.id));
          return reply.status(429).send({ error: "Too many attempts. Please login again." });
        }
        const expectedHash = hashOtpCode(trimmed);
        if (timingSafeEqualHex(mfaRecord.codeHash, expectedHash)) {
          await db
            .update(mfaCodes)
            .set({ used: true, usedAt: new Date() })
            .where(eq(mfaCodes.id, mfaRecord.id));
          success = true;
        } else {
          await db
            .update(mfaCodes)
            .set({ attempts: sql`${mfaCodes.attempts} + 1` })
            .where(and(eq(mfaCodes.id, mfaRecord.id), sql`${mfaCodes.attempts} < 5`));
        }
      }

      if (!success) {
        const fail = await recordMfaFailure(db, user.id);
        if (fail.locked) {
          return reply
            .status(429)
            .send({ error: "Too many failed attempts. Account locked for 15 minutes." });
        }
        return reply
          .status(400)
          .send({ error: "Invalid code", attemptsRemaining: Math.max(0, 5 - fail.attempts) });
      }

      await clearMfaFailures(db, user.id);

      if (usedRecovery) {
        const remaining = await countActiveRecoveryCodes(db, user.id);
        const clientIp =
          req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
        await appendAudit(db, "audit_events", auditEvents, {
          tenantId: user.tenantId,
          userId: user.id,
          eventType: "MFA_RECOVERY_USED",
          resourceType: "user",
          resourceId: user.id,
          details: { remainingRecoveryCodes: remaining },
          ipAddress: clientIp,
          userAgent: (req.headers["user-agent"] as string) || null,
        });
        // Best-effort notification email; never block login on comms failure.
        fetch(`${COMMS_URL}/api/comms/internal/mfa-recovery-used`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
          body: JSON.stringify({ to: user.email, name: user.name, remaining }),
        }).catch(() => null);
      }

      const clientIp =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), lastLoginIp: clientIp })
        .where(eq(users.id, user.id));

      const availableRoles = await loadAvailableRoles(db, user.id, user.role);
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        availableRoles,
        email: user.email!,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });

      const rawRefreshToken = crypto.randomUUID();
      const ttlMs = refreshTtlMs(user.role);
      const hashedRT = hashRefreshToken(rawRefreshToken);
      await db.insert(sessions).values({
        userId: user.id,
        refreshToken: hashedRT,
        expiresAt: new Date(Date.now() + ttlMs),
      });
      if (isInternalRole(user.role)) {
        await recordAdminLogin(db, user.id, hashedRT, req.headers, clientIp);
      }

      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(ttlMs / 1000),
      });
      await setSurfaceCookie(reply, user.role);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        accessToken,
        usedRecoveryCode: usedRecovery,
        mustChangePassword: computeMustChangePassword(user),
      };
    },
  );

  app.post(
    "/api/auth/mfa/resend",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["mfaToken"],
          properties: {
            mfaToken: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { mfaToken } = req.body as any;
      const db = (app as any).db;

      let payload: any;
      try {
        payload = await verifyJWT<MfaChallengeJWT>(mfaToken);
      } catch {
        return reply.status(401).send({ error: "MFA session expired. Please login again." });
      }
      if (payload.purpose !== "mfa") {
        return reply.status(401).send({ error: "Invalid MFA token" });
      }
      // Resend only applies to email-OTP challenges. Refusing here prevents
      // a downgrade attack against WebAuthn / TOTP challenges.
      if (!challengeAllowsEmailResend(payload)) {
        return reply.status(400).send({ error: "Resend is only available for email codes." });
      }

      const [existing] = await db
        .select()
        .from(mfaCodes)
        .where(and(eq(mfaCodes.userId, payload.sub), eq(mfaCodes.used, false)))
        .orderBy(sql`created_at DESC`)
        .limit(1);

      if (existing && existing.resends >= 3) {
        return reply.status(429).send({ error: "Maximum resends reached. Please login again." });
      }

      if (existing) {
        await db
          .update(mfaCodes)
          .set({ used: true, usedAt: new Date() })
          .where(eq(mfaCodes.id, existing.id));
      }

      const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user) return reply.status(404).send({ error: "User not found" });

      const code = generateMfaCode();
      await db.insert(mfaCodes).values({
        userId: user.id,
        codeHash: hashOtpCode(code),
        purpose: existing?.purpose || "login",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        resends: (existing?.resends ?? 0) + 1,
      });

      const commsRes = await fetch(`${COMMS_URL}/api/comms/internal/mfa-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
        body: JSON.stringify({ to: user.email, code, name: user.name }),
      }).catch(() => null);

      if (!commsRes || !commsRes.ok) {
        return reply
          .status(502)
          .send({ error: "Failed to send verification code. Please try again." });
      }

      return { success: true, resendsRemaining: 2 - (existing?.resends ?? 0) };
    },
  );

  app.post(
    "/api/auth/mfa/enable",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["password"],
          properties: {
            password: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer "))
        return reply.status(401).send({ error: "Missing authorization" });

      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const db = (app as any).db;
      const { password } = req.body as any;

      const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user || !user.passwordHash) return reply.status(404).send({ error: "User not found" });

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) return reply.status(400).send({ error: "Incorrect password" });

      try {
        await createAndSendMfaCode(db, user.id, user.email!, user.name, "enable");
      } catch {
        return reply
          .status(502)
          .send({ error: "Failed to send verification code. Please try again." });
      }
      const mfaToken = await signMfaToken(user.id, user.email!);
      return { success: true, mfaPending: true, mfaToken };
    },
  );

  app.post(
    "/api/auth/mfa/confirm-enable",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["mfaToken", "code"],
          properties: {
            mfaToken: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { mfaToken, code } = req.body as any;
      const db = (app as any).db;

      let payload: any;
      try {
        payload = await verifyJWT<MfaChallengeJWT>(mfaToken);
      } catch {
        return reply.status(401).send({ error: "Session expired" });
      }
      if (payload.purpose !== "mfa") return reply.status(401).send({ error: "Invalid token" });

      const [mfaRecord] = await db
        .select()
        .from(mfaCodes)
        .where(
          and(
            eq(mfaCodes.userId, payload.sub),
            eq(mfaCodes.used, false),
            eq(mfaCodes.purpose, "enable"),
          ),
        )
        .orderBy(sql`created_at DESC`)
        .limit(1);

      if (!mfaRecord) return reply.status(400).send({ error: "No pending code found" });
      if (new Date(mfaRecord.expiresAt) < new Date())
        return reply.status(400).send({ error: "Code expired" });
      if (mfaRecord.attempts >= 5) {
        await db
          .update(mfaCodes)
          .set({ used: true, usedAt: new Date() })
          .where(eq(mfaCodes.id, mfaRecord.id));
        return reply.status(429).send({ error: "Too many attempts" });
      }
      if (!timingSafeEqualHex(mfaRecord.codeHash, hashOtpCode(code))) {
        await db
          .update(mfaCodes)
          .set({ attempts: sql`${mfaCodes.attempts} + 1` })
          .where(and(eq(mfaCodes.id, mfaRecord.id), sql`${mfaCodes.attempts} < 5`));
        return reply.status(400).send({ error: "Invalid code" });
      }

      await db
        .update(mfaCodes)
        .set({ used: true, usedAt: new Date() })
        .where(eq(mfaCodes.id, mfaRecord.id));
      await db
        .update(users)
        .set({ mfaEnabled: true, mfaMethod: "email" })
        .where(eq(users.id, payload.sub));
      return { success: true, mfaEnabled: true };
    },
  );

  app.post(
    "/api/auth/mfa/disable",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["password"],
          properties: {
            password: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer "))
        return reply.status(401).send({ error: "Missing authorization" });

      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const db = (app as any).db;
      const { password } = req.body as any;

      const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user || !user.passwordHash) return reply.status(404).send({ error: "User not found" });

      if (MFA_FORCED_ROLES.includes(user.role)) {
        return reply.status(403).send({ error: "MFA cannot be disabled for admin roles" });
      }

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) return reply.status(400).send({ error: "Incorrect password" });

      await db.update(users).set({ mfaEnabled: false }).where(eq(users.id, user.id));
      return { success: true, mfaEnabled: false };
    },
  );

  app.get(
    "/api/auth/mfa/status",
    {
      schema: { tags: ["Auth"] },
    },
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer "))
        return reply.status(401).send({ error: "Missing authorization" });

      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const db = (app as any).db;
      const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      if (!user) return reply.status(404).send({ error: "User not found" });

      const passkeys = await db
        .select({ id: webauthnCredentials.id })
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, user.id));
      const recoveryRemaining = await countActiveRecoveryCodes(db, user.id);
      const webauthnCount = passkeys.length;

      return {
        mfaEnabled: !!user.mfaEnabled,
        mfaMethod: user.mfaMethod || "email",
        mfaForced: MFA_FORCED_ROLES.includes(user.role),
        hasTotp: !!user.totpSecretEncrypted && user.mfaMethod === "totp",
        hasPasskey: webauthnCount > 0,
        webauthnCount,
        recoveryRemaining,
        recoveryCodesRemaining: recoveryRemaining,
        strongMfaEnforced: !!ADMIN_ENTERPRISE.STRONG_MFA,
        strongMfaEnabled: !!ADMIN_ENTERPRISE.STRONG_MFA,
      };
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Sprint 2 — Phishing-resistant MFA: TOTP, WebAuthn passkeys, recovery codes.
  // All endpoints require a valid access token; password re-auth is required for
  // any state change that could lock a user out of their account.
  // ──────────────────────────────────────────────────────────────────────────

  function requireBearer(req: any): string | null {
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith("Bearer ")) return null;
    return auth.slice(7);
  }
  async function requireUser(app: FastifyInstance, req: any, reply: any) {
    const token = requireBearer(req);
    if (!token) {
      reply.status(401).send({ error: "Missing authorization" });
      return null;
    }
    let payload: any;
    try {
      payload = await verifyJWT(token);
    } catch {
      reply.status(401).send({ error: "Invalid token" });
      return null;
    }
    const db = (app as any).db;
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user) {
      reply.status(404).send({ error: "User not found" });
      return null;
    }
    return { user, db, payload };
  }

  // ── TOTP enrollment ────────────────────────────────────────────────────────

  app.post("/api/auth/mfa/totp/enroll", { schema: { tags: ["MFA"] } }, async (req, reply) => {
    const ctx = await requireUser(app, req, reply);
    if (!ctx) return;
    const { user } = ctx;
    if (!user.email) return reply.status(400).send({ error: "Account has no email" });
    const { base32Secret, otpauthUrl } = generateTotpSecret(user.email);
    // Carry the unsaved secret in a short-lived JWT so we never persist
    // an unconfirmed secret.
    const enrollToken = await signJWT(
      { sub: user.id, tenantId: "", role: "", purpose: "totp-enroll", secret: base32Secret } as any,
      "10m",
    );
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
    } catch {}
    return { enrollToken, otpauthUrl, base32Secret, qrDataUrl };
  });

  app.post(
    "/api/auth/mfa/totp/confirm",
    {
      schema: {
        tags: ["MFA"],
        body: {
          type: "object",
          required: ["enrollToken", "code"],
          properties: {
            enrollToken: { type: "string" },
            code: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (req, reply) => {
      const ctx = await requireUser(app, req, reply);
      if (!ctx) return;
      const { user, db } = ctx;
      const { enrollToken, code } = req.body as any;
      let payload: any;
      try {
        payload = await verifyJWT(enrollToken);
      } catch {
        return reply.status(400).send({ error: "Enrollment session expired" });
      }
      if (payload.purpose !== "totp-enroll" || payload.sub !== user.id) {
        return reply.status(400).send({ error: "Invalid enrollment token" });
      }
      if (!verifyTotpCode(payload.secret, code)) {
        return reply.status(400).send({ error: "Invalid code — please try again" });
      }
      await db
        .update(users)
        .set({
          totpSecretEncrypted: encryptSecret(payload.secret),
          mfaMethod: "totp",
          mfaEnabled: true,
        })
        .where(eq(users.id, user.id));
      const recoveryCodes = await regenerateRecoveryCodes(db, user.id);
      const clientIp =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
      await appendAudit(db, "audit_events", auditEvents, {
        tenantId: user.tenantId,
        userId: user.id,
        eventType: "MFA_TOTP_ENROLLED",
        resourceType: "user",
        resourceId: user.id,
        ipAddress: clientIp,
        userAgent: (req.headers["user-agent"] as string) || null,
      });
      return { success: true, recoveryCodes };
    },
  );

  app.post(
    "/api/auth/mfa/totp/disable",
    {
      schema: {
        tags: ["MFA"],
        body: {
          type: "object",
          required: ["password"],
          properties: { password: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const ctx = await requireUser(app, req, reply);
      if (!ctx) return;
      const { user, db } = ctx;
      if (MFA_FORCED_ROLES.includes(user.role) && ADMIN_ENTERPRISE.STRONG_MFA) {
        return reply
          .status(403)
          .send({ error: "TOTP cannot be disabled for admin roles when STRONG_MFA is enforced" });
      }
      const { password } = req.body as any;
      if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
        return reply.status(400).send({ error: "Incorrect password" });
      }
      await db
        .update(users)
        .set({ totpSecretEncrypted: null, mfaMethod: "email" })
        .where(eq(users.id, user.id));
      await appendAudit(db, "audit_events", auditEvents, {
        tenantId: user.tenantId,
        userId: user.id,
        eventType: "MFA_TOTP_DISABLED",
        resourceType: "user",
        resourceId: user.id,
      });
      return { success: true };
    },
  );

  // ── WebAuthn passkeys ──────────────────────────────────────────────────────

  app.post(
    "/api/auth/mfa/webauthn/register/options",
    { schema: { tags: ["MFA"] } },
    async (req, reply) => {
      const ctx = await requireUser(app, req, reply);
      if (!ctx) return;
      const { user, db } = ctx;
      const existing = await db
        .select({
          credentialId: webauthnCredentials.credentialId,
          transports: webauthnCredentials.transports,
        })
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, user.id));
      const options = await generateRegistrationOptions({
        rpName: getRpName(),
        rpID: getRpId(req),
        userID: Buffer.from(user.id),
        userName: user.email || user.id,
        userDisplayName: user.name,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
        excludeCredentials: existing.map((c: any) => ({
          id: c.credentialId,
          transports: c.transports ? c.transports.split(",") : undefined,
        })),
      });
      const challengeToken = await signWebauthnChallenge({
        userId: user.id,
        challenge: options.challenge,
        purpose: "register",
      });
      return { options, challengeToken };
    },
  );

  app.post(
    "/api/auth/mfa/webauthn/register/verify",
    {
      schema: {
        tags: ["MFA"],
        body: {
          type: "object",
          required: ["challengeToken", "response"],
          properties: {
            challengeToken: { type: "string" },
            response: { type: "object" },
            label: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const ctx = await requireUser(app, req, reply);
      if (!ctx) return;
      const { user, db } = ctx;
      const { challengeToken, response, label } = req.body as any;
      let challenge: { userId: string; challenge: string };
      try {
        challenge = await verifyWebauthnChallengeToken(challengeToken, "register");
      } catch {
        return reply.status(400).send({ error: "Challenge expired or invalid" });
      }
      if (challenge.userId !== user.id)
        return reply.status(403).send({ error: "Challenge user mismatch" });

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: getExpectedOrigin(req),
          expectedRPID: getRpId(req),
          requireUserVerification: false,
        });
      } catch (err: any) {
        app.log.warn({ err: err.message }, "webauthn register verify failed");
        return reply.status(400).send({ error: err.message || "Registration failed" });
      }
      if (!verification.verified || !verification.registrationInfo) {
        return reply.status(400).send({ error: "Registration could not be verified" });
      }
      const info: any = verification.registrationInfo;
      const credential = info.credential ?? info; // simplewebauthn v10 vs v11
      const credentialId: string =
        credential.id ??
        Buffer.from(credential.credentialID || info.credentialID).toString("base64url");
      const publicKey: string = Buffer.from(
        credential.publicKey || info.credentialPublicKey,
      ).toString("base64");
      const counter: number = credential.counter ?? info.counter ?? 0;
      const transports: string | null = Array.isArray(response.response?.transports)
        ? response.response.transports.join(",")
        : null;
      const deviceType: string | null = info.credentialDeviceType || null;

      const isFirstCredential =
        (
          await db
            .select({ id: webauthnCredentials.id })
            .from(webauthnCredentials)
            .where(eq(webauthnCredentials.userId, user.id))
            .limit(1)
        ).length === 0;

      await db.insert(webauthnCredentials).values({
        userId: user.id,
        credentialId,
        publicKey,
        counter,
        transports,
        label: (label || "Passkey").slice(0, 120),
        deviceType,
        backedUp: !!info.credentialBackedUp,
      });

      let recoveryCodes: string[] | undefined;
      if (isFirstCredential) {
        // Bump method preference up to passkey, mint recovery codes.
        await db
          .update(users)
          .set({ mfaEnabled: true, mfaMethod: "webauthn" })
          .where(eq(users.id, user.id));
        recoveryCodes = await regenerateRecoveryCodes(db, user.id);
      }

      await appendAudit(db, "audit_events", auditEvents, {
        tenantId: user.tenantId,
        userId: user.id,
        eventType: "MFA_WEBAUTHN_REGISTERED",
        resourceType: "webauthn_credential",
        resourceId: credentialId,
        details: { label: label || "Passkey", deviceType },
      });

      return { success: true, credentialId, recoveryCodes };
    },
  );

  app.get(
    "/api/auth/mfa/webauthn/credentials",
    { schema: { tags: ["MFA"] } },
    async (req, reply) => {
      const ctx = await requireUser(app, req, reply);
      if (!ctx) return;
      const { user, db } = ctx;
      const rows = await db
        .select({
          id: webauthnCredentials.id,
          label: webauthnCredentials.label,
          deviceType: webauthnCredentials.deviceType,
          createdAt: webauthnCredentials.createdAt,
          lastUsedAt: webauthnCredentials.lastUsedAt,
        })
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, user.id));
      return { credentials: rows };
    },
  );

  app.patch(
    "/api/auth/mfa/webauthn/credentials/:id",
    {
      schema: {
        tags: ["MFA"],
        params: { type: "object", properties: { id: { type: "string" } } },
        body: {
          type: "object",
          required: ["label"],
          properties: { label: { type: "string", minLength: 1, maxLength: 120 } },
        },
      },
    },
    async (req, reply) => {
      const ctx = await requireUser(app, req, reply);
      if (!ctx) return;
      const { user, db } = ctx;
      const { id } = req.params as any;
      const { label } = req.body as any;
      const result = await db
        .update(webauthnCredentials)
        .set({ label: String(label).slice(0, 120) })
        .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, user.id)))
        .returning({ id: webauthnCredentials.id });
      if (!result.length) return reply.status(404).send({ error: "Credential not found" });
      return { success: true };
    },
  );

  app.delete(
    "/api/auth/mfa/webauthn/credentials/:id",
    { schema: { tags: ["MFA"] } },
    async (req, reply) => {
      const ctx = await requireUser(app, req, reply);
      if (!ctx) return;
      const { user, db } = ctx;
      const { id } = req.params as any;
      const result = await db
        .delete(webauthnCredentials)
        .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, user.id)))
        .returning({ id: webauthnCredentials.id });
      if (!result.length) return reply.status(404).send({ error: "Credential not found" });
      // If user no longer has any passkey, fall back to TOTP if enrolled, else email.
      const remaining = await db
        .select({ id: webauthnCredentials.id })
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, user.id))
        .limit(1);
      if (!remaining.length) {
        const fallback = user.totpSecretEncrypted ? "totp" : "email";
        await db.update(users).set({ mfaMethod: fallback }).where(eq(users.id, user.id));
      }
      await appendAudit(db, "audit_events", auditEvents, {
        tenantId: user.tenantId,
        userId: user.id,
        eventType: "MFA_WEBAUTHN_REVOKED",
        resourceType: "webauthn_credential",
        resourceId: id,
      });
      return { success: true };
    },
  );

  // ── WebAuthn login ─────────────────────────────────────────────────────────

  app.post(
    "/api/auth/mfa/webauthn/login/options",
    {
      schema: {
        tags: ["MFA"],
        body: {
          type: "object",
          required: ["mfaToken"],
          properties: { mfaToken: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const { mfaToken } = req.body as any;
      const db = (app as any).db;
      let payload: any;
      try {
        payload = await verifyJWT<MfaChallengeJWT>(mfaToken);
      } catch {
        return reply.status(401).send({ error: "MFA session expired" });
      }
      if (payload.purpose !== "mfa") return reply.status(401).send({ error: "Invalid MFA token" });
      if (await isMfaLocked(db, payload.sub))
        return reply.status(429).send({ error: "Account temporarily locked" });

      const creds = await db
        .select({
          credentialId: webauthnCredentials.credentialId,
          transports: webauthnCredentials.transports,
        })
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, payload.sub));
      if (!creds.length)
        return reply.status(400).send({ error: "No passkey enrolled for this account" });

      const options = await generateAuthenticationOptions({
        rpID: getRpId(req),
        userVerification: "preferred",
        allowCredentials: creds.map((c: any) => ({
          id: c.credentialId,
          transports: c.transports ? c.transports.split(",") : undefined,
        })),
      });
      const challengeToken = await signWebauthnChallenge({
        userId: payload.sub,
        challenge: options.challenge,
        purpose: "login",
      });
      return { options, challengeToken };
    },
  );

  app.post(
    "/api/auth/mfa/webauthn/login/verify",
    {
      schema: {
        tags: ["MFA"],
        body: {
          type: "object",
          required: ["challengeToken", "response"],
          properties: { challengeToken: { type: "string" }, response: { type: "object" } },
        },
      },
    },
    async (req, reply) => {
      const { challengeToken, response } = req.body as any;
      const db = (app as any).db;
      let challenge: { userId: string; challenge: string };
      try {
        challenge = await verifyWebauthnChallengeToken(challengeToken, "login");
      } catch {
        return reply.status(400).send({ error: "Challenge expired or invalid" });
      }

      if (await isMfaLocked(db, challenge.userId))
        return reply.status(429).send({ error: "Account temporarily locked" });

      const responseId =
        response?.id ||
        (response?.rawId && Buffer.from(response.rawId, "base64url").toString("base64url"));
      if (!responseId) return reply.status(400).send({ error: "Malformed response" });

      const [cred] = await db
        .select()
        .from(webauthnCredentials)
        .where(
          and(
            eq(webauthnCredentials.userId, challenge.userId),
            eq(webauthnCredentials.credentialId, responseId),
          ),
        )
        .limit(1);
      if (!cred) return reply.status(400).send({ error: "Unknown credential" });

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: getExpectedOrigin(req),
          expectedRPID: getRpId(req),
          credential: {
            id: cred.credentialId,
            publicKey: Buffer.from(cred.publicKey, "base64"),
            counter: Number(cred.counter || 0),
            transports: cred.transports ? cred.transports.split(",") : undefined,
          } as any,
          requireUserVerification: false,
        });
      } catch (err: any) {
        const fail = await recordMfaFailure(db, challenge.userId);
        app.log.warn({ err: err.message, locked: fail.locked }, "webauthn login verify failed");
        return reply.status(400).send({ error: err.message || "Authentication failed" });
      }
      if (!verification.verified) {
        await recordMfaFailure(db, challenge.userId);
        return reply.status(400).send({ error: "Authentication could not be verified" });
      }

      await db
        .update(webauthnCredentials)
        .set({
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        })
        .where(eq(webauthnCredentials.id, cred.id));
      await clearMfaFailures(db, challenge.userId);

      const [user] = await db.select().from(users).where(eq(users.id, challenge.userId)).limit(1);
      if (!user) return reply.status(404).send({ error: "User not found" });

      const clientIp =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), lastLoginIp: clientIp })
        .where(eq(users.id, user.id));
      const availableRoles = await loadAvailableRoles(db, user.id, user.role);
      const accessToken = await signJWT({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        availableRoles,
        email: user.email!,
        name: user.name,
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
      });
      const rawRefreshToken = crypto.randomUUID();
      const ttlMs = refreshTtlMs(user.role);
      const hashedRT = hashRefreshToken(rawRefreshToken);
      await db.insert(sessions).values({
        userId: user.id,
        refreshToken: hashedRT,
        expiresAt: new Date(Date.now() + ttlMs),
      });
      if (isInternalRole(user.role)) {
        await recordAdminLogin(db, user.id, hashedRT, req.headers, clientIp);
      }
      reply.setCookie("refreshToken", rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.floor(ttlMs / 1000),
      });
      await setSurfaceCookie(reply, user.role);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
        accessToken,
        mustChangePassword: computeMustChangePassword(user),
      };
    },
  );

  // ── Recovery codes ─────────────────────────────────────────────────────────

  app.get("/api/auth/mfa/recovery/status", { schema: { tags: ["MFA"] } }, async (req, reply) => {
    const ctx = await requireUser(app, req, reply);
    if (!ctx) return;
    const remaining = await countActiveRecoveryCodes(ctx.db, ctx.user.id);
    return { remaining, total: 10 };
  });

  app.post(
    "/api/auth/mfa/recovery/regenerate",
    {
      schema: {
        tags: ["MFA"],
        body: {
          type: "object",
          required: ["password"],
          properties: { password: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const ctx = await requireUser(app, req, reply);
      if (!ctx) return;
      const { user, db } = ctx;
      const { password } = req.body as any;
      if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
        return reply.status(400).send({ error: "Incorrect password" });
      }
      const codes = await regenerateRecoveryCodes(db, user.id);
      await appendAudit(db, "audit_events", auditEvents, {
        tenantId: user.tenantId,
        userId: user.id,
        eventType: "MFA_RECOVERY_REGENERATED",
        resourceType: "user",
        resourceId: user.id,
      });
      return { recoveryCodes: codes, codes };
    },
  );

  setInterval(
    async () => {
      try {
        const db = (app as any).db;
        await db
          .delete(mfaCodes)
          .where(lt(mfaCodes.expiresAt, new Date(Date.now() - 60 * 60 * 1000)));
      } catch {}
    },
    60 * 60 * 1000,
  );
}
