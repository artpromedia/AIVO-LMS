/**
 * Sprint 4: audit hash-chain verification endpoint.
 *
 * Walks each audit table in `seq` order, recomputes the chain hash row by
 * row, and reports the first row (if any) where the hash diverges from the
 * stored value. Rows with NULL hash are treated as legacy pre-chain entries
 * and skipped (the chain begins at the first row with a non-NULL hash).
 */
import { FastifyInstance } from "fastify";
import { auditEvents, adminAuditLog, districtActivityLog } from "@aivo/db";
import { computeAuditHash, verifyJWT } from "@aivo/security";
import { sql } from "drizzle-orm";
import { getAdminSvcAuditLogVerifySchema } from "./schemas.js";

interface ChainResult {
  table: string;
  totalRows: number;
  chainStartSeq: number | null;
  lastVerifiedSeq: number | null;
  brokenAtSeq: number | null;
  ok: boolean;
}

const PAYLOAD_KEYS: Record<string, readonly string[]> = {
  audit_events: [
    "tenantId",
    "userId",
    "eventType",
    "resourceType",
    "resourceId",
    "details",
    "ipAddress",
    "userAgent",
  ],
  admin_audit_log: [
    "action",
    "actorId",
    "actorEmail",
    "actorRole",
    "onBehalfOfId",
    "resourceType",
    "resourceId",
    "details",
    "ipAddress",
    "userAgent",
    "tenantId",
  ],
  district_activity_log: [
    "tenantId",
    "action",
    "actorId",
    "actorName",
    "onBehalfOfId",
    "resourceType",
    "resourceId",
    "details",
  ],
};

async function verifyChain(db: any, tableName: string, drizzleTable: any): Promise<ChainResult> {
  const totalRes: any = await db.execute(
    sql`SELECT count(*)::int AS n FROM ${sql.identifier(tableName)}`,
  );
  const totalRows = (Array.isArray(totalRes) ? totalRes[0]?.n : totalRes?.rows?.[0]?.n) ?? 0;

  const rows = await db.select().from(drizzleTable).orderBy(drizzleTable.seq);
  const keys = PAYLOAD_KEYS[tableName] ?? [];

  let prev = "";
  let chainStartSeq: number | null = null;
  let lastVerifiedSeq: number | null = null;
  for (const row of rows as any[]) {
    if (row.hash == null) continue; // legacy pre-chain row
    if (chainStartSeq === null) {
      chainStartSeq = Number(row.seq);
      prev = row.prevHash ?? "";
    }
    const payload: Record<string, any> = {};
    for (const k of keys) payload[k] = row[k];
    const expected = computeAuditHash(prev, payload);
    if (expected !== row.hash || (lastVerifiedSeq !== null && (row.prevHash ?? "") !== prev)) {
      return {
        table: tableName,
        totalRows,
        chainStartSeq,
        lastVerifiedSeq,
        brokenAtSeq: Number(row.seq),
        ok: false,
      };
    }
    prev = row.hash;
    lastVerifiedSeq = Number(row.seq);
  }
  return {
    table: tableName,
    totalRows,
    chainStartSeq,
    lastVerifiedSeq,
    brokenAtSeq: null,
    ok: true,
  };
}

export async function runAuditChainVerification(
  db: any,
): Promise<{ ok: boolean; chains: ChainResult[] }> {
  const chains = await Promise.all([
    verifyChain(db, "audit_events", auditEvents),
    verifyChain(db, "admin_audit_log", adminAuditLog),
    verifyChain(db, "district_activity_log", districtActivityLog),
  ]);
  return { ok: chains.every((c) => c.ok), chains };
}

async function requirePlatformAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return reply.status(401).send({ error: "Missing authorization header" });
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN")
      return reply.status(403).send({ error: "Platform admin access required" });
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export function registerAuditVerifyRoutes(app: FastifyInstance, db: any) {
  app.get(
    "/api/admin-svc/audit-log/verify",
    { schema: getAdminSvcAuditLogVerifySchema, preHandler: requirePlatformAdmin },
    async () => {
      return await runAuditChainVerification(db);
    },
  );
}
