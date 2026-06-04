/**
 * Sprint 9 — Secure impersonation. Runs without a database: the routes are
 * registered with an in-memory store and injected resolvers, and JWTs are
 * signed/verified with @aivo/security's in-process ephemeral keypair.
 *
 * Run directly:  tsx --test tests/impersonation.test.ts
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { signJWT, verifyJWT, initKeys, type JWTPayload } from "@aivo/security";
import {
  clampTtlSeconds,
  evaluateRbac,
  evaluateConsent,
  buildImpersonationClaims,
  DEFAULT_TTL_SECONDS,
  HARD_CAP_SECONDS,
  type Actor,
  type Subject,
} from "../src/lib/impersonation.js";
import {
  registerImpersonationRoutes,
  type ImpersonationDeps,
} from "../src/routes/impersonation.js";
import { createInMemoryImpersonationStore } from "../src/lib/impersonation-store.js";

before(async () => {
  await initKeys();
});

// ── Pure logic ──────────────────────────────────────────────────────────────

describe("clampTtlSeconds", () => {
  const tenant = { enabled: true };
  it("defaults to 15 min when unset", () => {
    assert.equal(clampTtlSeconds(undefined, tenant), DEFAULT_TTL_SECONDS);
  });
  it("hard-caps at 30 min", () => {
    assert.equal(clampTtlSeconds(99 * 60, tenant), HARD_CAP_SECONDS);
  });
  it("respects a per-tenant max (floored at 5 min)", () => {
    assert.equal(clampTtlSeconds(20 * 60, { enabled: true, maxTtlSeconds: 10 * 60 }), 10 * 60);
    // A sub-5-min tenant max is floored to 5 min.
    assert.equal(clampTtlSeconds(20 * 60, { enabled: true, maxTtlSeconds: 60 }), 5 * 60);
  });
});

describe("evaluateRbac matrix", () => {
  const platform: Actor = { userId: "p1", role: "platform_admin", tenantId: "t1" };
  const district: Actor = {
    userId: "d1",
    role: "district_admin",
    tenantId: "t1",
    districtId: "dist1",
  };
  const school: Actor = { userId: "s1", role: "school_admin", tenantId: "t1", schoolId: "sch1" };

  const learnerInSchool: Subject = {
    userId: "l1",
    role: "learner",
    tenantId: "t1",
    districtId: "dist1",
    schoolId: "sch1",
  };

  it("rejects self-impersonation", () => {
    assert.equal(
      evaluateRbac(platform, { ...learnerInSchool, userId: "p1" }).reason,
      "SELF_IMPERSONATION",
    );
  });
  it("platform admin may impersonate a learner with no break-glass", () => {
    const r = evaluateRbac(platform, learnerInSchool);
    assert.equal(r.allowed, true);
    assert.equal(r.requiresBreakGlass, false);
  });
  it("platform admin impersonating another admin requires break-glass", () => {
    const r = evaluateRbac(platform, { ...learnerInSchool, role: "district_admin" });
    assert.equal(r.allowed, true);
    assert.equal(r.requiresBreakGlass, true);
  });
  it("district admin cannot target an admin", () => {
    assert.equal(
      evaluateRbac(district, { ...learnerInSchool, role: "platform_admin" }).reason,
      "ADMIN_TARGET_FORBIDDEN",
    );
  });
  it("district admin blocked cross-district", () => {
    assert.equal(
      evaluateRbac(district, { ...learnerInSchool, districtId: "other" }).reason,
      "CROSS_DISTRICT",
    );
  });
  it("school admin limited to their school and to learner/teacher/parent", () => {
    assert.equal(evaluateRbac(school, learnerInSchool).allowed, true);
    assert.equal(
      evaluateRbac(school, { ...learnerInSchool, schoolId: "other" }).reason,
      "CROSS_SCHOOL",
    );
    assert.equal(
      evaluateRbac(school, { ...learnerInSchool, role: "district_admin" }).reason,
      "ADMIN_TARGET_FORBIDDEN",
    );
  });
});

describe("evaluateConsent", () => {
  const adult: Subject = { userId: "a", role: "teacher", tenantId: "t1", ageYears: 34 };
  const minor: Subject = { userId: "m", role: "learner", tenantId: "t1", ageYears: 10 };
  const rbacOk = { allowed: true, reason: null, requiresBreakGlass: false } as const;
  const tenantOn = { enabled: true };

  it("tenant can globally disable impersonation", () => {
    assert.equal(
      evaluateConsent(adult, { hasSubjectConsent: true }, { enabled: false }, rbacOk).reason,
      "TENANT_DISABLED",
    );
  });
  it("adult: subject consent / justification ticket / platform override each work", () => {
    assert.equal(
      evaluateConsent(adult, { hasSubjectConsent: true }, tenantOn, rbacOk).basis,
      "SUBJECT_CONSENT",
    );
    assert.equal(
      evaluateConsent(adult, { justificationTicketId: "TICK-1" }, tenantOn, rbacOk).basis,
      "JUSTIFICATION_TICKET",
    );
    assert.equal(
      evaluateConsent(adult, { platformOverride: true }, tenantOn, rbacOk).basis,
      "PLATFORM_OVERRIDE",
    );
  });
  it("adult with no basis is denied", () => {
    assert.equal(evaluateConsent(adult, {}, tenantOn, rbacOk).reason, "ADULT_NO_BASIS");
  });
  it("minor requires guardian consent or open incident (ticket/override do NOT bypass)", () => {
    assert.equal(
      evaluateConsent(minor, { hasGuardianConsent: true }, tenantOn, rbacOk).basis,
      "GUARDIAN_CONSENT",
    );
    assert.equal(
      evaluateConsent(minor, { hasOpenIncident: true }, tenantOn, rbacOk).basis,
      "OPEN_INCIDENT",
    );
    assert.equal(
      evaluateConsent(
        minor,
        { justificationTicketId: "T", platformOverride: true },
        tenantOn,
        rbacOk,
      ).reason,
      "MINOR_NO_GUARDIAN_CONSENT",
    );
  });
  it("break-glass required reason when targeting admin without code", () => {
    const r = evaluateConsent(adult, { hasSubjectConsent: true }, tenantOn, {
      allowed: true,
      reason: null,
      requiresBreakGlass: true,
    });
    assert.equal(r.reason, "BREAK_GLASS_REQUIRED");
  });
});

// ── Token claim shape ────────────────────────────────────────────────────────

describe("buildImpersonationClaims", () => {
  it("produces the documented claim shape with imp_exp from TTL", () => {
    const subject: Subject = { userId: "u2", role: "learner", tenantId: "t1" };
    const nowMs = 1_700_000_000_000;
    const claims = buildImpersonationClaims({
      actorId: "admin-1",
      subject,
      reason: "support",
      ttlSeconds: 900,
      allowWrites: false,
      sessionId: "imp_x",
      now: nowMs,
    });
    assert.equal(claims.sub, "u2");
    assert.equal(claims.act, "admin-1");
    assert.equal(claims.imp, true);
    assert.equal(claims.imp_writes_ok, false);
    assert.equal(claims.imp_reason, "support");
    assert.equal(claims.imp_sid, "imp_x");
    assert.equal(claims.imp_exp, Math.floor(nowMs / 1000) + 900);
  });
});

// ── Route integration (in-memory, real JWT) ─────────────────────────────────

function makeDeps(overrides: Partial<ImpersonationDeps> = {}): ImpersonationDeps {
  const store = createInMemoryImpersonationStore();
  const audited: any[] = [];
  const deps: ImpersonationDeps = {
    store,
    resolveSubject: async (id) =>
      id === "learner-1"
        ? {
            userId: "learner-1",
            role: "learner",
            tenantId: "t1",
            districtId: "dist1",
            schoolId: "sch1",
            ageYears: 9,
          }
        : id === "admin-x"
          ? { userId: "admin-x", role: "platform_admin", tenantId: "t1" }
          : null,
    resolveConsent: async (_a, _s, body) => ({
      hasSubjectConsent: !!body.subject_consent,
      hasGuardianConsent: !!body.guardian_consent,
      justificationTicketId: body.justification_ticket_id ?? null,
      platformOverride: !!body.platform_override,
      breakGlassCode: body.break_glass_code ?? null,
      hasOpenIncident: !!body.open_incident,
    }),
    resolveTenantSettings: async () => ({ enabled: true }),
    audit: (e) => audited.push(e),
    ...overrides,
  };
  (deps as any)._audited = audited;
  return deps;
}

async function actorToken(role: string, sub = "admin-1", extra: Record<string, unknown> = {}) {
  return signJWT({ sub, tenantId: "t1", role, ...extra } as unknown as JWTPayload, "15m");
}

describe("POST /impersonation/start (route)", () => {
  it("platform admin impersonates a learner (guardian consent) → signed imp token", async () => {
    const app = Fastify();
    const deps = makeDeps();
    registerImpersonationRoutes(app, deps);
    const token = await actorToken("PLATFORM_ADMIN");

    const res = await app.inject({
      method: "POST",
      url: "/api/impersonation/start",
      headers: { authorization: `Bearer ${token}`, "x-step-up-token": "ok" },
      payload: {
        subject_user_id: "learner-1",
        reason: "help with login",
        ttl_seconds: 600,
        guardian_consent: true,
      },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    const claims = await verifyJWT<JWTPayload>(body.token);
    assert.equal(claims.imp, true);
    assert.equal(claims.sub, "learner-1");
    assert.equal(claims.act, "admin-1");
    assert.equal(claims.imp_writes_ok, false);
    assert.ok((deps as any)._audited.some((e: any) => e.action === "auth.impersonation.start"));
    await app.close();
  });

  it("requires step-up MFA", async () => {
    const app = Fastify();
    registerImpersonationRoutes(app, makeDeps());
    const token = await actorToken("PLATFORM_ADMIN");
    const res = await app.inject({
      method: "POST",
      url: "/api/impersonation/start",
      headers: { authorization: `Bearer ${token}` }, // no step-up header
      payload: { subject_user_id: "learner-1", reason: "x", guardian_consent: true },
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  it("district admin impersonating a platform admin → 403 (ADMIN_TARGET_FORBIDDEN)", async () => {
    const app = Fastify();
    registerImpersonationRoutes(app, makeDeps());
    const token = await actorToken("DISTRICT_ADMIN", "d1", { districtId: "dist1" });
    const res = await app.inject({
      method: "POST",
      url: "/api/impersonation/start",
      headers: { authorization: `Bearer ${token}`, "x-step-up-token": "ok" },
      payload: { subject_user_id: "admin-x", reason: "x", subject_consent: true },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().code, "ADMIN_TARGET_FORBIDDEN");
    await app.close();
  });

  it("no transitive impersonation: an imp token cannot start another", async () => {
    const app = Fastify();
    registerImpersonationRoutes(app, makeDeps());
    // Build an impersonation token directly and try to use it to start.
    const impToken = await signJWT(
      {
        sub: "learner-1",
        tenantId: "t1",
        role: "learner",
        act: "admin-1",
        imp: true,
        imp_exp: Math.floor(Date.now() / 1000) + 600,
        imp_sid: "s1",
      } as unknown as JWTPayload,
      "10m",
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/impersonation/start",
      headers: { authorization: `Bearer ${impToken}`, "x-step-up-token": "ok" },
      payload: { subject_user_id: "learner-1", reason: "x", guardian_consent: true },
    });
    assert.equal(res.statusCode, 403);
    await app.close();
  });

  it("minor without guardian consent is denied", async () => {
    const app = Fastify();
    registerImpersonationRoutes(app, makeDeps());
    const token = await actorToken("PLATFORM_ADMIN");
    const res = await app.inject({
      method: "POST",
      url: "/api/impersonation/start",
      headers: { authorization: `Bearer ${token}`, "x-step-up-token": "ok" },
      payload: { subject_user_id: "learner-1", reason: "x", justification_ticket_id: "T-1" },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().code, "MINOR_NO_GUARDIAN_CONSENT");
    await app.close();
  });
});

describe("security: forged imp_writes_ok is rejected by signature", () => {
  it("tampering a claim invalidates the JWT", async () => {
    const app = Fastify();
    registerImpersonationRoutes(app, makeDeps());
    const token = await actorToken("PLATFORM_ADMIN");
    const res = await app.inject({
      method: "POST",
      url: "/api/impersonation/start",
      headers: { authorization: `Bearer ${token}`, "x-step-up-token": "ok" },
      payload: {
        subject_user_id: "learner-1",
        reason: "x",
        guardian_consent: true,
        allow_writes: false,
      },
    });
    const { token: impToken } = res.json();
    // Forge: flip imp_writes_ok in the payload segment.
    const [h, p, s] = impToken.split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    payload.imp_writes_ok = true;
    const forged = `${h}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${s}`;
    await assert.rejects(() => verifyJWT(forged));
    await app.close();
  });
});

describe("active + stop + history", () => {
  it("tracks the active session and stops it", async () => {
    const app = Fastify();
    const deps = makeDeps();
    registerImpersonationRoutes(app, deps);
    const token = await actorToken("PLATFORM_ADMIN");
    const start = await app.inject({
      method: "POST",
      url: "/api/impersonation/start",
      headers: { authorization: `Bearer ${token}`, "x-step-up-token": "ok" },
      payload: { subject_user_id: "learner-1", reason: "x", guardian_consent: true },
    });
    const sessionId = start.json().session.id;

    const active = await app.inject({
      method: "GET",
      url: "/api/impersonation/active",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(active.json().active.id, sessionId);

    const stop = await app.inject({
      method: "POST",
      url: "/api/impersonation/stop",
      headers: { authorization: `Bearer ${token}` },
      payload: { session_id: sessionId },
    });
    assert.equal(stop.statusCode, 200);

    const afterActive = await app.inject({
      method: "GET",
      url: "/api/impersonation/active",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(afterActive.json().active, null);
    await app.close();
  });
});
