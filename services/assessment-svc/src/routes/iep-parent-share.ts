/**
 * Phase D — Secure parent share links for finalised IEPs (sprint task #13).
 *
 * Endpoints:
 *   POST   /api/iep/drafts/:id/share-links            (issue)
 *   GET    /api/iep/drafts/:id/share-links            (list — issuer view)
 *   POST   /api/iep/drafts/:id/share-links/:linkId/revoke
 *   GET    /api/iep/share/:token                      (public — redeem)
 *
 * Issuance is restricted to (a) the learner's parent or (b) the case
 * manager on the team, AND only against finalised IEPs. The plaintext
 * token is shown to the issuer once and never persisted — only a sha-256
 * hash lands in the DB. Redemption returns a parent-summary shape (no
 * internal annotations, no draft-only narratives), bumps the access
 * counter, and refuses revoked or expired tokens.
 */
import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import {
  iepProfiles,
  iepPresentLevels,
  iepServices,
  iepGoals,
  iepTeamMembers,
  iepParentShareLinks,
  learners,
  users,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import crypto from "crypto";

interface AuthClaims {
  sub: string;
  tenantId: string;
  role: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const DEFAULT_TTL_DAYS = 14;
const MAX_TTL_DAYS = 90;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  // 32 bytes of url-safe randomness ≈ 256 bits. Plenty of entropy and
  // small enough that the URL stays copy-pasteable.
  return crypto.randomBytes(32).toString("base64url");
}

async function authenticate(req: any, reply: any): Promise<AuthClaims | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Authentication required" });
    return null;
  }
  try {
    return (await verifyJWT(auth.slice(7))) as AuthClaims;
  } catch {
    reply.code(401).send({ error: "Invalid token" });
    return null;
  }
}

async function loadProfile(db: any, id: string) {
  if (!isUuid(id)) return null;
  const [p] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
  return p || null;
}

// Permission: only the learner's parent OR the on-team case manager may
// issue / list / revoke share links. Platform admin bypasses for support
// scenarios. Other team roles do NOT — sharing is the family's call.
async function canIssueShareLink(db: any, claims: AuthClaims, profile: any): Promise<boolean> {
  if (claims.role === "PLATFORM_ADMIN") return true;
  const [learner] = await db.select().from(learners).where(eq(learners.id, profile.learnerId));
  if (!learner) return false;
  if (learner.parentId === claims.sub) return true;
  const cmRows = await db.select({ id: iepTeamMembers.id }).from(iepTeamMembers)
    .where(and(
      eq(iepTeamMembers.iepProfileId, profile.id),
      eq(iepTeamMembers.userId, claims.sub),
      eq(iepTeamMembers.role, "case_manager"),
    ));
  return cmRows.length > 0;
}

// Parent-summary projection of a finalised IEP. Strips draft-only fields
// and the audit-trail metadata that doesn't belong on a sharable view.
async function buildPublicSnapshot(db: any, profile: any) {
  const [learner] = await db.select({
    id: learners.id, name: learners.name, gradeLevel: learners.gradeLevel,
  }).from(learners).where(eq(learners.id, profile.learnerId));
  const [plops, services, goals] = await Promise.all([
    db.select({
      area: iepPresentLevels.area, narrative: iepPresentLevels.narrative,
    }).from(iepPresentLevels)
      .where(eq(iepPresentLevels.iepProfileId, profile.id)),
    db.select({
      serviceType: iepServices.serviceType,
      providerRole: iepServices.providerRole,
      minutesPerWeek: iepServices.minutesPerWeek,
      frequency: iepServices.frequency,
      location: iepServices.location,
    }).from(iepServices)
      .where(eq(iepServices.iepProfileId, profile.id)),
    db.select({
      goalText: iepGoals.goalText, domain: iepGoals.domain,
      targetCriteria: iepGoals.targetCriteria,
    }).from(iepGoals)
      .where(eq(iepGoals.iepProfileId, profile.id)),
  ]);
  return {
    learner,
    iep: {
      lifecycleState: profile.lifecycleState,
      gradeLevel: profile.gradeLevel,
      placement: profile.placement,
      reviewDate: profile.reviewDate,
      disabilityCategories: profile.disabilityCategories || [],
      accommodations: profile.accommodations || [],
      assistiveTechnology: profile.assistiveTechnology || [],
      communicationSystem: profile.communicationSystem,
    },
    presentLevels: plops,
    services,
    goals,
  };
}

export async function registerIepParentShareRoutes(app: FastifyInstance) {
  // Issue a new share link. Only callable on finalised IEPs.
  app.post("/api/iep/drafts/:id/share-links", {
    schema: {
      tags: ["IEP Phase D"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        properties: {
          label: { type: "string", maxLength: 120 },
          ttlDays: { type: "integer", minimum: 1, maximum: MAX_TTL_DAYS },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") {
      return reply.code(404).send({ error: "Not an authored IEP" });
    }
    if (profile.lifecycleState !== "finalised") {
      return reply.code(409).send({
        error: "Share links may only be issued on finalised IEPs",
      });
    }
    if (!await canIssueShareLink(db, claims, profile)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const body = (req.body as any) || {};
    const ttlDays = Math.min(MAX_TTL_DAYS, Math.max(1, Number(body.ttlDays) || DEFAULT_TTL_DAYS));
    const token = newToken();
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const [row] = await db.insert(iepParentShareLinks).values({
      iepProfileId: profile.id,
      tokenHash: hashToken(token),
      label: body.label ? String(body.label).slice(0, 120) : null,
      issuedByUserId: claims.sub,
      expiresAt,
    }).returning();
    // The plaintext token is returned exactly once. The hash is what
    // lands in the DB — leaking the table doesn't leak the URL.
    return reply.code(201).send({
      id: row.id,
      token,
      label: row.label,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    });
  });

  // List the share links the issuer can manage. Plaintext tokens are
  // never returned again — issuers see metadata + access counters only.
  app.get("/api/iep/drafts/:id/share-links", {
    schema: { tags: ["IEP Phase D"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (!await canIssueShareLink(db, claims, profile)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const rows = await db.select({
      id: iepParentShareLinks.id,
      label: iepParentShareLinks.label,
      issuedByUserId: iepParentShareLinks.issuedByUserId,
      expiresAt: iepParentShareLinks.expiresAt,
      revokedAt: iepParentShareLinks.revokedAt,
      lastAccessedAt: iepParentShareLinks.lastAccessedAt,
      accessCount: iepParentShareLinks.accessCount,
      createdAt: iepParentShareLinks.createdAt,
    }).from(iepParentShareLinks)
      .where(eq(iepParentShareLinks.iepProfileId, id))
      .orderBy(desc(iepParentShareLinks.createdAt));
    return rows;
  });

  // Revoke. Setting revokedAt is enough — redemption checks IS NULL.
  app.post("/api/iep/drafts/:id/share-links/:linkId/revoke", {
    schema: { tags: ["IEP Phase D"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id, linkId } = req.params as { id: string; linkId: string };
    if (!isUuid(id) || !isUuid(linkId)) return reply.code(400).send({ error: "Invalid id" });
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (!await canIssueShareLink(db, claims, profile)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const [updated] = await db.update(iepParentShareLinks)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(iepParentShareLinks.id, linkId),
        eq(iepParentShareLinks.iepProfileId, id),
      ))
      .returning();
    if (!updated) return reply.code(404).send({ error: "Link not found" });
    return updated;
  });

  // Public redemption. NO auth. The token itself is the credential, so
  // the handler is paranoid about leaking timing or content under a bad
  // token: revoked / expired / unknown all return the same 404 so an
  // attacker can't enumerate.
  app.get("/api/iep/share/:token", {
    schema: { tags: ["IEP Phase D"] },
  }, async (req, reply) => {
    const db = (app as any).db;
    const { token } = req.params as { token: string };
    if (typeof token !== "string" || token.length < 10) {
      return reply.code(404).send({ error: "Not found" });
    }
    const tokenHash = hashToken(token);
    const [row] = await db.select().from(iepParentShareLinks)
      .where(eq(iepParentShareLinks.tokenHash, tokenHash));
    if (!row) return reply.code(404).send({ error: "Not found" });
    if (row.revokedAt) return reply.code(404).send({ error: "Not found" });
    if (row.expiresAt < new Date()) return reply.code(404).send({ error: "Not found" });
    const profile = await loadProfile(db, row.iepProfileId);
    // Defensive: a finalised IEP that was un-finalised after the link
    // was issued must not still be readable through that token.
    if (!profile || profile.lifecycleState !== "finalised") {
      return reply.code(404).send({ error: "Not found" });
    }
    // Bump access counter best-effort. Failure here doesn't block the
    // read — the recipient came to read the IEP, not to update audit
    // counters.
    void (async () => {
      try {
        await db.update(iepParentShareLinks)
          .set({
            lastAccessedAt: new Date(),
            accessCount: (row.accessCount as number) + 1,
          })
          .where(eq(iepParentShareLinks.id, row.id));
      } catch { /* swallow */ }
    })();
    const snapshot = await buildPublicSnapshot(db, profile);
    return {
      ...snapshot,
      shareLink: {
        label: row.label,
        expiresAt: row.expiresAt,
      },
    };
  });
}
