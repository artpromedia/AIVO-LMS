/**
 * Sprint 11 — `/api/admin-svc/compliance/evidence` endpoints.
 *
 * - `GET  /api/admin-svc/compliance/evidence`        — list last 30 days
 * - `GET  /api/admin-svc/compliance/evidence/:date`  — download tar.gz
 *                                                      (step-up `data:export`)
 * - `POST /api/admin-svc/compliance/evidence/run`    — trigger an
 *                                                      ad-hoc bundle now
 *                                                      (PLATFORM_ADMIN +
 *                                                      step-up only)
 *
 * Downloads emit `Content-Disposition` with the bundle filename; the
 * sha256 is also returned in the `X-Evidence-Sha256` header so the UI
 * can verify the file the user just downloaded matches what we record.
 */
import { FastifyInstance } from "fastify";
import { promises as fs } from "fs";
import path from "path";
import { evidenceBundles } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { desc, eq } from "drizzle-orm";
// `verifyJWT` retained above only for `requirePlatformAdmin`.
import { EVIDENCE_DIR, generateEvidenceBundle } from "../lib/soc2-evidence.js";
import { logAuditEvent } from "./audit.js";
import {
  getAdminSvcComplianceEvidenceSchema,
  getAdminSvcComplianceEvidenceByDateSchema,
  adminSvcComplianceEvidenceRunSchema,
} from "./schemas.js";

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

/**
 * Step-up gate for `data:export`. We delegate verification to identity-svc
 * (`POST /api/auth/step-up/verify-internal`) so the same single-use jti
 * store gates both services — preventing replay of a step-up token here
 * after it was already consumed there (or vice versa).
 */
const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`admin-svc: ${name} must be set in production`);
  return devDefault;
}
const IDENTITY_URL = requireUrl("IDENTITY_SVC_URL", "http://localhost:3001");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

async function requireDataExportStepUp(req: any, reply: any) {
  // Always delegate to identity-svc — including the missing-token case —
  // so the flag-off semantics (`{ valid:true, skipped:true }`) match
  // identity's in-process `requireStepUp` no-op behavior. Identity will
  // 400 on missing fields when the flag is on, which we surface as 401.
  const token = (req.headers["x-step-up-token"] as string) || "";
  let res: Response;
  try {
    res = await fetch(`${IDENTITY_URL}/api/auth/step-up/verify-internal`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ token, scope: "data:export", callerSub: req.user?.sub }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return reply.status(502).send({ error: "Step-up verifier unavailable" });
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* ignored */
  }
  if (res.ok && body?.valid) return; // includes flag-off skipped:true
  // Map identity's response back to client-facing status codes.
  const reason = body?.reason || "unknown";
  const status = res.status === 401 ? 401 : reason === "missing-fields" ? 401 : 403;
  return reply.status(status).send({
    error: "Step-up rejected",
    code: "STEP_UP_REQUIRED",
    scope: "data:export",
    reason,
  });
}

export function registerEvidenceRoutes(app: FastifyInstance, db: any) {
  app.get(
    "/api/admin-svc/compliance/evidence",
    { schema: getAdminSvcComplianceEvidenceSchema, preHandler: requirePlatformAdmin },
    async () => {
      const rows = await db
        .select()
        .from(evidenceBundles)
        .orderBy(desc(evidenceBundles.bundleDate))
        .limit(30);
      return { bundles: rows };
    },
  );

  app.get(
    "/api/admin-svc/compliance/evidence/:date",
    {
      schema: getAdminSvcComplianceEvidenceByDateSchema,
      preHandler: [requirePlatformAdmin, requireDataExportStepUp],
    },
    async (req: any, reply) => {
      const { date } = req.params as { date: string };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return reply.status(400).send({ error: "Invalid date" });

      const [row] = await db
        .select()
        .from(evidenceBundles)
        .where(eq(evidenceBundles.bundleDate, date))
        .limit(1);
      if (!row) return reply.status(404).send({ error: "No bundle for that date" });

      const filepath = path.join(EVIDENCE_DIR, row.filename);
      let buf: Buffer;
      try {
        buf = await fs.readFile(filepath);
      } catch {
        return reply
          .status(410)
          .send({ error: "Bundle file missing on disk", filename: row.filename });
      }

      await logAuditEvent(db, {
        action: "EVIDENCE_DOWNLOADED",
        actorId: req.user.sub,
        actorEmail: req.user.email || "",
        actorRole: req.user.role || "",
        resourceType: "evidence_bundle",
        resourceId: row.id,
        details: { bundleDate: row.bundleDate, sha256: row.sha256 },
      });

      reply.header("content-type", "application/gzip");
      reply.header("content-disposition", `attachment; filename="${row.filename}"`);
      reply.header("x-evidence-sha256", row.sha256);
      return reply.send(buf);
    },
  );

  app.post(
    "/api/admin-svc/compliance/evidence/run",
    {
      schema: adminSvcComplianceEvidenceRunSchema,
      preHandler: [requirePlatformAdmin, requireDataExportStepUp],
    },
    async (req: any) => {
      const result = await generateEvidenceBundle(db);
      await logAuditEvent(db, {
        action: "EVIDENCE_GENERATED",
        actorId: req.user.sub,
        actorEmail: req.user.email || "",
        actorRole: req.user.role || "",
        resourceType: "evidence_bundle",
        resourceId: result.bundleDate,
        details: { triggered: "manual", sha256: result.sha256, sizeBytes: result.sizeBytes },
      });
      return { status: "generated", ...result };
    },
  );
}
