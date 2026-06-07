/**
 * Whole-term / trimester syllabus BFF (Sprint 6, G7). Shared handlers for the
 * parent and teacher "upload a full-term syllabus" surface. Both roles get the
 * same behaviour; the route applies the role guard + learner-scope check.
 *
 * Endpoints backed here:
 *   GET    list a learner's saved term syllabi
 *   POST   parse-preview (calls ai-svc /parse-term, no persistence)
 *   POST   save (persist the reviewed term + its ordered units)
 *   DELETE remove a saved term syllabus
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import type { SessionProfile } from "@/lib/auth/types";
import {
  createTermSyllabus,
  deleteTermSyllabus,
  listTermSyllabiForLearner,
} from "@/lib/db/repos";
import { normalizeSubject } from "@/lib/learner/curriculum-parse";
import {
  flattenToUnits,
  requestTermParse,
  summarizeTerm,
  validateTermParse,
  type TermParseResult,
} from "@/lib/learner/term-syllabus";

// Term documents are whole-term/trimester (12+ weeks); allow large input.
// ai-svc chunks it — there is no 16/32 KB cap on the term path.
const MAX_TERM_TEXT_LEN = 500_000;

function uploaderRoleFor(session: SessionProfile): string {
  switch (session.role) {
    case "teacher":
      return "teacher";
    case "caregiver":
      return "caregiver";
    case "school_admin":
      return "school_admin";
    case "district_admin":
      return "district_admin";
    default:
      return "parent";
  }
}

function clampTermCount(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(1, Math.trunc(n)));
}

/** GET — list a learner's saved term syllabi. */
export async function handleListTermSyllabi(
  req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  try {
    const url = new URL(req.url);
    const subject = url.searchParams.get("subject") ?? undefined;
    const syllabi = await listTermSyllabiForLearner(learnerId, session.tenantId, {
      subject: subject ? normalizeSubject(subject) : undefined,
    });
    return ok({ syllabi }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** POST — parse a full-term syllabus into an ordered scope WITHOUT saving. */
export async function handleParseTermPreview(
  req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      text?: unknown;
      subject?: unknown;
      termCount?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.slice(0, MAX_TERM_TEXT_LEN) : "";
    if (!text.trim()) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Provide the syllabus text to parse." },
        requestId,
      );
    }
    const subject = typeof body.subject === "string" ? normalizeSubject(body.subject) : undefined;
    const parsed = await requestTermParse({
      text,
      subject,
      termCount: clampTermCount(body.termCount),
    });
    const errors = validateTermParse(parsed);
    if (errors.length > 0) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: errors.join(" ") }, requestId);
    }
    return ok({ parsed, summary: summarizeTerm(parsed) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** POST — persist a reviewed term syllabus + its ordered units. */
export async function handleSaveTermSyllabus(
  req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      subject?: unknown;
      title?: unknown;
      text?: unknown;
      fileName?: unknown;
      sourceType?: unknown;
      parsed?: unknown;
      notes?: unknown;
    };
    if (!body.parsed || typeof body.parsed !== "object") {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "A reviewed term parse is required." },
        requestId,
      );
    }
    const parsed = body.parsed as TermParseResult;
    const errors = validateTermParse(parsed);
    if (errors.length > 0) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: errors.join(" ") }, requestId);
    }
    const units = flattenToUnits(parsed);
    const subject = normalizeSubject(body.subject ?? parsed.subject ?? "other");
    const sourceType = body.sourceType === "file" ? "file" : "text";

    const syllabus = await createTermSyllabus({
      tenantId: session.tenantId,
      learnerId,
      uploadedBy: session.userId,
      uploaderRole: uploaderRoleFor(session),
      subject,
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim().slice(0, 255)
          : `${subject} term syllabus`,
      termCount: parsed.total_terms ?? 1,
      sourceType,
      fileName: typeof body.fileName === "string" ? body.fileName.slice(0, 255) : null,
      rawText: typeof body.text === "string" ? body.text.slice(0, MAX_TERM_TEXT_LEN) : null,
      units,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : null,
    });

    audit(session, "term_syllabus.save", requestId, {
      learnerId,
      metadata: { syllabusId: syllabus.id, subject, units: units.length },
    });
    return ok({ syllabus }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** DELETE — remove a learner's saved term syllabus. */
export async function handleDeleteTermSyllabus(
  _req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
  syllabusId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  try {
    const removed = await deleteTermSyllabus(syllabusId, session.tenantId);
    if (!removed) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Term syllabus not found." }, requestId);
    }
    audit(session, "term_syllabus.delete", requestId, {
      learnerId,
      metadata: { syllabusId },
    });
    return ok({ ok: true, id: syllabusId }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
