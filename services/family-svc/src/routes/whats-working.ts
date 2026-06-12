/**
 * Parent-dashboard "what's working" route — task: reframe the dashboard
 * around patterns parents can take to an IEP meeting.
 *
 * The route accepts session rows from the host *or* falls back to the
 * `ef_session_outcomes` ledger that tutor-svc writes after each
 * session. Earlier this was POST-only with an explicit body; the GET
 * variant added here is the primary surface the web UI uses.
 *
 *   GET  /api/family/whats-working/:learnerId?windowDays=30
 *        → fetches the last 5,000 rows from `ef_session_outcomes` and
 *          runs them through the pure analytics module. No body.
 *   POST /api/family/whats-working/:learnerId
 *        → body { rows?, windowDays? }; if `rows` is omitted the route
 *          falls back to the same DB source as the GET variant. Lets
 *          callers test ad-hoc cohorts without writing to the ledger.
 */
import { FastifyInstance } from "fastify";
import { eq, desc, gte, and } from "drizzle-orm";
import { efSessionOutcomes } from "@aivo/db";
import { authenticateRequest, verifyParentOwnership, verifyTeacherAccess } from "../auth.js";
import { computeWhatsWorking, type SessionRow } from "../services/whats-working.js";
import {
  getTeacherWhatsWorkingByLearnerIdSchema,
  getWhatsWorkingByLearnerIdSchema,
  whatsWorkingByLearnerIdSchema,
} from "./schemas.js";

interface WhatsWorkingBody {
  rows?: SessionRow[];
  windowDays?: number;
}

/**
 * Cap on rows accepted per request. >30 days of sessions for any
 * realistic learner; bounds compute and memory per call so an
 * authenticated caller cannot trigger amplified analytics work.
 */
const MAX_ROWS_PER_REQUEST = 5_000;

/** Simple per-subject token bucket: ≤ BURST requests / WINDOW_MS. */
const RATE_BURST = 30;
const RATE_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(subject: string, now: number): boolean {
  const b = buckets.get(subject);
  if (!b || b.resetAt <= now) {
    buckets.set(subject, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_BURST) return false;
  b.count += 1;
  return true;
}

const VALID_MODALITY = new Set(["visual", "auditory", "kinesthetic", "reading"]);

/**
 * Pull session-outcome rows from the EF ledger and adapt them to the
 * pure analytics module's `SessionRow` shape. Limited to
 * MAX_ROWS_PER_REQUEST and the requested window.
 */
async function loadDbRows(db: any, learnerId: string, windowDays: number): Promise<SessionRow[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(efSessionOutcomes)
    .where(and(eq(efSessionOutcomes.learnerId, learnerId), gte(efSessionOutcomes.startedAt, since)))
    .orderBy(desc(efSessionOutcomes.startedAt))
    .limit(MAX_ROWS_PER_REQUEST);
  return rows.map((r: any) => ({
    startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt),
    subject: r.subject ?? undefined,
    accuracy: Number(r.accuracy) || 0,
    frustrationRate: Number(r.frustrationRate) || 0,
    attentionMinutes: Number(r.attentionMinutes) || 0,
    modality:
      r.modality && VALID_MODALITY.has(r.modality)
        ? (r.modality as SessionRow["modality"])
        : undefined,
  }));
}

export async function registerWhatsWorkingRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get(
    "/api/family/whats-working/:learnerId",
    { schema: getWhatsWorkingByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      if (!rateLimit(auth.sub, Date.now())) {
        return reply.code(429).send({ error: "Too many requests" });
      }
      const { learnerId } = req.params as { learnerId: string };
      const owns = await verifyParentOwnership(db, auth.tenantId, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const q = (req.query ?? {}) as { windowDays?: string };
      const parsed = q.windowDays ? Number(q.windowDays) : NaN;
      const windowDays =
        Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? Math.floor(parsed) : 30;
      const rows = await loadDbRows(db, learnerId, windowDays);
      return computeWhatsWorking(rows, { windowDays });
    },
  );

  // Teacher-facing surface — same EF-derived insights the parent sees, so a
  // teacher and parent walk into an IEP / progress meeting with the same
  // patterns. Access is gated on an ACCEPTED `learner_teachers` link rather
  // than parent ownership; the analytics + ledger source are identical.
  app.get(
    "/api/family/teacher/whats-working/:learnerId",
    { schema: getTeacherWhatsWorkingByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      if (!rateLimit(auth.sub, Date.now())) {
        return reply.code(429).send({ error: "Too many requests" });
      }
      const { learnerId } = req.params as { learnerId: string };
      const allowed = await verifyTeacherAccess(db, auth.tenantId, auth.sub, learnerId);
      if (!allowed) return reply.code(403).send({ error: "Forbidden" });

      const q = (req.query ?? {}) as { windowDays?: string };
      const parsed = q.windowDays ? Number(q.windowDays) : NaN;
      const windowDays =
        Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? Math.floor(parsed) : 30;
      const rows = await loadDbRows(db, learnerId, windowDays);
      return computeWhatsWorking(rows, { windowDays });
    },
  );

  // audit-exempt(whats-working POST: pure analytics compute over caller-
  // supplied or ledger rows; writes nothing)
  app.post(
    "/api/family/whats-working/:learnerId",
    { schema: whatsWorkingByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      if (!rateLimit(auth.sub, Date.now())) {
        return reply.code(429).send({ error: "Too many requests" });
      }
      const { learnerId } = req.params as { learnerId: string };
      const owns = await verifyParentOwnership(db, auth.tenantId, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const body = (req.body ?? {}) as WhatsWorkingBody;
      const windowDays =
        typeof body.windowDays === "number" && body.windowDays > 0
          ? Math.floor(body.windowDays)
          : 30;

      let rows: SessionRow[];
      if (Array.isArray(body.rows)) {
        if (body.rows.length > MAX_ROWS_PER_REQUEST) {
          return reply.code(413).send({ error: `rows exceeds maximum of ${MAX_ROWS_PER_REQUEST}` });
        }
        rows = body.rows;
      } else {
        // No rows in body → fall back to the DB ledger so the POST
        // surface is feature-equivalent to GET when omitted.
        rows = await loadDbRows(db, learnerId, windowDays);
      }
      return computeWhatsWorking(rows, { windowDays });
    },
  );
}
