import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, FileText, ShieldCheck, Upload } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
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

async function uploadAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
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
  uploadIEPDocument({
    learnerId,
    tenantId: session.tenantId,
    ...meta.data,
  });
  audit(session, "iep.upload", newRequestId(), {
    learnerId,
    metadata: { fileName: meta.data.fileName, bytes: meta.data.bytes, source: "ui" },
  });
  // Auto-extract on upload so the parent sees a populated review screen on
  // the next click — keeps the flow to a single confirmation.
  const learner = getLearner(learnerId, session.tenantId);
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  if (learner) {
    const extraction = buildIEPExtraction({
      learner,
      assessment,
      hasUploadedDocument: true,
    });
    setIEPExtraction(learnerId, session.tenantId, extraction);
  }
  refreshLearnerReadiness(learnerId, session.tenantId);
  redirect(`/parent/learners/${learnerId}/iep/review`);
}

async function skipAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  recordIEPSkip(learnerId, session.tenantId);
  refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "iep.skip", newRequestId(), { learnerId });
  redirect(`/parent/learners/${learnerId}/brain-profile`);
}

async function deleteAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const { deleteIEPForLearner } = await import("@/lib/db/repos");
  deleteIEPForLearner(learnerId, session.tenantId);
  refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "iep.delete", newRequestId(), { learnerId });
  redirect(`/parent/learners/${learnerId}/iep`);
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_file: "Please choose a file to upload.",
  invalid_file:
    "We can accept PDF, Word, or plain text files up to 10 MiB. Please try a different file.",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}

export default async function IEPUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const sp = await searchParams;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) {
    // PRECONDITION: assessment must be submitted first. We don't show a dead
    // upload form — we route the parent to the assessment with a notice.
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow="IEP & accommodations"
          title="Finish the parent assessment first"
          description="We use your assessment answers alongside the IEP so the supports line up. Once you submit the assessment, you'll come back here."
        />
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Parent assessment is in progress"
          description="Complete and submit the parent assessment, then upload an IEP or skip this step."
          action={
            <Button asChild>
              <Link href={`/parent/learners/${learner.id}/assessment`}>
                Continue assessment <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const existing = getIEPForLearner(learnerId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`IEP & accommodations for ${learner.displayName}`}
        title="Optional: share an IEP"
        description="You can upload an IEP, 504 plan, or accommodations summary. We'll pull supports out for AIVO to follow. This step is optional — skip and we'll use your assessment instead."
      />

      {sp.error ? (
        <div className="mb-4 rounded-md border border-aivo-danger bg-aivo-danger/5 px-3 py-2 text-sm text-aivo-danger">
          {ERROR_MESSAGES[sp.error] ?? "Something didn't work. Please try again."}
        </div>
      ) : null}

      <Card className="mb-4 flex items-start gap-3 p-4">
        <ShieldCheck className="h-5 w-5 shrink-0 text-aivo-primary" />
        <div className="text-sm text-aivo-ink-soft">
          <p className="font-medium text-aivo-ink">How we handle this document</p>
          <p className="mt-1">
            We don't show the raw IEP to your learner. We only keep a structured summary of the
            supports — and we always make a separate, learner-safe version of the language for any
            screens your learner sees.
          </p>
        </div>
      </Card>

      {existing ? (
        <>
          <SectionHeader title="On file" />
          <Card className="flex flex-col gap-4 p-[var(--aivo-density-card-pad)] sm:flex-row sm:items-center">
            <FileText className="h-8 w-8 shrink-0 text-aivo-primary" />
            <div className="flex-1">
              <p className="font-display text-base font-semibold">{existing.fileName}</p>
              <p className="text-sm text-aivo-ink-soft">
                {existing.mimeType} · {formatBytes(existing.bytes)} · uploaded{" "}
                {new Date(existing.uploadedAt).toLocaleDateString()}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={existing.status === "parsed" ? "success" : "neutral"}>
                  {existing.status === "parsed" ? "Supports extracted" : "Awaiting extraction"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link href={`/parent/learners/${learner.id}/iep/review`}>
                  Review extracted supports <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <form action={deleteAction}>
                <input type="hidden" name="learnerId" value={learner.id} />
                <Button type="submit" variant="outline">
                  Remove
                </Button>
              </form>
            </div>
          </Card>
        </>
      ) : (
        <>
          <SectionHeader title="Upload an IEP, 504 plan, or accommodations letter" />
          <Card className="p-6">
            <form
              action={uploadAction}
              encType="multipart/form-data"
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="learnerId" value={learner.id} />
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium">Document</span>
                <input
                  type="file"
                  name="file"
                  required
                  accept={IEP_ALLOWED_MIME_TYPES.join(",")}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-aivo-primary-soft file:px-3 file:py-2 file:text-aivo-primary"
                />
                <span className="text-xs text-aivo-ink-soft">
                  PDF, Word, or plain text. Up to {Math.round(IEP_MAX_BYTES / (1024 * 1024))} MiB.
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">
                  <Upload className="mr-1 h-4 w-4" /> Upload & review
                </Button>
              </div>
            </form>
          </Card>

          <Card className="mt-4 flex flex-col gap-3 p-[var(--aivo-density-card-pad)] sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-display text-base font-semibold">Don't have one?</p>
              <p className="text-sm text-aivo-ink-soft">
                Skip this step and we'll set supports based on your assessment. You can always come
                back and upload an IEP later.
              </p>
            </div>
            <form action={skipAction}>
              <input type="hidden" name="learnerId" value={learner.id} />
              <Button type="submit" variant="outline">
                Skip for now
              </Button>
            </form>
          </Card>
        </>
      )}
    </AppShell>
  );
}
