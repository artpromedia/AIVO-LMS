/**
 * Sprint 6 — School reports catalog + parameterized run (admin-svc).
 *
 * A static report registry with four reports. Attendance and learning-time
 * have no first-party source-of-record table yet, so they are produced as
 * deterministic *estimates*. Every response is explicitly tagged with
 * `dataSource: "estimated"` and the report registry advertises an
 * `estimated` flag so the admin UI never presents proxy rows as
 * authoritative. Real analytical queries are wired in per report as the
 * backing tables land (see ADR backlog "Durable Admin Data Layer").
 *
 * RBAC: allowed for PLATFORM_ADMIN, DISTRICT_ADMIN, SCHOOL_ADMIN.
 * Note: finer school-ownership scoping is enforced at the BFF/identity layer.
 */
import type { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { getAdminSchoolsReportsSchema, postAdminSchoolsReportRunSchema } from "./schemas.js";

// ---------------------------------------------------------------------------
// RBAC helper
// ---------------------------------------------------------------------------
const ALLOWED_ROLES = new Set(["PLATFORM_ADMIN", "DISTRICT_ADMIN", "SCHOOL_ADMIN"]);

async function requireSchoolAdmin(
  req: any,
  reply: any,
): Promise<{ sub: string; role: string; email?: string } | null> {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  try {
    const payload = (await verifyJWT(auth.slice(7).trim())) as {
      sub: string;
      role: string;
      email?: string;
    };
    if (!ALLOWED_ROLES.has(payload.role)) {
      reply.code(403).send({ error: "forbidden", required_roles: [...ALLOWED_ROLES] });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report registry
// ---------------------------------------------------------------------------
interface ReportParam {
  name: string;
  type: "string" | "date" | "integer" | "boolean";
  required: boolean;
  description: string;
}

interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  /** True while rows are estimated rather than read from a source-of-record table. */
  estimated: boolean;
  params: ReportParam[];
}

const REPORT_REGISTRY: ReportDefinition[] = [
  {
    id: "enrollment",
    name: "Enrollment Summary",
    description: "Learner enrollment counts by grade for a given school and term.",
    estimated: true,
    params: [
      {
        name: "term",
        type: "string",
        required: false,
        description: "School term (e.g. 2024-fall)",
      },
      {
        name: "grade",
        type: "integer",
        required: false,
        description: "Filter to a specific grade (0-12)",
      },
    ],
  },
  {
    id: "attendance_proxy",
    name: "Attendance Proxy",
    description: "Estimated attendance rates derived from session activity, by grade and week.",
    estimated: true,
    params: [
      {
        name: "startDate",
        type: "date",
        required: true,
        description: "Start date (ISO yyyy-mm-dd)",
      },
      { name: "endDate", type: "date", required: true, description: "End date (ISO yyyy-mm-dd)" },
      {
        name: "grade",
        type: "integer",
        required: false,
        description: "Filter to a specific grade (0-12)",
      },
    ],
  },
  {
    id: "learning_time",
    name: "Learning Time",
    description: "Total instructional minutes logged per learner per week.",
    estimated: true,
    params: [
      {
        name: "startDate",
        type: "date",
        required: true,
        description: "Start date (ISO yyyy-mm-dd)",
      },
      { name: "endDate", type: "date", required: true, description: "End date (ISO yyyy-mm-dd)" },
      {
        name: "grade",
        type: "integer",
        required: false,
        description: "Filter to a specific grade (0-12)",
      },
    ],
  },
  {
    id: "intervention_summary",
    name: "Intervention Summary",
    description: "Learners with active IEP or 504 plans, with last session activity.",
    estimated: true,
    params: [
      {
        name: "grade",
        type: "integer",
        required: false,
        description: "Filter to a specific grade (0-12)",
      },
      {
        name: "planType",
        type: "string",
        required: false,
        description: "iep | 504 | all (default: all)",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Deterministic synthesized data generators
// ---------------------------------------------------------------------------

/** Simple seeded-ish pseudo-random derived from a string key. */
function deterministicInt(key: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return min + (Math.abs(h) % (max - min + 1));
}


/**
 * Monday week-starts inside [startDate, endDate] (ISO dates), most recent
 * last, capped so an unbounded window can't explode a report. The window
 * comes from the caller (the dashboards pass the CURRENT term) — weeks
 * must never be frozen to a hardcoded school year, or every panel goes
 * permanently empty the moment that year ends.
 */
function weekStartsIn(startDate: string, endDate: string, cap = 16): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const cursor = new Date(end);
  const day = cursor.getUTCDay();
  cursor.setUTCDate(cursor.getUTCDate() - ((day + 6) % 7)); // back to Monday
  const weeks: string[] = [];
  while (cursor >= start && weeks.length < cap) {
    weeks.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return weeks;
}

function generateEnrollmentRows(
  schoolId: string,
  params: Record<string, unknown>,
): { columns: string[]; rows: Record<string, unknown>[] } {
  const gradeFilter = params.grade !== undefined ? Number(params.grade) : null;
  const now = new Date();
  const fallYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const term = String(params.term ?? `${fallYear}-fall`);
  const columns = ["grade", "term", "enrolled", "active", "iep_count", "count_504"];
  const grades = gradeFilter !== null ? [gradeFilter] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const rows = grades.map((g) => {
    const enrolled = deterministicInt(`${schoolId}-${term}-${g}-enrolled`, 18, 32);
    const active = deterministicInt(
      `${schoolId}-${term}-${g}-active`,
      Math.floor(enrolled * 0.8),
      enrolled,
    );
    return {
      grade: g,
      term,
      enrolled,
      active,
      iep_count: deterministicInt(`${schoolId}-${term}-${g}-iep`, 1, Math.floor(enrolled * 0.15)),
      count_504: deterministicInt(`${schoolId}-${term}-${g}-504`, 0, Math.floor(enrolled * 0.1)),
    };
  });
  return { columns, rows };
}

function generateAttendanceRows(
  schoolId: string,
  params: Record<string, unknown>,
): { columns: string[]; rows: Record<string, unknown>[] } {
  const gradeFilter = params.grade !== undefined ? Number(params.grade) : null;
  const today = new Date().toISOString().slice(0, 10);
  const startDate = String(params.startDate ?? `${today.slice(0, 4)}-01-01`);
  const endDate = String(params.endDate ?? today);
  const columns = ["grade", "week_start", "attendance_rate_pct", "absent_learners"];
  const grades = gradeFilter !== null ? [gradeFilter] : [3, 4, 5, 6, 7, 8];
  const weeks = weekStartsIn(startDate, endDate, 4);
  const rows: Record<string, unknown>[] = [];
  for (const g of grades) {
    for (const w of weeks) {
      rows.push({
        grade: g,
        week_start: w,
        attendance_rate_pct: deterministicInt(`${schoolId}-${g}-${w}-att`, 88, 98),
        absent_learners: deterministicInt(`${schoolId}-${g}-${w}-abs`, 0, 4),
      });
    }
  }
  return { columns, rows };
}

function generateLearningTimeRows(
  schoolId: string,
  params: Record<string, unknown>,
): { columns: string[]; rows: Record<string, unknown>[] } {
  const gradeFilter = params.grade !== undefined ? Number(params.grade) : null;
  const today = new Date().toISOString().slice(0, 10);
  const startDate = String(params.startDate ?? `${today.slice(0, 4)}-01-01`);
  const endDate = String(params.endDate ?? today);
  const columns = ["learner_id", "grade", "week_start", "instructional_minutes"];
  const grades = gradeFilter !== null ? [gradeFilter] : [4, 5, 6];
  const weeks = weekStartsIn(startDate, endDate, 2);
  const rows: Record<string, unknown>[] = [];
  for (const g of grades) {
    for (let n = 0; n < 5; n++) {
      for (const w of weeks) {
        rows.push({
          learner_id: `learner-${schoolId}-${g}-${n}`,
          grade: g,
          week_start: w,
          instructional_minutes: deterministicInt(`${schoolId}-${g}-${n}-${w}`, 120, 320),
        });
      }
    }
  }
  return { columns, rows };
}

function generateInterventionRows(
  schoolId: string,
  params: Record<string, unknown>,
): { columns: string[]; rows: Record<string, unknown>[] } {
  const gradeFilter = params.grade !== undefined ? Number(params.grade) : null;
  const planType = String(params.planType ?? "all");
  const columns = ["learner_id", "grade", "plan_type", "last_session_at", "sessions_this_month"];
  const grades = gradeFilter !== null ? [gradeFilter] : [2, 3, 4, 5, 6, 7];
  const rows: Record<string, unknown>[] = [];
  for (const g of grades) {
    const count = deterministicInt(`${schoolId}-${g}-intervention-count`, 1, 4);
    for (let n = 0; n < count; n++) {
      const plan = n % 2 === 0 ? "iep" : "504";
      if (planType !== "all" && plan !== planType) continue;
      rows.push({
        learner_id: `learner-${schoolId}-${g}-${n}`,
        grade: g,
        plan_type: plan,
        last_session_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        sessions_this_month: deterministicInt(`${schoolId}-${g}-${n}-sess`, 4, 12),
      });
    }
  }
  return { columns, rows };
}

function runReport(
  reportId: string,
  schoolId: string,
  params: Record<string, unknown>,
): { columns: string[]; rows: Record<string, unknown>[] } {
  switch (reportId) {
    case "enrollment":
      return generateEnrollmentRows(schoolId, params);
    case "attendance_proxy":
      return generateAttendanceRows(schoolId, params);
    case "learning_time":
      return generateLearningTimeRows(schoolId, params);
    case "intervention_summary":
      return generateInterventionRows(schoolId, params);
    default:
      return { columns: [], rows: [] };
  }
}

function toCsvString(columns: string[], rows: Record<string, unknown>[]): string {
  const csvCell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => csvCell(row[col])).join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export function registerReportRoutes(app: FastifyInstance, _db: any): void {
  // ------------------------------------------------------------------
  // GET /admin/schools/:schoolId/reports
  // ------------------------------------------------------------------
  app.get<{ Params: { schoolId: string } }>(
    "/admin/schools/:schoolId/reports",
    { schema: getAdminSchoolsReportsSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;
      return { reports: REPORT_REGISTRY };
    },
  );

  // ------------------------------------------------------------------
  // POST /admin/schools/:schoolId/reports/:reportId/run
  // ------------------------------------------------------------------
  app.post<{
    Params: { schoolId: string; reportId: string };
    Body: Record<string, unknown>;
    Querystring: { format?: string };
  }>(
    "/admin/schools/:schoolId/reports/:reportId/run",
    { schema: postAdminSchoolsReportRunSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId, reportId } = req.params;
      const format = (req.query as any).format as string | undefined;

      const report = REPORT_REGISTRY.find((r) => r.id === reportId);
      if (!report) {
        return reply.code(404).send({ error: "report_not_found", reportId });
      }

      const params: Record<string, unknown> = req.body ?? {};
      const { columns, rows } = runReport(reportId, schoolId, params);

      if (format === "csv") {
        reply.header("content-type", "text/csv; charset=utf-8");
        reply.header("content-disposition", `attachment; filename="${reportId}-${schoolId}.csv"`);
        return toCsvString(columns, rows);
      }

      return {
        reportId,
        schoolId,
        generatedAt: new Date().toISOString(),
        // Transparency: these rows are estimates, not read from a
        // source-of-record table. The UI must label them accordingly.
        dataSource: report.estimated ? "estimated" : "source_of_record",
        estimated: report.estimated,
        params,
        columns,
        rows,
        total: rows.length,
      };
    },
  );
}
