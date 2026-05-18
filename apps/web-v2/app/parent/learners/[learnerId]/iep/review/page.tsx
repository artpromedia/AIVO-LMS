import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
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
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const learner = getLearner(learnerId, session.tenantId);
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!learner) redirect("/parent/learners");
  const extraction = buildIEPExtraction({
    learner: learner!,
    assessment,
    hasUploadedDocument: true,
  });
  setIEPExtraction(learnerId, session.tenantId, extraction);
  refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "iep.reextract", newRequestId(), { learnerId });
  redirect(`/parent/learners/${learnerId}/iep/review`);
}

function YesNo({ value }: { value: boolean }) {
  return value ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">No</Badge>;
}

export default async function IEPReviewPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const doc = getIEPForLearner(learnerId, session.tenantId);
  if (!doc) {
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow={`IEP review for ${learner.displayName}`}
          title="No IEP on file"
          description="Upload an IEP first to see the extracted supports here."
        />
        <EmptyState
          title="Nothing to review yet"
          description="Once you upload a document we'll pull the supports out and show them here."
          action={
            <Button asChild>
              <Link href={`/parent/learners/${learner.id}/iep`}>
                Go to IEP upload <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const ex = doc.extraction;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`IEP review for ${learner.displayName}`}
        title="Extracted supports"
        description="This is what AIVO will use during lessons. You can re-run the extraction or replace the document at any time."
        actions={
          <Button asChild variant="outline">
            <Link href={`/parent/learners/${learner.id}/iep`}>Manage document</Link>
          </Button>
        }
      />

      <Card className="mb-4 flex items-start gap-3 p-4">
        <ShieldCheck className="h-5 w-5 shrink-0 text-aivo-primary" />
        <div className="text-sm text-aivo-ink-soft">
          <p className="font-medium text-aivo-ink">Safety note</p>
          <p className="mt-1">
            Your learner never sees the raw IEP or any clinical / diagnostic language. We keep a
            separate, supportive learner-safe summary that the lessons can reference.
          </p>
        </div>
      </Card>

      {!ex ? (
        <EmptyState
          title="No supports extracted yet"
          description="We couldn't extract supports from this document automatically."
          action={
            <form action={reextractAction}>
              <input type="hidden" name="learnerId" value={learner.id} />
              <Button type="submit">Try extraction again</Button>
            </form>
          }
        />
      ) : (
        <>
          <SectionHeader title="Accommodations" />
          <Card className="p-[var(--aivo-density-card-pad)]">
            {ex.accommodations.length === 0 ? (
              <p className="text-sm text-aivo-ink-soft">
                No specific accommodations recorded. AIVO will use sensible defaults based on your
                assessment.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {ex.accommodations.map((a) => (
                  <li key={a} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-aivo-success" />
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <SectionHeader title="Support areas" className="mt-6" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="flex items-center justify-between p-[var(--aivo-density-card-pad)]">
              <span className="text-sm font-medium">Extended time</span>
              <YesNo value={ex.extendedTime} />
            </Card>
            <Card className="flex items-center justify-between p-[var(--aivo-density-card-pad)]">
              <span className="text-sm font-medium">Reading support</span>
              <YesNo value={ex.readingSupport} />
            </Card>
            <Card className="flex items-center justify-between p-[var(--aivo-density-card-pad)]">
              <span className="text-sm font-medium">Writing support</span>
              <YesNo value={ex.writingSupport} />
            </Card>
            <Card className="flex items-center justify-between p-[var(--aivo-density-card-pad)]">
              <span className="text-sm font-medium">Behavioral support</span>
              <YesNo value={ex.behavioralSupport} />
            </Card>
            <Card className="flex items-center justify-between p-[var(--aivo-density-card-pad)]">
              <span className="text-sm font-medium">Sensory support</span>
              <YesNo value={ex.sensorySupport} />
            </Card>
            <Card className="flex items-center justify-between p-[var(--aivo-density-card-pad)]">
              <span className="text-sm font-medium">Communication support</span>
              <YesNo value={ex.communicationSupport} />
            </Card>
          </div>

          <SectionHeader title="Service areas & assistive tech" className="mt-6" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                Service areas
              </p>
              {ex.serviceAreas.length === 0 ? (
                <p className="mt-2 text-sm text-aivo-ink-soft">None flagged.</p>
              ) : (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {ex.serviceAreas.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                Assistive technology
              </p>
              {ex.assistiveTechnologyNeeds.length === 0 ? (
                <p className="mt-2 text-sm text-aivo-ink-soft">None recorded.</p>
              ) : (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {ex.assistiveTechnologyNeeds.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <SectionHeader title="Plain-language summaries" className="mt-6" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-primary">
                Learner-safe
              </p>
              <p className="mt-2 text-sm">{ex.learnerSafeSummary}</p>
            </Card>
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-primary">
                For parents
              </p>
              <p className="mt-2 text-sm">{ex.parentSummary}</p>
            </Card>
            <Card className="p-[var(--aivo-density-card-pad)]">
              <p className="text-xs font-medium uppercase tracking-wide text-aivo-primary">
                For teachers
              </p>
              <p className="mt-2 text-sm">{ex.teacherSummary}</p>
            </Card>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <form action={reextractAction}>
              <input type="hidden" name="learnerId" value={learner.id} />
              <Button type="submit" variant="outline">
                Re-run extraction
              </Button>
            </form>
            <Button asChild>
              <Link href={`/parent/learners/${learner.id}/brain-profile`}>
                Continue to brain profile <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </AppShell>
  );
}
