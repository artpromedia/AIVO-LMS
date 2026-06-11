/**
 * Internal roster endpoints (Sprint B5) — the identity-svc half of the
 * SIS pipeline's RosterWriter contract. integration-svc's HttpRosterWriter
 * has POSTed canonical user upserts/deactivates to these paths since the
 * roster-sync sprint, but the endpoints were never implemented — every
 * CSV/SIS apply run dead-ended with a 404. They now exist, applying
 * through the SAME roster core the SCIM routes use, so both producers
 * converge on one set of provisioning semantics.
 *
 * Auth: service-to-service only — the static INTERNAL_SERVICE_TOKEN as
 * the bearer. Students are refused explicitly (learners are rostered via
 * enrollments, not user accounts).
 */
import { FastifyInstance } from "fastify";
import {
  applyUserUpsert,
  applyUserDeactivate,
  ONEROSTER_ROLE_MAP,
} from "../services/roster-core.js";
import {
  internalRosterUsersUpsertSchema,
  internalRosterUsersDeactivateSchema,
} from "./schemas.js";

interface CanonicalUserRecord {
  sourcedId: string;
  enabled?: boolean;
  givenName?: string;
  familyName?: string;
  email?: string;
  username?: string;
  primaryRole?: string;
}

async function requireServiceToken(req: any, reply: any) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected) {
    // Fail closed: without a configured token nothing may use this surface.
    return reply.status(503).send({ error: "INTERNAL_SERVICE_TOKEN is not configured" });
  }
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ") || auth.slice(7) !== expected) {
    return reply.status(401).send({ error: "Service token required" });
  }
}

export function registerInternalRosterRoutes(app: FastifyInstance, db: any) {
  app.post(
    "/internal/roster/users/upsert",
    { schema: internalRosterUsersUpsertSchema, preHandler: requireServiceToken },
    async (req: any, reply: any) => {
      const { tenantId, provider, record } = (req.body ?? {}) as {
        tenantId?: string;
        provider?: string;
        record?: CanonicalUserRecord;
      };
      if (!tenantId || !record?.sourcedId) {
        return reply.status(400).send({ error: "tenantId and record.sourcedId are required" });
      }
      const primaryRole = String(record.primaryRole ?? "").toLowerCase();
      if (primaryRole === "student") {
        return reply.status(422).send({
          error:
            "Students are not provisioned as users — learners roster via enrollments. Skip this record upstream.",
          code: "studentsNotUsers",
        });
      }
      const role = ONEROSTER_ROLE_MAP[primaryRole];
      if (!role) {
        return reply
          .status(422)
          .send({ error: `Unsupported primaryRole: ${record.primaryRole}`, code: "invalidRole" });
      }
      const email = record.email || record.username;
      if (!email) {
        return reply.status(400).send({ error: "record.email (or username) is required" });
      }
      const name =
        [record.givenName, record.familyName].filter(Boolean).join(" ").trim() || email;

      // OneRoster `enabled:false` arriving through upsert = deactivate.
      if (record.enabled === false) {
        const result = await applyUserDeactivate(db, {
          tenantId,
          externalId: record.sourcedId,
          email,
        });
        if (!result.ok) {
          return reply.status(result.error.status).send({ error: result.error.message });
        }
        return { ok: true, userId: result.user.id, deactivated: true };
      }

      const result = await applyUserUpsert(db, {
        tenantId,
        email,
        name,
        role,
        externalId: record.sourcedId,
        provisionedBy: provider === "csv" ? "csv" : "sis",
      });
      if (!result.ok) {
        return reply.status(result.error.status).send({ error: result.error.message });
      }
      return { ok: true, userId: result.user.id, created: result.created };
    },
  );

  app.post(
    "/internal/roster/users/deactivate",
    { schema: internalRosterUsersDeactivateSchema, preHandler: requireServiceToken },
    async (req: any, reply: any) => {
      const { tenantId, sourcedId } = (req.body ?? {}) as {
        tenantId?: string;
        sourcedId?: string;
      };
      if (!tenantId || !sourcedId) {
        return reply.status(400).send({ error: "tenantId and sourcedId are required" });
      }
      const result = await applyUserDeactivate(db, { tenantId, externalId: sourcedId });
      if (!result.ok) {
        return reply.status(result.error.status).send({ error: result.error.message });
      }
      return { ok: true, userId: result.user.id };
    },
  );
}
