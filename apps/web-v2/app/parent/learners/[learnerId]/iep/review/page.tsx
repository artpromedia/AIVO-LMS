import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  QuestionCard,
  AssessmentFooter,
  ASSESSMENT_BACK_CLASS,
  ASSESSMENT_GHOST_CLASS,
  ExtractedSupportRow,
  UploadFileCard,
  ReassuranceCard,
  InsightChip,
} from "@aivo/ui";
import { Button } from "@/components/ui/button";
import {
  confirmIEPExtraction,
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
  refreshLearnerReadiness,
  setIEPExtraction,
} from "@/lib/db/repos";
import { buildIEPExtraction } from "@/lib/learner/iep";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

async function reextractAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const learner = await getLearner(learnerId, session.tenantId);
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!learner) redirect("/parent/learners");
  const extraction = buildIEPExtraction({
    learner: learner!,
    assessment,
    hasUploadedDocument: true,
  });
  await setIEPExtraction(learnerId, session.tenantId, extraction);
  await refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "iep.reextract", newRequestId(), { learnerId });
  redirect(`/parent/learners/${learnerId}/iep/review`);
}

async function confirmAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const accepted = formData.getAll("accepted").map(String);
  const usageConsent = formData.get("usageConsent") === "on";
  if (!usageConsent) {
    redirect(`/parent/learners/${learnerId}/iep/review?error=consent_required`);
  }
  await confirmIEPExtraction(learnerId, session.tenantId, accepted);
  await refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "iep.confirm", newRequestId(), {
    learnerId,
    metadata: { acceptedCount: accepted.length },
  });
  redirect(`/parent/learners/${learnerId}/assessment/submitted`);
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
  consent_required:
    "Please tick the consent box to confirm AIVO can use these supports for your learner's personalization.",
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

export default async function IEPReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const sp = await searchParams;
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const doc = await getIEPForLearner(learnerId, session.tenantId);
  if (!doc) {
    return (
      <AssessmentShell eyebrow={`IEP review for ${learner.displayName}`}>
        <QuestionCard
          eyebrow="Nothing to review yet"
          title="No IEP on file"
          helper="Upload an IEP, 504 plan, or accommodation letter to see the extracted supports here."
          actions={
            <AssessmentFooter
              primary={
                <Link
                  href={`/parent/learners/${learner.id}/iep`}
                  className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                >
                  Go to IEP upload
                </Link>
              }
            />
          }
        >
          <p className="text-sm text-iw-text-muted">
            Or skip and we'll use your assessment alone for personalization. You can always come
            back to upload later.
          </p>
        </QuestionCard>
      </AssessmentShell>
    );
  }

  const ex = doc.extraction;
  const previouslyAccepted = new Set(doc.acceptedAccommodations ?? ex?.accommodations ?? []);
  const errorMessage = sp.error ? ERROR_MESSAGES[sp.error] : undefined;

  // Confidence is synthetic until the LLM adapter writes per-accommodation
  // confidence — we treat learner-affecting supports (read aloud, extended
  // time, speech-to-text) as high, the rest as medium, and any free-text
  // entries from the parent's known list as worth-a-glance.
  function confidenceFor(label: string): "high" | "medium" | "low" {
    const lower = label.toLowerCase();
    if (
      lower.includes("extended time") ||
      lower.includes("read-aloud") ||
      lower.includes("speech-to-text") ||
      lower.includes("aac")
    ) {
      return "high";
    }
    if (lower.includes("sensory") || lower.includes("movement") || lower.includes("break")) {
      return "medium";
    }
    return "low";
  }

  return (
    <AssessmentShell
      eyebrow={`IEP review for ${learner.displayName}`}
      reassurance={
        <>
          <ReassuranceCard
            tone="safety"
            title="Learner never sees this"
            body="Your child only sees a calm, supportive summary — never clinical or diagnostic language."
          />
          <ReassuranceCard
            tone="privacy"
            title="You can deselect anything"
            body="Toggle off any support you'd rather not have AIVO apply. You can also remove the whole document."
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <UploadFileCard
          fileName={doc.fileName}
          bytes={doc.bytes}
          kind={kindFromMime(doc.mimeType)}
          uploadedAt={formatDate(doc.uploadedAt)}
          status={ex ? "parsed" : "extracting"}
          actions={
            <div className="flex items-center gap-2">
              <form action={reextractAction}>
                <input type="hidden" name="learnerId" value={learner.id} />
                <Button type="submit" variant="outline" size="sm">
                  Re-run extraction
                </Button>
              </form>
              <form action={deleteAction}>
                <input type="hidden" name="learnerId" value={learner.id} />
                <Button type="submit" variant="danger" size="sm">
                  Remove
                </Button>
              </form>
            </div>
          }
        />

        {!ex ? (
          <QuestionCard
            eyebrow="Extraction in progress"
            title="Reading the document"
            helper="This usually takes about a minute. We'll let you know when the supports are ready."
          >
            <p className="text-sm text-iw-text-muted">
              If this is taking longer than expected, try re-running the extraction from the file
              card above.
            </p>
          </QuestionCard>
        ) : (
          <form action={confirmAction}>
            <input type="hidden" name="learnerId" value={learner.id} />
            <QuestionCard
              eyebrow="Extracted supports"
              title="Confirm what AIVO can apply"
              helper="Each support below comes from your IEP. Untick any you'd rather skip. You can change this later from the learner's settings."
              tag={`${ex.accommodations.length} found`}
              error={errorMessage}
              actions={
                <AssessmentFooter
                  back={
                    <Link
                      href={`/parent/learners/${learner.id}/iep`}
                      className={ASSESSMENT_BACK_CLASS}
                    >
                      Back to upload
                    </Link>
                  }
                  saveExit={
                    <Link
                      href={`/parent/learners/${learner.id}`}
                      className={ASSESSMENT_GHOST_CLASS}
                    >
                      Save & exit
                    </Link>
                  }
                  primaryLabel="Confirm & continue"
                />
              }
            >
              {ex.accommodations.length === 0 ? (
                <p className="text-sm text-iw-text-muted rounded-iw-card border border-iw-border bg-white p-4">
                  We couldn't pull any specific accommodations from this document. AIVO will use
                  sensible defaults based on your assessment instead.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {ex.accommodations.map((acc) => (
                    <ExtractedSupportRow
                      key={acc}
                      name="accepted"
                      value={acc}
                      label={acc}
                      provenance={
                        ex.source === "ai_extraction"
                          ? "Extracted from your IEP document"
                          : "Inferred from IEP + your parent assessment"
                      }
                      confidence={confidenceFor(acc)}
                      defaultChecked={previouslyAccepted.has(acc)}
                    />
                  ))}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-iw-card border border-iw-border bg-white p-4">
                  <p className="iw-label text-iw-text-muted mb-2">Service areas</p>
                  {ex.serviceAreas.length === 0 ? (
                    <p className="text-sm text-iw-text-muted">None flagged.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {ex.serviceAreas.map((s) => (
                        <InsightChip key={s} tone="info" size="md">
                          {s}
                        </InsightChip>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-iw-card border border-iw-border bg-white p-4">
                  <p className="iw-label text-iw-text-muted mb-2">Assistive technology</p>
                  {ex.assistiveTechnologyNeeds.length === 0 ? (
                    <p className="text-sm text-iw-text-muted">None recorded.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {ex.assistiveTechnologyNeeds.map((s) => (
                        <InsightChip key={s} tone="accent" size="md">
                          {s}
                        </InsightChip>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-iw-card border border-iw-border bg-[var(--aivo-aivoPurple-50)]/40 p-4">
                <p className="iw-label text-iw-text-muted mb-2">Learner-safe summary</p>
                <p className="text-sm text-iw-text-strong leading-relaxed">
                  {ex.learnerSafeSummary}
                </p>
                <p className="text-[11px] text-iw-text-muted mt-2">
                  This is the only version your learner ever sees. They never see the raw IEP or
                  any clinical language.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-iw-card border border-iw-border bg-white p-4 cursor-pointer">
                <input
                  type="checkbox"
                  name="usageConsent"
                  required
                  className="mt-0.5 h-5 w-5 rounded-[6px] accent-[var(--aivo-sensory-primary)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-iw-text-strong">
                    I consent to AIVO using these supports to personalize learning
                  </span>
                  <span className="text-xs text-iw-text-muted leading-relaxed">
                    AIVO will apply the supports you've ticked above across lessons, homework, and
                    the AI tutor. You can change or revoke this any time from the learner's
                    settings.
                  </span>
                </span>
              </label>
            </QuestionCard>
          </form>
        )}
      </div>
    </AssessmentShell>
  );
}
