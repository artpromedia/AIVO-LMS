import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import {
  AssessmentShell,
  QuestionCard,
  AssessmentFooter,
  ASSESSMENT_BACK_CLASS,
  UploadDropZone,
  UploadFileCard,
  ReassuranceCard,
} from "@aivo/ui";
import { Button } from "@/components/ui/button";
import {
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
  recordIEPSkip,
  refreshLearnerReadiness,
  setIEPExtraction,
  uploadIEPDocument,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { IEP_ALLOWED_MIME_TYPES, IEP_MAX_BYTES, iepUploadMetaSchema } from "@/lib/validators/iep";
import { buildIEPExtraction } from "@/lib/learner/iep";

/* ----- server actions ------------------------------------------------------ */

async function uploadAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/parent/learners/${learnerId}/iep?error=missing_file`);
  }
  const f = file as File;
  const meta = iepUploadMetaSchema.safeParse({
    fileName: f.name,
    mimeType: f.type,
    bytes: f.size,
  });
  if (!meta.success) {
    redirect(`/parent/learners/${learnerId}/iep?error=invalid_file`);
  }
  await uploadIEPDocument({
    learnerId,
    tenantId: session.tenantId,
    ...meta.data,
  });
  audit(session, "iep.upload", newRequestId(), {
    learnerId,
    metadata: { fileName: meta.data.fileName, bytes: meta.data.bytes, source: "ui" },
  });
  // Kick off the synthesized extraction so the review step always has a populated card.
  const learner = await getLearner(learnerId, session.tenantId);
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  if (learner) {
    const extraction = buildIEPExtraction({
      learner,
      assessment,
      hasUploadedDocument: true,
    });
    await setIEPExtraction(learnerId, session.tenantId, extraction);
  }
  await refreshLearnerReadiness(learnerId, session.tenantId);
  redirect(`/parent/learners/${learnerId}/iep/review`);
}

async function skipAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  await recordIEPSkip(learnerId, session.tenantId);
  await refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "iep.skip", newRequestId(), { learnerId });
  redirect(`/parent/learners/${learnerId}/assessment/submitted?skipped=iep`);
}

async function deleteAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const { deleteIEPForLearner } = await import("@/lib/db/repos");
  await deleteIEPForLearner(learnerId, session.tenantId);
  await refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "iep.delete", newRequestId(), { learnerId });
  redirect(`/parent/learners/${learnerId}/iep`);
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_file:
    "Choose a file before uploading. You can drag it onto the card, pick from your device, or take a photo on mobile.",
  invalid_file: `We can accept PDF, Word, or image files up to ${Math.round(IEP_MAX_BYTES / (1024 * 1024))} MB. Please try a different file.`,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function kindFromMime(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word")) return "Word";
  if (mime.startsWith("image/")) return "Photo";
  if (mime === "text/plain") return "Text";
  return "Document";
}

/* ----- page ---------------------------------------------------------------- */

export default async function IEPUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.learner_iep");
  const { learnerId } = await params;
  const sp = await searchParams;
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) {
    return (
      <AssessmentShell
        eyebrow={`IEP & accommodations for ${learner.displayName}`}
        reassurance={
          <ReassuranceCard
            tone="info"
            title={t("why_assessment_first_title")}
            body="Your answers and the IEP work together. We use both to apply the right supports — never one without the other."
          />
        }
      >
        <QuestionCard
          eyebrow="One step back"
          title={t("finish_assessment_first_title")}
          helper="When that's submitted, you'll come right back here to upload an IEP — or skip and use your assessment alone."
          actions={
            <AssessmentFooter
              back={
                <Link
                  href={`/parent/learners/${learner.id}`}
                  className={ASSESSMENT_BACK_CLASS}
                >
                  {t("back_to_learner")}
                </Link>
              }
              primary={
                <Link
                  href={`/parent/learners/${learner.id}/assessment`}
                  className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                >
                  {t("continue_assessment")}
                </Link>
              }
            />
          }
        >
          <p className="text-sm text-iw-text-muted">
            Submit your assessment and we'll route you straight here to optionally share an IEP, 504,
            or accommodations letter.
          </p>
        </QuestionCard>
      </AssessmentShell>
    );
  }

  const existing = await getIEPForLearner(learnerId, session.tenantId);
  const errorMessage = sp.error ? ERROR_MESSAGES[sp.error] : undefined;

  return (
    <AssessmentShell
      eyebrow={`IEP & accommodations for ${learner.displayName}`}
      reassurance={
        <>
          <ReassuranceCard
            tone="safety"
            title={t("iep_stays_private_title")}
            body="Your learner never sees the raw document. We only keep a structured list of supports, plus a learner-safe summary."
            icon={
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
          />
          <ReassuranceCard
            tone="privacy"
            title={t("you_stay_in_control_title")}
            body="You can review every extracted support, deselect any you'd rather skip, and remove the document at any time."
          />
        </>
      }
    >
      <QuestionCard
        eyebrow="Optional · IEP, 504, or accommodation letter"
        title={t("share_document_title")}
        helper="Drop the file here, pick from your device, or take a photo on mobile. We'll extract the supports — never the diagnosis language — and let you review before anything turns on."
        tag="Optional"
        error={errorMessage}
        actions={
          <AssessmentFooter
            back={
              <Link
                href={`/parent/learners/${learner.id}/assessment/review`}
                className={ASSESSMENT_BACK_CLASS}
              >
                Back
              </Link>
            }
            saveExit={
              <form action={skipAction}>
                <input type="hidden" name="learnerId" value={learner.id} />
                <Button type="submit" variant="ghost" size="sm">
                  {t("skip_for_now")}
                </Button>
              </form>
            }
            primary={
              existing ? (
                <Link
                  href={`/parent/learners/${learner.id}/iep/review`}
                  className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                >
                  {t("review_extracted_supports")}
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </Link>
              ) : null
            }
          />
        }
      >
        {existing ? (
          <div className="flex flex-col gap-4">
            <UploadFileCard
              fileName={existing.fileName}
              bytes={existing.bytes}
              kind={kindFromMime(existing.mimeType)}
              uploadedAt={formatDate(existing.uploadedAt)}
              status={existing.status === "parsed" ? "parsed" : "extracting"}
              actions={
                <form action={deleteAction}>
                  <input type="hidden" name="learnerId" value={learner.id} />
                  <Button type="submit" variant="outline" size="sm">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    {t("remove")}
                  </Button>
                </form>
              }
            />
            <p className="text-xs text-iw-text-muted">
              You can replace this document any time. Removing it clears any extracted supports —
              we'll fall back to your assessment for personalization.
            </p>
          </div>
        ) : (
          <form
            action={uploadAction}
            encType="multipart/form-data"
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="learnerId" value={learner.id} />
            <UploadDropZone
              name="file"
              label="Upload IEP, 504 plan, or accommodation letter"
              helper={`PDF, Word, image, or text. We'll only extract structured supports — never diagnosis language.`}
              accept={[...IEP_ALLOWED_MIME_TYPES, "image/jpeg", "image/png", "image/heic"].join(
                ",",
              )}
              maxBytes={IEP_MAX_BYTES}
              enableCameraCapture
            />
            <Button type="submit" className="self-end">
              {t("upload_extract_supports")}
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m13 5 7 7-7 7" />
              </svg>
            </Button>
          </form>
        )}
      </QuestionCard>
    </AssessmentShell>
  );
}
