/**
 * Wave B — school-calendar + pacing-plan BFF (shared parent/teacher handlers).
 *
 * brain-svc owns the pacing tables (`school_calendars`, `learner_pacing_*`).
 * This module is the server-side client + the role-agnostic handlers behind:
 *
 *   GET/PUT  /api/bff/{parent,teacher}/learners/:learnerId/school-calendar
 *   GET/POST /api/bff/{parent,teacher}/learners/:learnerId/pacing-plan
 *
 * The POST generates a pacing plan from the learner's SAVED term syllabus
 * (source=uploaded_term_syllabus): the BFF rebuilds the parser-shaped
 * term_scope_sequence from the persisted `term_syllabus_units` rows and
 * brain-svc lays it onto the learner's stored calendar, break-aware.
 *
 * Dual-path (ADR 0009): live against brain-svc whenever
 * `INTERNAL_SERVICE_TOKEN` is set (REQUIRED in production — same fail-closed
 * contract as lib/bff/tutor-curriculum.ts). In dev/test without the token the
 * CALENDAR read/write falls back to the in-memory store so the surface stays
 * usable; plan generation has no local fallback (the pacing walk lives in
 * brain-svc) and returns UPSTREAM_UNAVAILABLE with a precise message instead.
 *
 * Browser code MUST NOT import this module (it references the service token).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { fail, failFromUnknown, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import type { SessionProfile } from "@/lib/auth/types";
import { listTermSyllabiForLearner } from "@/lib/db/repos";
import { normalizeSubject } from "@/lib/learner/curriculum-parse";
import type { TermSyllabus } from "@/lib/db/types";
import {
  getStoredSchoolCalendar,
  putStoredSchoolCalendar,
  type SchoolCalendar,
} from "@/lib/db/school-calendar-store";

const IS_PROD = process.env.NODE_ENV === "production";

export function isPacingLive(): boolean {
  return Boolean(serverEnv.INTERNAL_SERVICE_TOKEN);
}

/** Fail closed in production: calendar/pacing must run against brain-svc. */
function assertLiveConfigured(): void {
  if (IS_PROD && !isPacingLive()) {
    throw new Error(
      "school-calendar: INTERNAL_SERVICE_TOKEN must be set in production " +
        "so calendars persist to brain-svc (no in-memory fallback in prod).",
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
  return `${serverEnv.BRAIN_SVC_URL.replace(/\/$/, "")}/api/brain/pacing`;
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS);
}

// ── payload schemas ──────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)");

const termSchema = z.object({
  termNumber: z.number().int().min(1).max(12),
  title: z.string().max(255).nullish(),
  startDate: isoDate,
  endDate: isoDate,
});

const breakSchema = z.object({
  kind: z.enum(["holiday", "break", "summer"]),
  name: z.string().max(255).nullish(),
  startDate: isoDate,
  endDate: isoDate,
});

export const calendarPayloadSchema = z.object({
  name: z.string().max(255).nullish(),
  academicYear: z.string().max(16).nullish(),
  timezone: z.string().max(64).default("America/Chicago"),
  terms: z.array(termSchema).min(1).max(12),
  breaks: z.array(breakSchema).max(40),
});

export type CalendarPayload = z.infer<typeof calendarPayloadSchema>;

const generatePlanSchema = z.object({
  subject: z.string().min(1).max(64),
  planStart: isoDate,
});

// ── brain-svc wire mapping ───────────────────────────────────────────────────

/** Map the BFF camelCase calendar payload onto brain-svc's snake_case body. */
export function toBrainCalendarBody(payload: CalendarPayload): Record<string, unknown> {
  return {
    name: payload.name ?? null,
    academic_year: payload.academicYear ?? null,
    timezone: payload.timezone,
    terms: payload.terms.map((t) => ({
      term_number: t.termNumber,
      title: t.title ?? null,
      start_date: t.startDate,
      end_date: t.endDate,
    })),
    breaks: payload.breaks.map((b) => ({
      kind: b.kind,
      name: b.name ?? null,
      start_date: b.startDate,
      end_date: b.endDate,
    })),
  };
}

/**
 * Rebuild the ai-svc parse-term scope shape from a SAVED term syllabus so
 * brain-svc paces exactly what the parent/teacher reviewed and saved
 * (units grouped by term, ordered; web field names → parser field names).
 */
export function buildTermScopeSequence(syllabus: TermSyllabus): Record<string, unknown> {
  const byTerm = new Map<number, TermSyllabus["units"]>();
  for (const unit of [...syllabus.units].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const bucket = byTerm.get(unit.termNumber) ?? [];
    bucket.push(unit);
    byTerm.set(unit.termNumber, bucket);
  }
  const terms = [...byTerm.entries()]
    .sort(([a], [b]) => a - b)
    .map(([termNumber, units]) => ({
      term_number: termNumber,
      title: null,
      units: units.map((u) => ({
        title: u.title,
        duration_weeks: Math.max(1, u.durationWeeks),
        topics: u.topics,
        learning_objectives: u.objectives,
        standards_addressed: u.standards,
        key_vocabulary: u.vocabulary,
      })),
    }));
  return {
    subject: syllabus.subject,
    source: "uploaded_term_syllabus",
    total_terms: terms.length,
    terms,
  };
}

// ── live service calls ───────────────────────────────────────────────────────

async function svcGetCalendar(learnerId: string): Promise<SchoolCalendar | null> {
  const res = await fetch(`${base()}/${encodeURIComponent(learnerId)}/calendar`, {
    method: "GET",
    headers: headers(),
    signal: timeoutSignal(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`brain-svc calendar read failed (${res.status})`);
  const data = (await res.json()) as { calendar: SchoolCalendar | null };
  return data.calendar ?? null;
}

async function svcPutCalendar(
  learnerId: string,
  payload: CalendarPayload,
): Promise<{ ok: true; calendar: SchoolCalendar | null } | { ok: false; status: number; detail: string }> {
  const res = await fetch(`${base()}/${encodeURIComponent(learnerId)}/calendar`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(toBrainCalendarBody(payload)),
    signal: timeoutSignal(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = `brain-svc calendar save failed (${res.status})`;
    try {
      detail = (JSON.parse(body) as { detail?: string }).detail ?? detail;
    } catch {
      /* keep generic detail */
    }
    return { ok: false, status: res.status, detail };
  }
  const data = (await res.json()) as { calendar: SchoolCalendar | null };
  return { ok: true, calendar: data.calendar ?? null };
}

async function svcGeneratePlan(
  learnerId: string,
  body: { subject: string; planStart: string; termScopeSequence: Record<string, unknown> },
): Promise<
  | { ok: true; plan: Record<string, unknown> }
  | { ok: false; status: number; detail: string }
> {
  const res = await fetch(`${base()}/${encodeURIComponent(learnerId)}/pacing-plan/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      subject: body.subject,
      plan_start: body.planStart,
      source: "uploaded_term_syllabus",
      term_scope_sequence: body.termScopeSequence,
    }),
    signal: timeoutSignal(),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = `brain-svc plan generation failed (${res.status})`;
    try {
      detail = (JSON.parse(raw) as { detail?: string }).detail ?? detail;
    } catch {
      /* keep generic detail */
    }
    return { ok: false, status: res.status, detail };
  }
  return { ok: true, plan: (await res.json()) as Record<string, unknown> };
}

async function svcGetPlan(
  learnerId: string,
  subject: string,
): Promise<{ status: number; plan: Record<string, unknown> | null }> {
  const res = await fetch(
    `${base()}/${encodeURIComponent(learnerId)}/pacing/plan?subject=${encodeURIComponent(subject)}`,
    { method: "GET", headers: headers(), signal: timeoutSignal(), cache: "no-store" },
  );
  if (res.status === 404) return { status: 404, plan: null };
  if (!res.ok) throw new Error(`brain-svc plan read failed (${res.status})`);
  return { status: 200, plan: (await res.json()) as Record<string, unknown> };
}

// ── handlers (role guard applied by the route files) ─────────────────────────

export async function handleGetSchoolCalendar(
  _req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  try {
    assertLiveConfigured();
    const calendar = isPacingLive()
      ? await svcGetCalendar(learnerId)
      : getStoredSchoolCalendar(session.tenantId, learnerId);
    return ok({ calendar, live: isPacingLive() }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function handlePutSchoolCalendar(
  req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  const json = await req.json().catch(() => ({}));
  const parsed = calendarPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }
  try {
    assertLiveConfigured();
    let calendar: SchoolCalendar | null;
    if (isPacingLive()) {
      const result = await svcPutCalendar(learnerId, parsed.data);
      if (!result.ok) {
        // brain-svc 422 = the pure validator rejected the dates — surface
        // its message verbatim so the parent can fix the row.
        const errBase = result.status === 422 ? ERRORS.VALIDATION_FAILED : ERRORS.UPSTREAM_UNAVAILABLE;
        return fail({ ...errBase, message: result.detail }, requestId);
      }
      calendar = result.calendar;
    } else {
      calendar = putStoredSchoolCalendar(session.tenantId, learnerId, {
        name: parsed.data.name ?? null,
        academicYear: parsed.data.academicYear ?? null,
        timezone: parsed.data.timezone,
        terms: parsed.data.terms.map((t) => ({ ...t, title: t.title ?? null })),
        breaks: parsed.data.breaks.map((b) => ({ ...b, name: b.name ?? null })),
      });
    }
    audit(session, "school_calendar.saved", requestId, {
      learnerId,
      metadata: {
        terms: parsed.data.terms.length,
        breaks: parsed.data.breaks.length,
        live: isPacingLive(),
      },
    });
    return ok({ calendar, live: isPacingLive() }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function handleGetPacingPlan(
  req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  const url = new URL(req.url);
  const subject = (url.searchParams.get("subject") ?? "").trim();
  if (!subject) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: "subject is required" }, requestId);
  }
  try {
    assertLiveConfigured();
    if (!isPacingLive()) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message:
            "Pacing runs in brain-svc; set INTERNAL_SERVICE_TOKEN (and run brain-svc) to read plans in this environment.",
        },
        requestId,
      );
    }
    const { status, plan } = await svcGetPlan(learnerId, subject);
    if (status === 404) return ok({ plan: null }, requestId);
    return ok({ plan }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function handleGeneratePacingPlan(
  req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  const json = await req.json().catch(() => ({}));
  const parsed = generatePlanSchema.safeParse(json);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }
  try {
    assertLiveConfigured();
    if (!isPacingLive()) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message:
            "Pacing runs in brain-svc; set INTERNAL_SERVICE_TOKEN (and run brain-svc) to generate plans in this environment.",
        },
        requestId,
      );
    }

    // The plan paces what was SAVED — the latest term syllabus for the subject.
    const syllabi = await listTermSyllabiForLearner(learnerId, session.tenantId, {
      subject: normalizeSubject(parsed.data.subject),
    });
    const syllabus = syllabi[0];
    if (!syllabus || syllabus.units.length === 0) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: "Save a term syllabus for this subject first — the plan paces the saved units.",
        },
        requestId,
      );
    }

    const result = await svcGeneratePlan(learnerId, {
      subject: parsed.data.subject,
      planStart: parsed.data.planStart,
      termScopeSequence: buildTermScopeSequence(syllabus),
    });
    if (!result.ok) {
      const errBase = result.status === 422 ? ERRORS.VALIDATION_FAILED : ERRORS.UPSTREAM_UNAVAILABLE;
      return fail({ ...errBase, message: result.detail }, requestId);
    }
    audit(session, "pacing_plan.generated", requestId, {
      learnerId,
      metadata: {
        subject: parsed.data.subject,
        planStart: parsed.data.planStart,
        syllabusId: syllabus.id,
        weekCount: (result.plan as { weekCount?: number }).weekCount ?? null,
      },
    });
    logger.info(
      {
        event: "pacing_plan.generated",
        learnerId,
        subject: parsed.data.subject,
        syllabusId: syllabus.id,
      },
      "[school-calendar] pacing plan generated from saved term syllabus",
    );
    return ok({ plan: result.plan }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
