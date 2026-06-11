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
import {
  users,
  scimTokens,
  tenants,
  adminAuditLog,
  appendAudit,
  classrooms,
  schools,
} from "@aivo/db";
import {
  applyUserUpsert,
  applyUserDeactivate,
  applyClassGroupMapping,
  applyClassGroupMembers,
  removeClassGroupMember,
  recordUnmappedGroup,
  parseClassGroupName,
} from "../services/roster-core.js";
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
      onBehalfOfId: null,
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

    // SCIM semantics: POST of an existing userName is a uniqueness
    // conflict (Okta/Entra then switch to PUT/PATCH against the id).
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
      .limit(1);
    if (existing) {
      return scimError(reply, 409, "User already exists", "uniqueness");
    }

    // Apply through the shared roster core (Sprint B5) — the same write
    // path the SIS pipeline uses, so provisioning semantics can't drift.
    const result = await applyUserUpsert(db, {
      tenantId,
      email,
      name,
      role,
      externalId,
      provisionedBy: "scim",
    });
    if (!result.ok) {
      return scimError(
        reply,
        result.error.status,
        result.error.message,
        result.error.code,
      );
    }
    await emitScimAudit(
      db,
      "SCIM_USER_CREATED",
      req.scim as ScimContext,
      "user",
      result.user.id,
      req,
      { email, role, externalId },
    );
    reply.status(201).type("application/scim+json").send(userToScim(result.user));
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
      // Entra sends booleans as the strings "True"/"False" in PatchOps;
      // Okta sends real booleans (and omits `path`, nesting under value).
      const coerceBool = (value: unknown): boolean | undefined => {
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
          const lowered = value.toLowerCase();
          if (lowered === "true") return true;
          if (lowered === "false") return false;
        }
        return undefined;
      };
      for (const op of ops) {
        const verb = String(op.op || "").toLowerCase();
        const path = op.path as string | undefined;
        const v = op.value;
        if ((verb === "replace" || verb === "add") && (!path || path === "active")) {
          const direct = coerceBool(v);
          const nested = v && typeof v === "object" ? coerceBool((v as any).active) : undefined;
          const active = direct ?? nested;
          if (active !== undefined) patch.deactivatedAt = active ? null : new Date();
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
      // Per RFC 7644 §3.6 we soft-delete (deactivate) — through the shared
      // roster core, which also owns the PLATFORM_ADMIN refusal.
      const result = await applyUserDeactivate(db, { tenantId, userId: id });
      if (!result.ok) {
        return scimError(reply, result.error.status, result.error.message, result.error.code);
      }
      await emitScimAudit(db, "SCIM_USER_DEACTIVATED", req.scim as ScimContext, "user", id, req, {
        email: result.user.email,
      });
      reply.status(204).send();
    },
  );

  // ── Groups ───────────────────────────────────────────────────────────
  // Two kinds (Sprint B5):
  //   1. ROLE groups (virtual, ids = role names): read-only mirrors of
  //      AIVO roles. Mutations are refused with `mutability` — change a
  //      user's `aivoRole` instead.
  //   2. CLASS groups (ids = classroom uuids): an IdP push group whose
  //      displayName follows the documented convention
  //      `Class: <School Name> / <Class Name>` maps to a classroom;
  //      teacher members become the class's staff. Pushes that don't
  //      match the convention (or name an unknown school) are RECORDED
  //      in scim_unmapped_groups — surfaced on the district SIS page,
  //      skipped, never silently dropped.

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function classGroupToScim(classroom: any, school: any, members: any[]): any {
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id: classroom.id,
      displayName: `Class: ${school.name} / ${classroom.name}`,
      members: members.map((m: any) => ({
        value: m.id,
        display: m.name || m.email,
        $ref: `/scim/v2/Users/${m.id}`,
      })),
      meta: { resourceType: "Group", location: `/scim/v2/Groups/${classroom.id}` },
    };
  }

  /** Active staff shown as a class group's members (teacher of record first). */
  async function classGroupMembers(tenantId: string, classroom: any): Promise<any[]> {
    if (!classroom.teacherId) return [];
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(
        and(
          eq(users.id, classroom.teacherId),
          eq(users.tenantId, tenantId),
          isNull(users.deactivatedAt),
        ),
      );
    return rows;
  }

  async function loadTenantClassroom(tenantId: string, id: string): Promise<{ classroom: any; school: any } | null> {
    if (!UUID_RE.test(id)) return null;
    const [row] = await db
      .select({ classroom: classrooms, school: schools })
      .from(classrooms)
      .innerJoin(schools, eq(classrooms.schoolId, schools.id))
      .where(and(eq(classrooms.id, id), eq(schools.tenantId, tenantId)))
      .limit(1);
    return row ?? null;
  }

  app.get("/scim/v2/Groups", { schema: getScimV2GroupsSchema }, async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const classRows = await db
      .select({ classroom: classrooms, school: schools })
      .from(classrooms)
      .innerJoin(schools, eq(classrooms.schoolId, schools.id))
      .where(eq(schools.tenantId, tenantId))
      .limit(200);
    const roleGroups = SCIM_GROUPS.map((g) => ({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id: g.id,
      displayName: g.displayName,
      meta: { resourceType: "Group", location: `/scim/v2/Groups/${g.id}` },
    }));
    const classGroups = classRows.map((row: any) => ({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id: row.classroom.id,
      displayName: `Class: ${row.school.name} / ${row.classroom.name}`,
      meta: { resourceType: "Group", location: `/scim/v2/Groups/${row.classroom.id}` },
    }));
    reply.type("application/scim+json").send({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: roleGroups.length + classGroups.length,
      Resources: [...roleGroups, ...classGroups],
    });
  });

  const ROLE_GROUP_REFUSAL =
    "Role groups are derived from AIVO roles and cannot be mutated via SCIM. Update a user's `aivoRole` instead. To provision a class, push a group named `Class: <School Name> / <Class Name>`.";

  app.post("/scim/v2/Groups", async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const body = (req.body ?? {}) as any;
    const displayName = String(body.displayName ?? "").trim();
    const memberIds: string[] = Array.isArray(body.members)
      ? body.members.map((m: any) => String(m?.value ?? "")).filter(Boolean)
      : [];
    if (!displayName) {
      return scimError(reply, 400, "displayName is required", "invalidValue");
    }

    const mapping = await applyClassGroupMapping(db, tenantId, displayName);
    if (!mapping.ok) {
      // Recorded for district review — explicitly NOT silently dropped.
      await recordUnmappedGroup(db, tenantId, displayName, mapping.reason, {
        externalId: body.externalId ?? null,
        memberCount: memberIds.length,
      });
      await emitScimAudit(db, "SCIM_GROUP_UNMAPPED", req.scim as ScimContext, "group", displayName, req, {
        reason: mapping.reason,
      });
      const detail =
        mapping.reason === "unknown_school"
          ? `No school named "${parseClassGroupName(displayName)?.schoolName}" exists in this district. The push was recorded for review on the AIVO SIS page.`
          : `Group name does not match the class convention \`Class: <School Name> / <Class Name>\`. The push was recorded for review on the AIVO SIS page. ${ROLE_GROUP_REFUSAL}`;
      return scimError(reply, 400, detail, "invalidValue");
    }

    const { applied, unknown } = await applyClassGroupMembers(
      db,
      tenantId,
      mapping.classroom,
      mapping.school.id,
      memberIds,
    );
    await emitScimAudit(
      db,
      "SCIM_GROUP_MAPPED",
      req.scim as ScimContext,
      "group",
      mapping.classroom.id,
      req,
      { displayName, created: mapping.created, members: applied.length, unknownMembers: unknown.length },
    );
    const fresh = await loadTenantClassroom(tenantId, mapping.classroom.id);
    const members = fresh ? await classGroupMembers(tenantId, fresh.classroom) : [];
    reply
      .status(201)
      .type("application/scim+json")
      .send(classGroupToScim(fresh?.classroom ?? mapping.classroom, mapping.school, members));
  });

  app.get("/scim/v2/Groups/:id", { schema: getScimV2GroupsByIdSchema }, async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const { id } = req.params as { id: string };
    const roleGroup = SCIM_GROUPS.find((x) => x.id === id);
    if (roleGroup) {
      const members = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(
          and(eq(users.tenantId, tenantId), eq(users.role, id as any), isNull(users.deactivatedAt)),
        );
      return reply.type("application/scim+json").send({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        id: roleGroup.id,
        displayName: roleGroup.displayName,
        members: members.map((m: any) => ({
          value: m.id,
          display: m.name || m.email,
          $ref: `/scim/v2/Users/${m.id}`,
        })),
        meta: { resourceType: "Group", location: `/scim/v2/Groups/${roleGroup.id}` },
      });
    }
    const found = await loadTenantClassroom(tenantId, id);
    if (!found) return scimError(reply, 404, "Group not found");
    const members = await classGroupMembers(tenantId, found.classroom);
    reply.type("application/scim+json").send(classGroupToScim(found.classroom, found.school, members));
  });

  app.patch("/scim/v2/Groups/:id", async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const { id } = req.params as { id: string };
    if (SCIM_GROUPS.some((g) => g.id === id)) {
      return scimError(reply, 400, ROLE_GROUP_REFUSAL, "mutability");
    }
    const found = await loadTenantClassroom(tenantId, id);
    if (!found) return scimError(reply, 404, "Group not found");

    const ops: any[] = (req.body as any)?.Operations || [];
    if (!Array.isArray(ops) || ops.length === 0) {
      return scimError(reply, 400, "Operations array is required", "invalidValue");
    }
    let applied = 0;
    let removed = 0;
    for (const op of ops) {
      const verb = String(op.op || "").toLowerCase();
      const path = String(op.path || "");
      if (verb === "add" && (path === "members" || !path)) {
        const ids = (Array.isArray(op.value) ? op.value : [op.value])
          .map((v: any) => String(v?.value ?? v ?? ""))
          .filter(Boolean);
        const res = await applyClassGroupMembers(db, tenantId, found.classroom, found.school.id, ids);
        applied += res.applied.length;
      } else if (verb === "remove" && path.startsWith("members")) {
        // Entra style: path = 'members[value eq "<id>"]'; Okta also sends
        // op.value arrays. Support both.
        const m = /members\[value eq "([^"]+)"\]/.exec(path);
        const ids = m
          ? [m[1]]
          : (Array.isArray(op.value) ? op.value : [op.value])
              .map((v: any) => String(v?.value ?? v ?? ""))
              .filter(Boolean);
        for (const userId of ids) {
          await removeClassGroupMember(db, tenantId, found.classroom, found.school.id, userId);
          removed += 1;
        }
      } else if (verb === "replace" && (path === "displayName" || !path)) {
        const next = typeof op.value === "string" ? op.value : op.value?.displayName;
        if (typeof next === "string" && next.trim()) {
          const parsed = parseClassGroupName(next);
          if (!parsed) {
            return scimError(
              reply,
              400,
              "displayName must keep the `Class: <School Name> / <Class Name>` convention",
              "invalidValue",
            );
          }
          await db
            .update(classrooms)
            .set({ name: parsed.className })
            .where(eq(classrooms.id, found.classroom.id));
        }
      } else {
        return scimError(reply, 400, `Unsupported PatchOp: ${verb} ${path}`, "invalidPath");
      }
    }
    await emitScimAudit(db, "SCIM_GROUP_PATCHED", req.scim as ScimContext, "group", id, req, {
      added: applied,
      removed,
    });
    const fresh = await loadTenantClassroom(tenantId, id);
    const members = fresh ? await classGroupMembers(tenantId, fresh.classroom) : [];
    reply
      .type("application/scim+json")
      .send(classGroupToScim(fresh?.classroom ?? found.classroom, found.school, members));
  });

  app.put("/scim/v2/Groups/:id", async (req: any, reply) => {
    const { tenantId } = req.scim as ScimContext;
    const { id } = req.params as { id: string };
    if (SCIM_GROUPS.some((g) => g.id === id)) {
      return scimError(reply, 400, ROLE_GROUP_REFUSAL, "mutability");
    }
    const found = await loadTenantClassroom(tenantId, id);
    if (!found) return scimError(reply, 404, "Group not found");
    const body = (req.body ?? {}) as any;
    const memberIds: string[] = Array.isArray(body.members)
      ? body.members.map((m: any) => String(m?.value ?? "")).filter(Boolean)
      : [];
    // Full replace: clear teacher-of-record, then re-apply the pushed set.
    await db.update(classrooms).set({ teacherId: null }).where(eq(classrooms.id, found.classroom.id));
    const { applied } = await applyClassGroupMembers(
      db,
      tenantId,
      { ...found.classroom, teacherId: null },
      found.school.id,
      memberIds,
    );
    await emitScimAudit(db, "SCIM_GROUP_REPLACED", req.scim as ScimContext, "group", id, req, {
      members: applied.length,
    });
    const fresh = await loadTenantClassroom(tenantId, id);
    const members = fresh ? await classGroupMembers(tenantId, fresh.classroom) : [];
    reply
      .type("application/scim+json")
      .send(classGroupToScim(fresh?.classroom ?? found.classroom, found.school, members));
  });

  app.delete("/scim/v2/Groups/:id", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    if (SCIM_GROUPS.some((g) => g.id === id)) {
      return scimError(reply, 400, ROLE_GROUP_REFUSAL, "mutability");
    }
    // Classes hold enrollment history — deleting them from an IdP group
    // push would destroy district data. Refuse with a clear next step.
    return scimError(
      reply,
      400,
      "Classes are not deleted via SCIM group push (enrollment history would be lost). Archive the class from the AIVO admin console instead.",
      "mutability",
    );
  });
}
