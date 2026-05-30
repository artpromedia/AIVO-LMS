/**
 * Weekly curriculum sync — LIVE data path.
 *
 * tutor-svc owns the shared `curriculum_uploads` Postgres table. This module
 * is the web-v2 server-side client for it: every parent/teacher upload, list,
 * delete, and the lesson-generation focus read go through tutor-svc so web-v2
 * and tutor-svc share a single source of truth. The web-v2 BFF has already
 * enforced session + role + learner-scope before calling these, so we
 * authenticate as a trusted service via the shared `INTERNAL_SERVICE_TOKEN`
 * (`x-service-token`); tutor-svc resolves the learner's tenant itself.
 *
 * Browser code MUST NOT import this module (it references the service token).
 *
 * Configuration:
 *   - Live when `INTERNAL_SERVICE_TOKEN` is set (production REQUIRES it).
 *   - In dev/test without the token, `isLiveCurriculum()` is false and callers
 *     fall back to the in-memory store. There is NO mock path in production:
 *     `assertLiveConfigured()` throws if prod is misconfigured.
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import type { CurriculumFocus, CurriculumUpload } from "@/lib/db/types";

const IS_PROD = process.env.NODE_ENV === "production";

export function isLiveCurriculum(): boolean {
  return Boolean(serverEnv.INTERNAL_SERVICE_TOKEN);
}

/** Fail closed in production: a live data path must be configured. */
export function assertLiveConfigured(): void {
  if (IS_PROD && !isLiveCurriculum()) {
    throw new Error(
      "weekly curriculum sync: INTERNAL_SERVICE_TOKEN must be set in production " +
        "so uploads persist to tutor-svc (no in-memory fallback in prod).",
    );
  }
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-service-token": serverEnv.INTERNAL_SERVICE_TOKEN ?? "",
  };
}

function base(): string {
  return serverEnv.TUTOR_SVC_URL.replace(/\/$/, "");
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS);
}

// ---- response shape mapping -------------------------------------------------
// tutor-svc stores status/uploaderRole uppercase ("ACTIVE"/"PARENT"); normalize
// to web-v2's lowercase enums on read.

function normStatus(v: unknown): CurriculumUpload["status"] {
  return String(v ?? "active").toLowerCase() === "archived" ? "archived" : "active";
}
function normRole(v: unknown): CurriculumUpload["uploaderRole"] {
  const s = String(v ?? "parent").toLowerCase();
  return s === "teacher" ||
    s === "caregiver" ||
    s === "school_admin" ||
    s === "district_admin"
    ? (s as CurriculumUpload["uploaderRole"])
    : "parent";
}
function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function focusFrom(raw: unknown, subject: string): CurriculumFocus {
  const f = (raw ?? {}) as Partial<CurriculumFocus>;
  return {
    title: typeof f.title === "string" ? f.title : "This week's lessons",
    subject: typeof f.subject === "string" ? f.subject : subject,
    weekStart: typeof f.weekStart === "string" ? f.weekStart : null,
    weekEnd: typeof f.weekEnd === "string" ? f.weekEnd : null,
    topics: Array.isArray(f.topics) ? f.topics.map(String) : [],
    keywords: Array.isArray(f.keywords) ? f.keywords.map(String) : [],
    standards: Array.isArray(f.standards) ? f.standards.map(String) : [],
    skills: Array.isArray(f.skills) ? f.skills.map(String) : [],
    summary: typeof f.summary === "string" ? f.summary : "",
    confidence: typeof f.confidence === "number" ? f.confidence : 0,
  };
}
function uploadFrom(row: Record<string, unknown>): CurriculumUpload {
  const subject = String(row.subject ?? "other");
  return {
    id: String(row.id),
    tenantId: String(row.tenantId ?? ""),
    learnerId: String(row.learnerId ?? ""),
    uploadedBy: String(row.uploadedBy ?? ""),
    uploaderRole: normRole(row.uploaderRole),
    subject,
    title: typeof row.title === "string" ? row.title : "This week's lessons",
    sourceType: row.sourceType === "file" ? "file" : "text",
    fileName: typeof row.fileName === "string" ? row.fileName : null,
    rawText: typeof row.rawText === "string" ? row.rawText : "",
    parsedFocus: focusFrom(row.parsedFocus, subject),
    weekStart: isoOrNull(row.weekStart),
    weekEnd: isoOrNull(row.weekEnd),
    status: normStatus(row.status),
    notes: typeof row.notes === "string" ? row.notes : null,
    createdAt: isoOrNull(row.createdAt) ?? new Date().toISOString(),
    updatedAt: isoOrNull(row.updatedAt) ?? new Date().toISOString(),
  };
}

// ---- operations -------------------------------------------------------------

export async function tutorListCurriculum(
  learnerId: string,
  opts?: { subject?: string; status?: CurriculumUpload["status"] },
): Promise<CurriculumUpload[]> {
  const params = new URLSearchParams();
  if (opts?.subject) params.set("subject", opts.subject);
  if (opts?.status) params.set("status", opts.status.toUpperCase());
  const res = await fetch(
    `${base()}/api/tutors/curriculum/learner/${encodeURIComponent(learnerId)}?${params}`,
    { headers: headers(), signal: timeoutSignal() },
  );
  if (!res.ok) throw new Error(`tutor-svc list curriculum failed (${res.status})`);
  const data = (await res.json()) as { uploads?: Record<string, unknown>[] };
  return (data.uploads ?? []).map(uploadFrom);
}

export async function tutorActiveFocus(
  learnerId: string,
  subject?: string,
): Promise<CurriculumFocus | null> {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  const res = await fetch(
    `${base()}/api/tutors/curriculum/learner/${encodeURIComponent(learnerId)}/active?${params}`,
    { headers: headers(), signal: timeoutSignal() },
  );
  if (!res.ok) throw new Error(`tutor-svc active focus failed (${res.status})`);
  const data = (await res.json()) as { focus?: Record<string, unknown> | null };
  return data.focus ? focusFrom(data.focus, subject ?? "other") : null;
}

export async function tutorCreateCurriculum(input: {
  learnerId: string;
  subject: string;
  title: string;
  rawText: string;
  sourceType: CurriculumUpload["sourceType"];
  fileName: string | null;
  parsedFocus: CurriculumFocus;
  weekStart: string | null;
  weekEnd: string | null;
  notes: string | null;
}): Promise<CurriculumUpload> {
  const res = await fetch(`${base()}/api/tutors/curriculum/upload`, {
    method: "POST",
    headers: headers(),
    signal: timeoutSignal(),
    body: JSON.stringify({
      learnerId: input.learnerId,
      subject: input.subject,
      title: input.title,
      text: input.rawText || undefined,
      sourceType: input.sourceType,
      fileName: input.fileName,
      parsedFocus: input.parsedFocus,
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
      notes: input.notes,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`tutor-svc create curriculum failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { uploads?: Record<string, unknown>[] };
  const row = data.uploads?.[0];
  if (!row) throw new Error("tutor-svc create curriculum returned no row");
  return uploadFrom(row);
}

export async function tutorDeleteCurriculum(uploadId: string): Promise<boolean> {
  const res = await fetch(`${base()}/api/tutors/curriculum/${encodeURIComponent(uploadId)}`, {
    method: "DELETE",
    headers: headers(),
    signal: timeoutSignal(),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`tutor-svc delete curriculum failed (${res.status})`);
  return true;
}

/** Best-effort focus read for lesson generation — never throws (logs + null). */
export async function tutorActiveFocusSafe(
  learnerId: string,
  subject?: string,
): Promise<CurriculumFocus | null> {
  try {
    return await tutorActiveFocus(learnerId, subject);
  } catch (err) {
    logger.warn(
      { feature: "weekly-curriculum", learnerId, err: err instanceof Error ? err.message : String(err) },
      "[tutor-curriculum] active focus read failed — generating without school sync",
    );
    return null;
  }
}
