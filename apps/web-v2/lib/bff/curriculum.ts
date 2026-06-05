/**
 * Phase 1 (weekly curriculum sync): shared BFF handlers for the parent and
 * teacher "This week at school" surfaces. Both roles get the same behavior;
 * only the role guard + learner-scope check (applied by the route) differ.
 *
 * Endpoints backed here:
 *   GET    list uploads for a learner
 *   POST   parse-preview (no persistence)
 *   POST   upload (persist an active focus + sync future lessons)
 *   DELETE remove an upload
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import type { SessionProfile } from "@/lib/auth/types";
import {
  createCurriculumUpload,
  deleteCurriculumUpload,
  listCurriculumUploadsForLearner,
} from "@/lib/db/repos";
import type { CurriculumUpload } from "@/lib/db/types";
import {
  normalizeSubject,
  parseCurriculumFocus,
  sanitizeEditedFocus,
} from "@/lib/learner/curriculum-parse";

const MAX_TEXT_LEN = 32000;

function uploaderRoleFor(session: SessionProfile): CurriculumUpload["uploaderRole"] {
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

/** GET — list a learner's curriculum uploads. */
export async function handleListCurriculum(
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
    const uploads = await listCurriculumUploadsForLearner(learnerId, session.tenantId, {
      subject: subject ? normalizeSubject(subject) : undefined,
    });
    return ok({ uploads }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** POST — parse a syllabus into a structured focus WITHOUT saving. */
export async function handleParsePreview(
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
      imageBase64?: unknown;
      mimeType?: unknown;
      subject?: unknown;
      weekStart?: unknown;
      weekEnd?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT_LEN) : undefined;
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
    if (!text && !imageBase64) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Provide text or an uploaded file to parse." },
        requestId,
      );
    }
    const result = await parseCurriculumFocus({
      text,
      imageBase64,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : undefined,
      hintedSubject: typeof body.subject === "string" ? body.subject : undefined,
      hintedWeekStart: typeof body.weekStart === "string" ? body.weekStart : undefined,
      hintedWeekEnd: typeof body.weekEnd === "string" ? body.weekEnd : undefined,
    });
    return ok(
      { parsed: result.focus, rawText: result.rawText, usedFallback: result.usedFallback },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** POST — persist an active curriculum focus for a learner. */
export async function handleUpload(
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
      parsedFocus?: unknown;
      weekStart?: unknown;
      weekEnd?: unknown;
      notes?: unknown;
    };
    const subject = normalizeSubject(body.subject);

    // The client always reviews the parsed focus before saving, so a
    // parsedFocus object is required here. (parse-preview produces it.)
    if (!body.parsedFocus || typeof body.parsedFocus !== "object") {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "A reviewed curriculum focus is required." },
        requestId,
      );
    }
    const focus = sanitizeEditedFocus(body.parsedFocus, subject);
    if (focus.topics.length === 0 && !focus.summary.trim()) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "Add at least one topic or a short summary of the week.",
        },
        requestId,
      );
    }

    const sourceType = body.sourceType === "file" ? "file" : "text";
    const upload = await createCurriculumUpload({
      tenantId: session.tenantId,
      learnerId,
      uploadedBy: session.userId,
      uploaderRole: uploaderRoleFor(session),
      subject: focus.subject,
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim().slice(0, 255)
          : focus.title,
      sourceType,
      fileName: typeof body.fileName === "string" ? body.fileName.slice(0, 255) : null,
      rawText: typeof body.text === "string" ? body.text : "",
      parsedFocus: focus,
      weekStart: typeof body.weekStart === "string" ? body.weekStart : focus.weekStart,
      weekEnd: typeof body.weekEnd === "string" ? body.weekEnd : focus.weekEnd,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : null,
    });

    audit(session, "curriculum.upload.create", requestId, {
      learnerId,
      metadata: { uploadId: upload.id, subject: upload.subject },
    });
    return ok({ upload }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** DELETE — remove a learner's curriculum upload. */
export async function handleDeleteCurriculum(
  _req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
  uploadId: string,
): Promise<NextResponse> {
  const scopeErr = await requireLearnerScope(session, learnerId, requestId);
  if (scopeErr) return scopeErr;
  try {
    const removed = await deleteCurriculumUpload(uploadId, session.tenantId);
    if (!removed) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Upload not found." }, requestId);
    }
    audit(session, "curriculum.upload.delete", requestId, {
      learnerId,
      metadata: { uploadId },
    });
    return ok({ ok: true, id: uploadId }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
