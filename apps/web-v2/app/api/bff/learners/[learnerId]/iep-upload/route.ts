import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import {
  deleteIEPForLearner,
  getIEPForLearner,
  refreshLearnerReadiness,
  uploadIEPDocument,
  logIepAccess,
} from "@/lib/db/repos";
import { IEP_ALLOWED_MIME_TYPES, IEP_MAX_BYTES, iepUploadMetaSchema } from "@/lib/validators/iep";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["iep_document_storage", "child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    const doc = await getIEPForLearner(learnerId, session!.tenantId);
    if (doc) {
      logIepAccess({
        tenantId: session!.tenantId,
        learnerId,
        documentId: doc.id,
        accessedByUserId: session!.userId,
        purpose: "view_summary",
      });
    }
    return ok({ document: doc }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["iep_document_storage", "child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    // Multipart-only: the route derives metadata from the actual file stream
    // so a client can't claim "I have a 10 MB IEP" without sending the bytes.
    // In v2 the file bytes are not persisted, but the metadata MUST come from
    // a real upload, never from a JSON body. This closes a state-mismatch
    // hole the architect flagged.
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "Upload must be multipart/form-data with a 'file' field.",
        },
        requestId,
      );
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Missing or empty 'file' field" },
        requestId,
      );
    }
    const v = iepUploadMetaSchema.safeParse({
      fileName: file.name,
      mimeType: file.type,
      bytes: file.size,
    });
    if (!v.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: `File must be ${IEP_ALLOWED_MIME_TYPES.join(", ")} and under ${
            IEP_MAX_BYTES / (1024 * 1024)
          } MiB.`,
        },
        requestId,
      );
    }
    const doc = await uploadIEPDocument({
      learnerId,
      tenantId: session!.tenantId,
      ...v.data,
    });
    refreshLearnerReadiness(learnerId, session!.tenantId);
    // The upload path is the moment raw IEP bytes pass through the server;
    // log it as view_raw to keep the FERPA access trail complete (extract
    // and view_summary are logged from their own routes).
    logIepAccess({
      tenantId: session!.tenantId,
      learnerId,
      documentId: doc.id,
      accessedByUserId: session!.userId,
      purpose: "view_raw",
    });
    audit(session, "iep.upload", requestId, {
      learnerId,
      metadata: { fileName: doc.fileName, bytes: doc.bytes },
    });
    return ok({ document: doc }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["iep_document_storage", "child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    const existing = await getIEPForLearner(learnerId, session!.tenantId);
    const removed = await deleteIEPForLearner(learnerId, session!.tenantId);
    if (!removed) {
      return fail({ ...ERRORS.NOT_FOUND, message: "No IEP on file" }, requestId);
    }
    refreshLearnerReadiness(learnerId, session!.tenantId);
    if (existing) {
      logIepAccess({
        tenantId: session!.tenantId,
        learnerId,
        documentId: existing.id,
        accessedByUserId: session!.userId,
        purpose: "delete",
      });
    }
    audit(session, "iep.delete", requestId, { learnerId });
    return ok({ deleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
