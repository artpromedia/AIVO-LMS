/**
 * Sprint 6: SCIM 2.0 endpoints under /scim/v2/*.
 *
 * Auth: per-tenant bearer token issued from the district SSO settings UI.
 * Tokens are stored as sha256 hashes in `scim_tokens`; we look up by hash
 * and bind the request to the owning tenant.
 *
 * Provisioning is restricted to DISTRICT_ADMIN, TEACHER, CAREGIVER, THERAPIST.
 * Attempts to create or modify PLATFORM_ADMIN are rejected with 403.
 *
 * Implements:
 *   - ServiceProviderConfig, Schemas, ResourceTypes
 *   - Users: GET list (filter eq + and/or, startIndex/count), GET one, POST, PUT, PATCH, DELETE (deactivate)
 *   - Groups: GET list, GET one (virtual groups based on AIVO role)
 *
 * Filter parser supports:
 *   userName eq "x"
 *   emails.value eq "x"
 *   emails eq "x"
 *   active eq true
 *   externalId eq "x"
 *   <expr> and <expr>
 *   <expr> or  <expr>
 */

import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { eq, and, or, sql, isNull } from "drizzle-orm";
import { users, scimTokens, tenants, adminAuditLog, appendAudit } from "@aivo/db";
import {
  getScimV2ServiceProviderConfigSchema,
  getScimV2SchemasSchema,
  getScimV2ResourceTypesSchema,
  getScimV2UsersSchema,
  getScimV2UsersByIdSchema,
  scimV2UsersSchema,
  updateScimV2UsersByIdSchema,
  patchScimV2UsersByIdSchema,
  deleteScimV2UsersByIdSchema,
  getScimV2GroupsSchema,
  getScimV2GroupsByIdSchema,
} from "./schemas.js";

/**
 * Emit a SCIM audit event into the hash-chained admin audit log. Errors
 * are swallowed so a transient audit-write failure cannot break the
 * SCIM contract — the underlying user mutation has already committed.
 */
async function emitScimAudit(
  db: any,
  action: string,
  ctx: ScimContext,
  resourceType: "user" | "group",
  resourceId: string,
  req: any,
  details: Record<string, any> = {},
) {
  try {
    await appendAudit(db, "admin_audit_log", adminAuditLog, {
      action,
      actorId: ctx.tokenId,
      actorEmail: "scim-provisioner",
      actorRole: "SCIM_TOKEN",
      resourceType,
      resourceId,
      details: { ...details, provisioner: "scim" },
      ipAddress:
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null,
      userAgent: (req.headers["user-agent"] as string) || null,
      tenantId: ctx.tenantId,
    });
  } catch {
    // intentionally swallowed — SCIM audit best-effort, see comment above
  }
}

const SCIM_PROVISIONABLE_ROLES = new Set(["DISTRICT_ADMIN", "TEACHER", "CAREGIVER", "THERAPIST"]);

const SCIM_GROUPS = [
  { id: "DISTRICT_ADMIN", displayName: "District Administrators" },
  { id: "TEACHER", displayName: "Teachers" },
  { id: "CAREGIVER", displayName: "Caregivers" },
  { id: "THERAPIST", displayName: "Therapists" },
];

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

interface ScimContext {
  tenantId: string;
  tokenId: string;
}

function scimError(reply: any, status: number, detail: string, scimType?: string) {
  return reply
    .status(status)
    .type("application/scim+json")
    .send({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: String(status),
      scimType,
      detail,
    });
}

function userToScim(u: any): any {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: u.id,
    externalId: u.externalId || undefined,
    userName: u.email,
    name: { formatted: u.name },
    displayName: u.name,
    emails: u.email ? [{ value: u.email, primary: true, type: "work" }] : [],
    active: !u.deactivatedAt,
    meta: {
      resourceType: "User",
      created: u.createdAt,
      lastModified: u.updatedAt,
      location: `/scim/v2/Users/${u.id}`,
    },
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
      department: u.role,
    },
    aivoRole: u.role,
  };
}

/**
 * Lightweight SCIM filter parser. Supports `eq`, `and`, `or`, plus
 * trivial parens. Returns a drizzle WHERE expression bound to `users`
 * already filtered by tenant. Unsupported attributes return `undefined`
 * so the list route falls back to "no extra filter".
 */
function parseFilter(filter: string | undefined, tenantId: string): any {
  if (!filter) return eq(users.tenantId, tenantId);
  // Tokenize on whitespace outside of quotes.
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of filter) {
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
      continue;
    }
    if (!inQuote && (ch === " " || ch === "\t")) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  function consumeExpr(start: number): { expr: any; next: number } {
    if (start + 2 >= tokens.length) return { expr: undefined, next: tokens.length };
    const attr = tokens[start];
    const op = tokens[start + 1].toLowerCase();
    const rawValue = tokens[start + 2];
    if (op !== "eq") return { expr: undefined, next: start + 3 };
    const value = rawValue.replace(/^"|"$/g, "");
    let cond: any;
    switch (attr) {
      case "userName":
      case "emails":
      case "emails.value":
        cond = eq(users.email, value.toLowerCase());
        break;
      case "active":
        cond =
          value === "true" ? isNull(users.deactivatedAt) : sql`${users.deactivatedAt} IS NOT NULL`;
        break;
      case "externalId":
        cond = eq(users.externalId, value);
        break;
      case "id":
        cond = eq(users.id, value);
        break;
      default:
        cond = undefined;
    }
    return { expr: cond, next: start + 3 };
  }

  let { expr: lhs, next: i } = consumeExpr(0);
  while (i < tokens.length && lhs !== undefined) {
    const conj = tokens[i].toLowerCase();
    const { expr: rhs, next } = consumeExpr(i + 1);
    if (rhs === undefined) break;
    if (conj === "and") lhs = and(lhs, rhs);
    else if (conj === "or") lhs = or(lhs, rhs);
    else break;
    i = next;
  }
  if (!lhs) return eq(users.tenantId, tenantId);
  return and(eq(users.tenantId, tenantId), lhs);
}

export async function registerScimRoutes(app: FastifyInstance) {
  // SCIM clients send `application/scim+json`; Fastify's default JSON
  // parser only fires on `application/json`, so without this our request
  // bodies arrive as `undefined` and every PATCH/POST silently
  // misbehaves. Register a parser that just delegates to JSON.parse.
  if (!app.hasContentTypeParser("application/scim+json")) {
    app.addContentTypeParser("application/scim+json", { parseAs: "string" }, (_req, body, done) => {
      try {
        done(null, body ? JSON.parse(body as string) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    });
  }
  const db = (app as any).db;

  // Bearer auth: load token row by hash and bind tenantId on req.
  app.addHook("onRequest", async (req: any, reply: any) => {
    const url = req.raw.url || "";
    if (!url.startsWith("/scim/v2/")) return;
    // ServiceProviderConfig + Schemas + ResourceTypes are public per RFC 7644 §4
    if (
      url.startsWith("/scim/v2/ServiceProviderConfig") ||
      url.startsWith("/scim/v2/Schemas") ||
      url.startsWith("/scim/v2/ResourceTypes")
    )
      return;

    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return scimError(reply, 401, "Missing bearer token");
    }
    const tokenHash = hashToken(auth.slice(7));
    const [row] = await db
      .select()
      .from(scimTokens)
      .where(eq(scimTokens.tokenHash, tokenHash))
      .limit(1);
    if (!row || row.revokedAt) {
      return scimError(reply, 401, "Invalid or revoked token");
    }
    // Touch lastUsedAt out of band; never block the request on this.
    db.update(scimTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(scimTokens.id, row.id))
      .catch(() => {});
    req.scim = { tenantId: row.tenantId, tokenId: row.id } as ScimContext;
  });

  app.get(
    "/scim/v2/ServiceProviderConfig",
    { schema: getScimV2ServiceProviderConfigSchema },
    async () => ({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      documentationUri: "https://docs.aivolearning.com/integrations/scim",
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "OAuth Bearer Token",
          description: "Authentication scheme using the OAuth Bearer Token Standard",
          primary: true,
        },
      ],
    }),
  );

  app.get("/scim/v2/Schemas", { schema: getScimV2SchemasSchema }, async () => ({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 2,
    Resources: [
      { id: "urn:ietf:params:scim:schemas:core:2.0:User", name: "User" },
      { id: "urn:ietf:params:scim:schemas:core:2.0:Group", name: "Group" },
    ],
  }));

  app.get("/scim/v2/ResourceTypes", { schema: getScimV2ResourceTypesSchema }, async () => ({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 2,
    Resources: [
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
        id: "User",
        name: "User",
        endpoint: "/Users",
        description: "AIVO district user",
        schema: "urn:ietf:params:scim:schemas:core:2.0:User",
      },
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
        id: "Group",
        name: "Group",
        endpoint: "/Groups",
        description: "AIVO role group",
        schema: "urn:ietf:params:scim:schemas:core:2.0:Group",
      },
    ],
  }));

  // Users — list
  app.get("/scim/v2/Users", { schema: getScimV2UsersSchema }, async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const { filter, startIndex = "1", count = "100" } = req.query as any;
    const where = parseFilter(filter, tenantId);
    const start = Math.max(1, parseInt(String(startIndex), 10));
    const lim = Math.min(200, Math.max(1, parseInt(String(count), 10)));
    const rows = await db
      .select()
      .from(users)
      .where(where)
      .limit(lim)
      .offset(start - 1);
    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(users)
      .where(where);
    reply.type("application/scim+json").send({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: Number(total),
      startIndex: start,
      itemsPerPage: rows.length,
      Resources: rows.map(userToScim),
    });
  });

  app.get("/scim/v2/Users/:id", { schema: getScimV2UsersByIdSchema }, async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const { id } = req.params as { id: string };
    const [u] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);
    if (!u) return scimError(reply, 404, "User not found");
    reply.type("application/scim+json").send(userToScim(u));
  });

  app.post("/scim/v2/Users", { schema: scimV2UsersSchema }, async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const body = req.body as any;
    const email: string = (body.userName || body.emails?.[0]?.value || "").toLowerCase().trim();
    if (!email)
      return scimError(reply, 400, "userName or emails[0].value required", "invalidValue");
    const name: string =
      body.displayName ||
      body.name?.formatted ||
      [body.name?.givenName, body.name?.familyName].filter(Boolean).join(" ") ||
      email.split("@")[0];
    const role: string =
      body.aivoRole ||
      body["urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"]?.department ||
      "TEACHER";
    if (!SCIM_PROVISIONABLE_ROLES.has(role)) {
      return scimError(reply, 403, `Role ${role} cannot be provisioned via SCIM`, "noTarget");
    }
    const externalId: string | undefined = body.externalId;

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
      .limit(1);
    if (existing) {
      return scimError(reply, 409, "User already exists", "uniqueness");
    }

    const [created] = await db
      .insert(users)
      .values({
        tenantId,
        email,
        name,
        role,
        emailVerified: true,
        provisionedBy: "scim",
        externalId,
      } as any)
      .returning();
    await emitScimAudit(db, "SCIM_USER_CREATED", req.scim as ScimContext, "user", created.id, req, {
      email,
      role,
      externalId,
    });
    reply.status(201).type("application/scim+json").send(userToScim(created));
  });

  app.put(
    "/scim/v2/Users/:id",
    { schema: updateScimV2UsersByIdSchema },
    async (req: any, reply) => {
      const { tenantId } = req.scim as ScimContext;
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const [u] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
        .limit(1);
      if (!u) return scimError(reply, 404, "User not found");
      if (u.role === "PLATFORM_ADMIN") {
        return scimError(reply, 403, "PLATFORM_ADMIN cannot be modified via SCIM", "noTarget");
      }

      const patch: any = {};
      if (typeof body.userName === "string") patch.email = body.userName.toLowerCase();
      if (typeof body.displayName === "string") patch.name = body.displayName;
      if (body.name?.formatted) patch.name = body.name.formatted;
      if (typeof body.active === "boolean") {
        patch.deactivatedAt = body.active ? null : new Date();
      }
      if (typeof body.aivoRole === "string") {
        // Reject role escalation explicitly. PLATFORM_ADMIN must never be
        // assignable through any SCIM verb.
        if (body.aivoRole === "PLATFORM_ADMIN") {
          return scimError(reply, 403, "PLATFORM_ADMIN cannot be assigned via SCIM", "noTarget");
        }
        if (!SCIM_PROVISIONABLE_ROLES.has(body.aivoRole)) {
          return scimError(
            reply,
            400,
            `Role ${body.aivoRole} is not provisionable via SCIM`,
            "invalidValue",
          );
        }
        patch.role = body.aivoRole;
      }
      patch.updatedAt = new Date();

      const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
      await emitScimAudit(db, "SCIM_USER_REPLACED", req.scim as ScimContext, "user", id, req, {
        changes: Object.keys(patch),
      });
      reply.type("application/scim+json").send(userToScim(updated));
    },
  );

  app.patch(
    "/scim/v2/Users/:id",
    { schema: patchScimV2UsersByIdSchema },
    async (req: any, reply) => {
      const { tenantId } = req.scim as ScimContext;
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const [u] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
        .limit(1);
      if (!u) return scimError(reply, 404, "User not found");
      if (u.role === "PLATFORM_ADMIN") {
        return scimError(reply, 403, "PLATFORM_ADMIN cannot be modified via SCIM", "noTarget");
      }
      const ops: any[] = body.Operations || [];
      const patch: any = { updatedAt: new Date() };
      for (const op of ops) {
        const verb = String(op.op || "").toLowerCase();
        const path = op.path as string | undefined;
        const v = op.value;
        if ((verb === "replace" || verb === "add") && (!path || path === "active")) {
          if (typeof v === "boolean") patch.deactivatedAt = v ? null : new Date();
          else if (v && typeof v.active === "boolean")
            patch.deactivatedAt = v.active ? null : new Date();
        }
        if (
          (verb === "replace" || verb === "add") &&
          path === "displayName" &&
          typeof v === "string"
        ) {
          patch.name = v;
        }
        if (
          (verb === "replace" || verb === "add") &&
          path === "userName" &&
          typeof v === "string"
        ) {
          patch.email = v.toLowerCase();
        }
        if ((verb === "replace" || verb === "add") && path?.startsWith("emails")) {
          const email = typeof v === "string" ? v : Array.isArray(v) ? v[0]?.value : v?.value;
          if (typeof email === "string") patch.email = email.toLowerCase();
        }
        // Block role-escalation attempts through PATCH. Both `aivoRole` and
        // the enterprise `department` extension can carry the role value.
        if (
          (verb === "replace" || verb === "add") &&
          (path === "aivoRole" ||
            path === "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department")
        ) {
          const newRole = typeof v === "string" ? v : v?.value;
          if (newRole === "PLATFORM_ADMIN") {
            return scimError(reply, 403, "PLATFORM_ADMIN cannot be assigned via SCIM", "noTarget");
          }
          if (typeof newRole === "string" && !SCIM_PROVISIONABLE_ROLES.has(newRole)) {
            return scimError(
              reply,
              400,
              `Role ${newRole} is not provisionable via SCIM`,
              "invalidValue",
            );
          }
          if (typeof newRole === "string") patch.role = newRole;
        }
      }
      const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
      await emitScimAudit(db, "SCIM_USER_PATCHED", req.scim as ScimContext, "user", id, req, {
        operations: ops.map((o) => ({ op: o.op, path: o.path })),
      });
      reply.type("application/scim+json").send(userToScim(updated));
    },
  );

  app.delete(
    "/scim/v2/Users/:id",
    { schema: deleteScimV2UsersByIdSchema },
    async (req: any, reply) => {
      const { tenantId } = req.scim as ScimContext;
      const { id } = req.params as { id: string };
      const [u] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
        .limit(1);
      if (!u) return scimError(reply, 404, "User not found");
      if (u.role === "PLATFORM_ADMIN") {
        return scimError(reply, 403, "PLATFORM_ADMIN cannot be deleted via SCIM", "noTarget");
      }
      // Per RFC 7644 §3.6 we soft-delete by setting active=false.
      await db
        .update(users)
        .set({
          deactivatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
      await emitScimAudit(db, "SCIM_USER_DEACTIVATED", req.scim as ScimContext, "user", id, req, {
        email: u.email,
      });
      reply.status(204).send();
    },
  );

  // Groups — virtual, derived from AIVO roles. We only support read.
  app.get("/scim/v2/Groups", { schema: getScimV2GroupsSchema }, async (_req: any, reply) => {
    reply.type("application/scim+json").send({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: SCIM_GROUPS.length,
      Resources: SCIM_GROUPS.map((g) => ({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        id: g.id,
        displayName: g.displayName,
        meta: { resourceType: "Group", location: `/scim/v2/Groups/${g.id}` },
      })),
    });
  });

  // Groups are virtual (derived from AIVO role) per RFC 7644 §3.7 / 3.5.2:
  // groups' membership mutations come from changing a user's role. The
  // endpoints below are present for SCIM-conformant clients (Okta, Azure
  // AD, JumpCloud) that POST/PUT/PATCH Groups during initial sync — we
  // refuse the mutation with `mutability` so the client surfaces the
  // limitation cleanly instead of silently 404-ing.
  const rejectGroupMutation = (reply: any) =>
    scimError(
      reply,
      400,
      "Groups are derived from AIVO roles and cannot be mutated via SCIM. Update a user's `aivoRole` instead.",
      "mutability",
    );

  app.post("/scim/v2/Groups", async (_req: any, reply) => rejectGroupMutation(reply));
  app.put("/scim/v2/Groups/:id", async (_req: any, reply) => rejectGroupMutation(reply));
  app.patch("/scim/v2/Groups/:id", async (_req: any, reply) => rejectGroupMutation(reply));
  app.delete("/scim/v2/Groups/:id", async (_req: any, reply) => rejectGroupMutation(reply));

  app.get("/scim/v2/Groups/:id", { schema: getScimV2GroupsByIdSchema }, async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const { id } = req.params as { id: string };
    const g = SCIM_GROUPS.find((x) => x.id === id);
    if (!g) return scimError(reply, 404, "Group not found");
    const members = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(
        and(eq(users.tenantId, tenantId), eq(users.role, id as any), isNull(users.deactivatedAt)),
      );
    reply.type("application/scim+json").send({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id: g.id,
      displayName: g.displayName,
      members: members.map((m: any) => ({
        value: m.id,
        display: m.name || m.email,
        $ref: `/scim/v2/Users/${m.id}`,
      })),
      meta: { resourceType: "Group", location: `/scim/v2/Groups/${g.id}` },
    });
  });
}
