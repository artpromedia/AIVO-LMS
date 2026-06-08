/**
 * Security posture: SOC 2 / Trust Services control register.
 *
 * Postgres-backed (security_controls / security_control_evidence in @aivo/db),
 * replacing the in-memory store the legacy web-v2 admin used. Surfaced in the
 * web-admin platform console.
 *
 *   GET   /api/admin-svc/security/controls          — list (ordered by code)
 *   GET   /api/admin-svc/security/controls/:id      — control + evidence
 *   POST  /api/admin-svc/security/controls          — create
 *   PATCH /api/admin-svc/security/controls/:id      — update status / fields
 *
 * Every write is hash-chained into admin_audit_log via appendAudit.
 */
import { FastifyInstance } from "fastify";
import { asc, desc, eq } from "drizzle-orm";
import {
  securityControls,
  securityControlEvidence,
  securityIncidents,
  securityRisks,
  securityVendors,
  securityVulnerabilities,
  adminAuditLog,
  appendAudit,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";

const CRITERIA = new Set([
  "security",
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
]);
const STATUSES = new Set(["implemented", "partial", "not_started", "not_applicable"]);
const SEVERITIES = new Set(["sev1", "sev2", "sev3", "sev4"]);
const INCIDENT_STATUSES = new Set([
  "open",
  "investigating",
  "mitigating",
  "resolved",
  "post_mortem",
]);

const RISK_CATEGORIES = new Set([
  "security",
  "privacy",
  "availability",
  "operational",
  "third_party",
]);
const RISK_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const RISK_TREATMENTS = new Set(["accept", "mitigate", "transfer", "avoid"]);

const VENDOR_CATEGORIES = new Set([
  "llm_provider",
  "tts_provider",
  "infra",
  "analytics",
  "support",
  "billing",
  "other",
]);
const VENDOR_RISK_TIERS = new Set(["tier1", "tier2", "tier3"]);

const VULN_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const VULN_STATUSES = new Set(["open", "triaged", "fixed", "wontfix"]);
const VULN_SOURCES = new Set([
  "dependency_scan",
  "container_scan",
  "iac_scan",
  "pen_test",
  "external_report",
  "internal",
]);

async function requirePlatformAdmin(req: any, reply: any): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return false;
  }
  try {
    const payload = await verifyJWT<any>(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN") {
      reply.status(403).send({ error: "Platform admin access required" });
      return false;
    }
    req.user = payload;
    return true;
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return false;
  }
}

function mapControl(row: any) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description ?? "",
    criterion: row.criterion,
    owner: row.owner ?? "",
    status: row.status,
    lastReviewedAt: row.lastReviewedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

function mapEvidence(row: any) {
  return {
    id: row.id,
    controlId: row.controlId,
    kind: row.kind,
    summary: row.summary ?? "",
    uri: row.uri ?? null,
    collectedByUserId: row.collectedByUserId ?? null,
    collectedAt: row.collectedAt?.toISOString?.() ?? null,
  };
}

function mapIncident(row: any) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? "",
    severity: row.severity,
    status: row.status,
    commanderUserId: row.commanderUserId ?? null,
    customerImpact: Boolean(row.customerImpact),
    regulatorNotificationRequired: Boolean(row.regulatorNotificationRequired),
    detectedAt: row.detectedAt?.toISOString?.() ?? null,
    resolvedAt: row.resolvedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

function mapRisk(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    category: row.category,
    inherentSeverity: row.inherentSeverity,
    residualSeverity: row.residualSeverity,
    treatment: row.treatment,
    owner: row.owner ?? "",
    open: Boolean(row.open),
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

function mapVendor(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    dataResidency: row.dataResidency ?? "",
    processesLearnerData: Boolean(row.processesLearnerData),
    dpaSigned: Boolean(row.dpaSigned),
    riskTier: row.riskTier,
    approved: Boolean(row.approved),
    notes: row.notes ?? null,
    lastReviewedAt: row.lastReviewedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

function mapVuln(row: any) {
  return {
    id: row.id,
    title: row.title,
    cveId: row.cveId ?? null,
    severity: row.severity,
    status: row.status,
    source: row.source,
    affectedComponent: row.affectedComponent ?? "",
    fixedIn: row.fixedIn ?? null,
    discoveredAt: row.discoveredAt?.toISOString?.() ?? null,
    resolvedAt: row.resolvedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

async function audit(
  db: any,
  resourceType: string,
  action: string,
  actor: any,
  resource: any,
  details: Record<string, any>,
) {
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    action,
    actorId: actor.impersonatedBy || actor.sub,
    actorEmail: actor.email || "",
    actorRole: actor.role,
    onBehalfOfId: actor.impersonatedBy ? actor.sub : null,
    resourceType,
    resourceId: resource.id,
    details,
    ipAddress: null,
    userAgent: null,
    tenantId: actor.tenantId ?? null,
  });
}

export function registerSecurityRoutes(app: FastifyInstance, db: any): void {
  app.get(
    "/api/admin-svc/security/controls",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const rows = await db.select().from(securityControls).orderBy(asc(securityControls.code));
      return { controls: rows.map(mapControl) };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/admin-svc/security/controls/:id",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const [control] = await db
        .select()
        .from(securityControls)
        .where(eq(securityControls.id, id))
        .limit(1);
      if (!control) return reply.code(404).send({ error: "control_not_found" });
      const evidence = await db
        .select()
        .from(securityControlEvidence)
        .where(eq(securityControlEvidence.controlId, id))
        .orderBy(desc(securityControlEvidence.collectedAt));
      return { control: mapControl(control), evidence: evidence.map(mapEvidence) };
    },
  );

  app.post<{
    Body: {
      code?: string;
      title?: string;
      description?: string;
      criterion?: string;
      owner?: string;
      status?: string;
    };
  }>(
    "/api/admin-svc/security/controls",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const body = req.body ?? {};
      const code = String(body.code ?? "").trim();
      const title = String(body.title ?? "").trim();
      if (!code || !title) {
        return reply.code(400).send({ error: "code and title are required" });
      }
      const criterion = CRITERIA.has(String(body.criterion)) ? String(body.criterion) : "security";
      const status = STATUSES.has(String(body.status)) ? String(body.status) : "not_started";
      const [created] = await db
        .insert(securityControls)
        .values({
          code,
          title,
          description: String(body.description ?? ""),
          criterion,
          owner: String(body.owner ?? ""),
          status,
        })
        .returning();
      await audit(db, "security_control", "security_control_created", (req as any).user, created, {
        code,
        criterion,
        status,
      });
      return reply.code(201).send({ control: mapControl(created) });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { title?: string; description?: string; criterion?: string; owner?: string; status?: string };
  }>(
    "/api/admin-svc/security/controls/:id",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { lastReviewedAt: new Date(), updatedAt: new Date() };
      if (body.title !== undefined) patch.title = String(body.title);
      if (body.description !== undefined) patch.description = String(body.description);
      if (body.owner !== undefined) patch.owner = String(body.owner);
      if (body.criterion !== undefined) {
        if (!CRITERIA.has(String(body.criterion))) {
          return reply.code(400).send({ error: "invalid criterion" });
        }
        patch.criterion = String(body.criterion);
      }
      if (body.status !== undefined) {
        if (!STATUSES.has(String(body.status))) {
          return reply.code(400).send({ error: "invalid status" });
        }
        patch.status = String(body.status);
      }
      const [updated] = await db
        .update(securityControls)
        .set(patch)
        .where(eq(securityControls.id, id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "control_not_found" });
      await audit(db, "security_control", "security_control_updated", (req as any).user, updated, {
        status: updated.status,
        criterion: updated.criterion,
      });
      return { control: mapControl(updated) };
    },
  );

  // ── Incidents ────────────────────────────────────────────────────────────

  app.get(
    "/api/admin-svc/security/incidents",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const rows = await db
        .select()
        .from(securityIncidents)
        .orderBy(desc(securityIncidents.detectedAt));
      return { incidents: rows.map(mapIncident) };
    },
  );

  app.post<{
    Body: {
      title?: string;
      summary?: string;
      severity?: string;
      status?: string;
      commanderUserId?: string;
      customerImpact?: boolean;
      regulatorNotificationRequired?: boolean;
    };
  }>(
    "/api/admin-svc/security/incidents",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const body = req.body ?? {};
      const title = String(body.title ?? "").trim();
      if (!title) return reply.code(400).send({ error: "title is required" });
      const severity = SEVERITIES.has(String(body.severity)) ? String(body.severity) : "sev3";
      const status = INCIDENT_STATUSES.has(String(body.status)) ? String(body.status) : "open";
      const [created] = await db
        .insert(securityIncidents)
        .values({
          title,
          summary: String(body.summary ?? ""),
          severity,
          status,
          commanderUserId: body.commanderUserId ? String(body.commanderUserId) : null,
          customerImpact: Boolean(body.customerImpact),
          regulatorNotificationRequired: Boolean(body.regulatorNotificationRequired),
        })
        .returning();
      await audit(db, "security_incident", "security_incident_created", (req as any).user, created, {
        severity,
        status,
        customerImpact: Boolean(body.customerImpact),
      });
      return reply.code(201).send({ incident: mapIncident(created) });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      summary?: string;
      severity?: string;
      status?: string;
      commanderUserId?: string | null;
      customerImpact?: boolean;
      regulatorNotificationRequired?: boolean;
    };
  }>(
    "/api/admin-svc/security/incidents/:id",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.title !== undefined) patch.title = String(body.title);
      if (body.summary !== undefined) patch.summary = String(body.summary);
      if (body.commanderUserId !== undefined) {
        patch.commanderUserId = body.commanderUserId ? String(body.commanderUserId) : null;
      }
      if (body.customerImpact !== undefined) patch.customerImpact = Boolean(body.customerImpact);
      if (body.regulatorNotificationRequired !== undefined) {
        patch.regulatorNotificationRequired = Boolean(body.regulatorNotificationRequired);
      }
      if (body.severity !== undefined) {
        if (!SEVERITIES.has(String(body.severity))) {
          return reply.code(400).send({ error: "invalid severity" });
        }
        patch.severity = String(body.severity);
      }
      if (body.status !== undefined) {
        if (!INCIDENT_STATUSES.has(String(body.status))) {
          return reply.code(400).send({ error: "invalid status" });
        }
        patch.status = String(body.status);
        // Stamp resolution time when entering a terminal state.
        if (body.status === "resolved" || body.status === "post_mortem") {
          patch.resolvedAt = new Date();
        }
      }
      const [updated] = await db
        .update(securityIncidents)
        .set(patch)
        .where(eq(securityIncidents.id, id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "incident_not_found" });
      await audit(db, "security_incident", "security_incident_updated", (req as any).user, updated, {
        severity: updated.severity,
        status: updated.status,
      });
      return { incident: mapIncident(updated) };
    },
  );

  // ── Risks ──────────────────────────────────────────────────────────────────

  app.get(
    "/api/admin-svc/security/risks",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const rows = await db.select().from(securityRisks).orderBy(desc(securityRisks.createdAt));
      return { risks: rows.map(mapRisk) };
    },
  );

  app.post<{
    Body: {
      title?: string;
      description?: string;
      category?: string;
      inherentSeverity?: string;
      residualSeverity?: string;
      treatment?: string;
      owner?: string;
      open?: boolean;
    };
  }>(
    "/api/admin-svc/security/risks",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const body = req.body ?? {};
      const title = String(body.title ?? "").trim();
      if (!title) return reply.code(400).send({ error: "title is required" });
      const category = RISK_CATEGORIES.has(String(body.category))
        ? String(body.category)
        : "security";
      const inherentSeverity = RISK_SEVERITIES.has(String(body.inherentSeverity))
        ? String(body.inherentSeverity)
        : "medium";
      const residualSeverity = RISK_SEVERITIES.has(String(body.residualSeverity))
        ? String(body.residualSeverity)
        : "medium";
      const treatment = RISK_TREATMENTS.has(String(body.treatment))
        ? String(body.treatment)
        : "mitigate";
      const [created] = await db
        .insert(securityRisks)
        .values({
          title,
          description: String(body.description ?? ""),
          category,
          inherentSeverity,
          residualSeverity,
          treatment,
          owner: String(body.owner ?? ""),
          open: body.open === undefined ? true : Boolean(body.open),
        })
        .returning();
      await audit(db, "security_risk", "security_risk_created", (req as any).user, created, {
        category,
        inherentSeverity,
        treatment,
      });
      return reply.code(201).send({ risk: mapRisk(created) });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      category?: string;
      inherentSeverity?: string;
      residualSeverity?: string;
      treatment?: string;
      owner?: string;
      open?: boolean;
    };
  }>(
    "/api/admin-svc/security/risks/:id",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.title !== undefined) patch.title = String(body.title);
      if (body.description !== undefined) patch.description = String(body.description);
      if (body.owner !== undefined) patch.owner = String(body.owner);
      if (body.open !== undefined) patch.open = Boolean(body.open);
      if (body.category !== undefined) {
        if (!RISK_CATEGORIES.has(String(body.category))) {
          return reply.code(400).send({ error: "invalid category" });
        }
        patch.category = String(body.category);
      }
      if (body.inherentSeverity !== undefined) {
        if (!RISK_SEVERITIES.has(String(body.inherentSeverity))) {
          return reply.code(400).send({ error: "invalid inherentSeverity" });
        }
        patch.inherentSeverity = String(body.inherentSeverity);
      }
      if (body.residualSeverity !== undefined) {
        if (!RISK_SEVERITIES.has(String(body.residualSeverity))) {
          return reply.code(400).send({ error: "invalid residualSeverity" });
        }
        patch.residualSeverity = String(body.residualSeverity);
      }
      if (body.treatment !== undefined) {
        if (!RISK_TREATMENTS.has(String(body.treatment))) {
          return reply.code(400).send({ error: "invalid treatment" });
        }
        patch.treatment = String(body.treatment);
      }
      const [updated] = await db
        .update(securityRisks)
        .set(patch)
        .where(eq(securityRisks.id, id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "risk_not_found" });
      await audit(db, "security_risk", "security_risk_updated", (req as any).user, updated, {
        treatment: updated.treatment,
        residualSeverity: updated.residualSeverity,
      });
      return { risk: mapRisk(updated) };
    },
  );

  // ── Vendors ────────────────────────────────────────────────────────────────

  app.get(
    "/api/admin-svc/security/vendors",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const rows = await db.select().from(securityVendors).orderBy(asc(securityVendors.name));
      return { vendors: rows.map(mapVendor) };
    },
  );

  app.post<{
    Body: {
      name?: string;
      category?: string;
      dataResidency?: string;
      processesLearnerData?: boolean;
      dpaSigned?: boolean;
      riskTier?: string;
      approved?: boolean;
      notes?: string | null;
    };
  }>(
    "/api/admin-svc/security/vendors",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const body = req.body ?? {};
      const name = String(body.name ?? "").trim();
      if (!name) return reply.code(400).send({ error: "name is required" });
      const category = VENDOR_CATEGORIES.has(String(body.category))
        ? String(body.category)
        : "other";
      const riskTier = VENDOR_RISK_TIERS.has(String(body.riskTier))
        ? String(body.riskTier)
        : "tier3";
      const [created] = await db
        .insert(securityVendors)
        .values({
          name,
          category,
          dataResidency: String(body.dataResidency ?? ""),
          processesLearnerData: Boolean(body.processesLearnerData),
          dpaSigned: Boolean(body.dpaSigned),
          riskTier,
          approved: Boolean(body.approved),
          notes: body.notes ? String(body.notes) : null,
        })
        .returning();
      await audit(db, "security_vendor", "security_vendor_created", (req as any).user, created, {
        category,
        riskTier,
        approved: Boolean(body.approved),
      });
      return reply.code(201).send({ vendor: mapVendor(created) });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      category?: string;
      dataResidency?: string;
      processesLearnerData?: boolean;
      dpaSigned?: boolean;
      riskTier?: string;
      approved?: boolean;
      notes?: string | null;
    };
  }>(
    "/api/admin-svc/security/vendors/:id",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { lastReviewedAt: new Date(), updatedAt: new Date() };
      if (body.name !== undefined) patch.name = String(body.name);
      if (body.dataResidency !== undefined) patch.dataResidency = String(body.dataResidency);
      if (body.processesLearnerData !== undefined) {
        patch.processesLearnerData = Boolean(body.processesLearnerData);
      }
      if (body.dpaSigned !== undefined) patch.dpaSigned = Boolean(body.dpaSigned);
      if (body.approved !== undefined) patch.approved = Boolean(body.approved);
      if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;
      if (body.category !== undefined) {
        if (!VENDOR_CATEGORIES.has(String(body.category))) {
          return reply.code(400).send({ error: "invalid category" });
        }
        patch.category = String(body.category);
      }
      if (body.riskTier !== undefined) {
        if (!VENDOR_RISK_TIERS.has(String(body.riskTier))) {
          return reply.code(400).send({ error: "invalid riskTier" });
        }
        patch.riskTier = String(body.riskTier);
      }
      const [updated] = await db
        .update(securityVendors)
        .set(patch)
        .where(eq(securityVendors.id, id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "vendor_not_found" });
      await audit(db, "security_vendor", "security_vendor_updated", (req as any).user, updated, {
        riskTier: updated.riskTier,
        approved: Boolean(updated.approved),
      });
      return { vendor: mapVendor(updated) };
    },
  );

  // ── Vulnerabilities ──────────────────────────────────────────────────────────

  app.get(
    "/api/admin-svc/security/vulnerabilities",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const rows = await db
        .select()
        .from(securityVulnerabilities)
        .orderBy(desc(securityVulnerabilities.discoveredAt));
      return { vulnerabilities: rows.map(mapVuln) };
    },
  );

  app.post<{
    Body: {
      title?: string;
      cveId?: string | null;
      severity?: string;
      status?: string;
      source?: string;
      affectedComponent?: string;
      fixedIn?: string | null;
    };
  }>(
    "/api/admin-svc/security/vulnerabilities",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const body = req.body ?? {};
      const title = String(body.title ?? "").trim();
      if (!title) return reply.code(400).send({ error: "title is required" });
      const severity = VULN_SEVERITIES.has(String(body.severity))
        ? String(body.severity)
        : "medium";
      const status = VULN_STATUSES.has(String(body.status)) ? String(body.status) : "open";
      const source = VULN_SOURCES.has(String(body.source)) ? String(body.source) : "internal";
      const [created] = await db
        .insert(securityVulnerabilities)
        .values({
          title,
          cveId: body.cveId ? String(body.cveId) : null,
          severity,
          status,
          source,
          affectedComponent: String(body.affectedComponent ?? ""),
          fixedIn: body.fixedIn ? String(body.fixedIn) : null,
          resolvedAt: status === "fixed" || status === "wontfix" ? new Date() : null,
        })
        .returning();
      await audit(
        db,
        "security_vulnerability",
        "security_vulnerability_created",
        (req as any).user,
        created,
        { severity, status, source },
      );
      return reply.code(201).send({ vulnerability: mapVuln(created) });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      cveId?: string | null;
      severity?: string;
      status?: string;
      source?: string;
      affectedComponent?: string;
      fixedIn?: string | null;
    };
  }>(
    "/api/admin-svc/security/vulnerabilities/:id",
    { schema: { tags: ["security"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.title !== undefined) patch.title = String(body.title);
      if (body.cveId !== undefined) patch.cveId = body.cveId ? String(body.cveId) : null;
      if (body.affectedComponent !== undefined) {
        patch.affectedComponent = String(body.affectedComponent);
      }
      if (body.fixedIn !== undefined) patch.fixedIn = body.fixedIn ? String(body.fixedIn) : null;
      if (body.severity !== undefined) {
        if (!VULN_SEVERITIES.has(String(body.severity))) {
          return reply.code(400).send({ error: "invalid severity" });
        }
        patch.severity = String(body.severity);
      }
      if (body.source !== undefined) {
        if (!VULN_SOURCES.has(String(body.source))) {
          return reply.code(400).send({ error: "invalid source" });
        }
        patch.source = String(body.source);
      }
      if (body.status !== undefined) {
        if (!VULN_STATUSES.has(String(body.status))) {
          return reply.code(400).send({ error: "invalid status" });
        }
        patch.status = String(body.status);
        // Stamp resolution time when entering a terminal state.
        if (body.status === "fixed" || body.status === "wontfix") {
          patch.resolvedAt = new Date();
        }
      }
      const [updated] = await db
        .update(securityVulnerabilities)
        .set(patch)
        .where(eq(securityVulnerabilities.id, id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "vulnerability_not_found" });
      await audit(
        db,
        "security_vulnerability",
        "security_vulnerability_updated",
        (req as any).user,
        updated,
        { severity: updated.severity, status: updated.status },
      );
      return { vulnerability: mapVuln(updated) };
    },
  );
}
