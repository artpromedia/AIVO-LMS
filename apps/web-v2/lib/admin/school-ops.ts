/**
 * School-admin data layer for Sprint 6 (School Admin Functional Parity Pack).
 *
 * Self-contained, in-memory, lazily-seeded singleton — same pattern as
 * `lib/billing/district-pool.ts` and `lib/compliance/governance-store.ts`.
 * Layered on top of the existing mock repo WITHOUT touching `lib/db/repos.ts`.
 *
 * Exports:
 *  - Classrooms: listClassroomsFor, getClassroom, createClassroom, updateClassroom,
 *    deleteClassroom, updateRoster
 *  - Import jobs: createImportJob, getImportJob, listImportJobs
 *  - Reports: REPORT_CATALOG, runReport, reportToCsv
 *  - Notifications: getNotificationMatrix, setNotificationMatrix
 */

import { validateCsv, dryRunDiff, type ValidationResult } from "@aivo/learner-import";

// ── Helpers ──────────────────────────────────────────────────────────────────

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type GradeBand =
  | "K"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12";

export interface Classroom {
  id: string;
  schoolId: string;
  name: string;
  grade: GradeBand;
  teacherId: string;
  learnerIds: string[];
  coTeacherIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type ImportJobStatus =
  | "queued"
  | "validating"
  | "dry_run"
  | "running"
  | "completed"
  | "failed";

export interface ImportJob {
  id: string;
  schoolId: string;
  status: ImportJobStatus;
  dryRun: boolean;
  /** 0-100 */
  progress: number;
  /** Result of validateCsv */
  validation: ValidationResult | null;
  /** dry-run diff counts */
  dryRunAdds: number;
  dryRunUpdates: number;
  /** committed counts */
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCatalogEntry {
  id: string;
  name: string;
  description: string;
  params: Array<{
    name: string;
    type: "date" | "string" | "select";
    label: string;
    options?: string[];
  }>;
}

export interface ReportResult {
  reportId: string;
  schoolId: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  generatedAt: string;
}

export type StaffRole = "teacher" | "counselor" | "school_admin";
export type EventType =
  | "learner_added"
  | "import_completed"
  | "intervention_flagged"
  | "weekly_summary";

/** matrix[event][role] = boolean */
export type NotificationMatrix = Record<EventType, Record<StaffRole, boolean>>;

// ── State ─────────────────────────────────────────────────────────────────────

const classrooms = new Map<string, Classroom>();
const importJobs = new Map<string, ImportJob>();
const notificationMatrices = new Map<string, NotificationMatrix>();
let seeded = false;

// ── Seed ──────────────────────────────────────────────────────────────────────

const DEMO_SCHOOL_ID = "t_school_demo";
const DEMO_TEACHER_IDS = ["u_teacher_1", "u_teacher_2", "u_teacher_3"];
const DEMO_LEARNER_IDS = [
  "lrn_demo_sky",
  "lrn_demo_rio",
  "lrn_demo_ada",
  "lrn_demo_kai",
  "lrn_demo_zoe",
  "lrn_demo_max",
];

function seed(): void {
  if (seeded) return;
  seeded = true;

  const seedClassrooms: Array<Omit<Classroom, "id" | "createdAt" | "updatedAt">> = [
    {
      schoolId: DEMO_SCHOOL_ID,
      name: "Ms. Rivera — Grade 4 (Section A)",
      grade: "4",
      teacherId: DEMO_TEACHER_IDS[0],
      learnerIds: [DEMO_LEARNER_IDS[0], DEMO_LEARNER_IDS[1]],
      coTeacherIds: [],
    },
    {
      schoolId: DEMO_SCHOOL_ID,
      name: "Mr. Patel — Kindergarten",
      grade: "K",
      teacherId: DEMO_TEACHER_IDS[1],
      learnerIds: [DEMO_LEARNER_IDS[2], DEMO_LEARNER_IDS[3], DEMO_LEARNER_IDS[4]],
      coTeacherIds: [DEMO_TEACHER_IDS[2]],
    },
    {
      schoolId: DEMO_SCHOOL_ID,
      name: "Ms. Chen — Grade 7 (Math Intervention)",
      grade: "7",
      teacherId: DEMO_TEACHER_IDS[2],
      learnerIds: [DEMO_LEARNER_IDS[5]],
      coTeacherIds: [],
    },
  ];

  for (const c of seedClassrooms) {
    const id = newId("cls");
    classrooms.set(id, { ...c, id, createdAt: nowIso(), updatedAt: nowIso() });
  }
}

// ── Classroom APIs ────────────────────────────────────────────────────────────

export function listClassroomsFor(
  schoolId: string,
  filter?: { grade?: GradeBand; teacherId?: string },
): Classroom[] {
  seed();
  return Array.from(classrooms.values())
    .filter((c) => c.schoolId === schoolId)
    .filter((c) => (filter?.grade ? c.grade === filter.grade : true))
    .filter((c) => (filter?.teacherId ? c.teacherId === filter.teacherId : true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getClassroom(id: string): Classroom | null {
  seed();
  return classrooms.get(id) ?? null;
}

export function createClassroom(input: {
  schoolId: string;
  name: string;
  grade: GradeBand;
  teacherId: string;
}): Classroom {
  seed();
  const c: Classroom = {
    id: newId("cls"),
    schoolId: input.schoolId,
    name: input.name,
    grade: input.grade,
    teacherId: input.teacherId,
    learnerIds: [],
    coTeacherIds: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  classrooms.set(c.id, c);
  return c;
}

export function updateClassroom(
  id: string,
  patch: Partial<Pick<Classroom, "name" | "grade" | "teacherId">>,
): Classroom | null {
  seed();
  const c = classrooms.get(id);
  if (!c) return null;
  const updated = { ...c, ...patch, updatedAt: nowIso() };
  classrooms.set(id, updated);
  return updated;
}

export function deleteClassroom(id: string): boolean {
  seed();
  return classrooms.delete(id);
}

export function updateRoster(
  id: string,
  changes: {
    addLearnerIds?: string[];
    removeLearnerIds?: string[];
    addCoTeacherIds?: string[];
    removeCoTeacherIds?: string[];
  },
): Classroom | null {
  seed();
  const c = classrooms.get(id);
  if (!c) return null;

  let learnerIds = [...c.learnerIds];
  let coTeacherIds = [...c.coTeacherIds];

  if (changes.addLearnerIds) {
    for (const lid of changes.addLearnerIds) {
      if (!learnerIds.includes(lid)) learnerIds.push(lid);
    }
  }
  if (changes.removeLearnerIds) {
    const rem = new Set(changes.removeLearnerIds);
    learnerIds = learnerIds.filter((l) => !rem.has(l));
  }
  if (changes.addCoTeacherIds) {
    for (const tid of changes.addCoTeacherIds) {
      if (!coTeacherIds.includes(tid)) coTeacherIds.push(tid);
    }
  }
  if (changes.removeCoTeacherIds) {
    const rem = new Set(changes.removeCoTeacherIds);
    coTeacherIds = coTeacherIds.filter((t) => !rem.has(t));
  }

  const updated: Classroom = { ...c, learnerIds, coTeacherIds, updatedAt: nowIso() };
  classrooms.set(id, updated);
  return updated;
}

// ── Import Job APIs ──────────────────────────────────────────────────────────

const EXISTING_EXTERNAL_IDS = new Set(["S0001", "S0002", "S0003"]);

export function createImportJob(input: {
  schoolId: string;
  csvText: string;
  dryRun: boolean;
}): ImportJob {
  const validation = validateCsv(input.csvText);
  const diff = dryRunDiff(validation.valid, EXISTING_EXTERNAL_IDS);

  const job: ImportJob = {
    id: newId("impjob"),
    schoolId: input.schoolId,
    status: input.dryRun ? "dry_run" : "queued",
    dryRun: input.dryRun,
    progress: input.dryRun ? 100 : 0,
    validation,
    dryRunAdds: diff.adds,
    dryRunUpdates: diff.updates,
    createdRows: 0,
    updatedRows: 0,
    skippedRows: 0,
    errorRows: validation.summary.errorRows,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  importJobs.set(job.id, job);

  // Simulate async chunked progress for non-dry-run jobs
  if (!input.dryRun && validation.valid.length > 0) {
    void simulateJobProgress(job.id, validation.valid.length, diff.adds, diff.updates);
  } else if (!input.dryRun) {
    job.status = "completed";
    job.progress = 100;
    importJobs.set(job.id, { ...job });
  }

  return { ...job };
}

async function simulateJobProgress(
  jobId: string,
  totalValid: number,
  adds: number,
  updates: number,
): Promise<void> {
  const job = importJobs.get(jobId);
  if (!job) return;

  importJobs.set(jobId, { ...job, status: "running", progress: 5, updatedAt: nowIso() });

  // Simulate 3 chunks of progress
  const steps = [25, 55, 80, 100];
  for (const pct of steps) {
    await new Promise<void>((res) => setTimeout(res, 200));
    const current = importJobs.get(jobId);
    if (!current) return;
    const isDone = pct === 100;
    importJobs.set(jobId, {
      ...current,
      progress: pct,
      status: isDone ? "completed" : "running",
      createdRows: isDone ? adds : Math.floor((pct / 100) * adds),
      updatedRows: isDone ? updates : Math.floor((pct / 100) * updates),
      skippedRows: isDone ? totalValid - adds - updates : 0,
      updatedAt: nowIso(),
    });
  }
}

export function getImportJob(jobId: string): ImportJob | null {
  return importJobs.get(jobId) ?? null;
}

export function listImportJobs(schoolId: string): ImportJob[] {
  return Array.from(importJobs.values())
    .filter((j) => j.schoolId === schoolId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Report Catalog ────────────────────────────────────────────────────────────

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    id: "enrollment",
    name: "Enrollment Report",
    description: "Active learners per grade, with consent and IEP flag counts.",
    params: [{ name: "asOf", type: "date", label: "As of date" }],
  },
  {
    id: "attendance_proxy",
    name: "Attendance Proxy",
    description: "Login-based attendance proxy: sessions per learner per week.",
    params: [
      { name: "from", type: "date", label: "From date" },
      { name: "to", type: "date", label: "To date" },
    ],
  },
  {
    id: "learning_time",
    name: "Learning Time",
    description: "Total minutes on-platform per learner, per subject.",
    params: [
      { name: "from", type: "date", label: "From date" },
      { name: "to", type: "date", label: "To date" },
      {
        name: "groupBy",
        type: "select",
        label: "Group by",
        options: ["learner", "grade", "classroom"],
      },
    ],
  },
  {
    id: "intervention_summary",
    name: "Intervention Summary",
    description: "Learners with active IEP or 504 flags, plus AI-tutor escalations.",
    params: [{ name: "from", type: "date", label: "From date" }],
  },
];

// ── Report Runner ─────────────────────────────────────────────────────────────

function deterministicRows(
  reportId: string,
  schoolId: string,
  count: number,
): Array<Record<string, string | number>> {
  const seed = hashInt(`${reportId}:${schoolId}`);
  const rows: Array<Record<string, string | number>> = [];
  const grades = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];
  const subjects = ["Math", "Reading", "Science", "Writing"];

  for (let i = 0; i < count; i++) {
    const h = hashInt(`${seed}:${i}`);
    if (reportId === "enrollment") {
      rows.push({
        grade: grades[h % grades.length],
        learner_count: 15 + (h % 20),
        consent_complete: 12 + (h % 16),
        iep_count: h % 5,
        flag_504: h % 3,
      });
    } else if (reportId === "attendance_proxy") {
      rows.push({
        learner_id: `S${String(1000 + i).padStart(4, "0")}`,
        learner_name: `Learner ${i + 1}`,
        grade: grades[h % grades.length],
        sessions_week1: 2 + (h % 5),
        sessions_week2: 1 + (h % 6),
        sessions_week3: 3 + (h % 4),
        sessions_week4: 2 + (h % 5),
      });
    } else if (reportId === "learning_time") {
      rows.push({
        learner_id: `S${String(1000 + i).padStart(4, "0")}`,
        subject: subjects[h % subjects.length],
        total_minutes: 30 + (h % 120),
        lessons_completed: 2 + (h % 10),
        avg_score_pct: 60 + (h % 40),
      });
    } else {
      // intervention_summary
      rows.push({
        learner_id: `S${String(1000 + i).padStart(4, "0")}`,
        learner_name: `Learner ${i + 1}`,
        grade: grades[h % grades.length],
        has_iep: h % 3 === 0 ? "Yes" : "No",
        has_504: h % 5 === 0 ? "Yes" : "No",
        ai_escalations: h % 4,
        last_session: `2026-05-${String(1 + (h % 28)).padStart(2, "0")}`,
      });
    }
  }
  return rows;
}

function columnsFor(reportId: string): string[] {
  switch (reportId) {
    case "enrollment":
      return ["grade", "learner_count", "consent_complete", "iep_count", "flag_504"];
    case "attendance_proxy":
      return [
        "learner_id",
        "learner_name",
        "grade",
        "sessions_week1",
        "sessions_week2",
        "sessions_week3",
        "sessions_week4",
      ];
    case "learning_time":
      return ["learner_id", "subject", "total_minutes", "lessons_completed", "avg_score_pct"];
    case "intervention_summary":
      return [
        "learner_id",
        "learner_name",
        "grade",
        "has_iep",
        "has_504",
        "ai_escalations",
        "last_session",
      ];
    default:
      return [];
  }
}

export function runReport(
  reportId: string,
  schoolId: string,
  _params: Record<string, string> = {},
): ReportResult {
  const catalog = REPORT_CATALOG.find((r) => r.id === reportId);
  if (!catalog) throw new Error(`Unknown report: ${reportId}`);

  const count = reportId === "enrollment" ? 9 : 20;
  return {
    reportId,
    schoolId,
    columns: columnsFor(reportId),
    rows: deterministicRows(reportId, schoolId, count),
    generatedAt: nowIso(),
  };
}

export function reportToCsv(result: ReportResult): string {
  const escape = (v: string | number): string => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines: string[] = [result.columns.map(escape).join(",")];
  for (const row of result.rows) {
    lines.push(result.columns.map((c) => escape(row[c] ?? "")).join(","));
  }
  return lines.join("\r\n");
}

// ── Notification Matrix ───────────────────────────────────────────────────────

const DEFAULT_MATRIX: NotificationMatrix = {
  learner_added: { teacher: true, counselor: false, school_admin: true },
  import_completed: { teacher: false, counselor: false, school_admin: true },
  intervention_flagged: { teacher: true, counselor: true, school_admin: true },
  weekly_summary: { teacher: true, counselor: true, school_admin: true },
};

export function getNotificationMatrix(schoolId: string): NotificationMatrix {
  return notificationMatrices.get(schoolId) ?? JSON.parse(JSON.stringify(DEFAULT_MATRIX));
}

export function setNotificationMatrix(
  schoolId: string,
  matrix: NotificationMatrix,
): NotificationMatrix {
  notificationMatrices.set(schoolId, matrix);
  return matrix;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  learner_added: "Learner added",
  import_completed: "Import completed",
  intervention_flagged: "Intervention flagged",
  weekly_summary: "Weekly summary",
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  teacher: "Teacher",
  counselor: "Counselor",
  school_admin: "School admin",
};

export const ALL_EVENT_TYPES: EventType[] = [
  "learner_added",
  "import_completed",
  "intervention_flagged",
  "weekly_summary",
];

export const ALL_STAFF_ROLES: StaffRole[] = ["teacher", "counselor", "school_admin"];
