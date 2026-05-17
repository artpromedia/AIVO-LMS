import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
  refreshLearnerReadiness,
  submitParentAssessment,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import {
  ASSESSMENT_SECTION_LABEL,
  ASSESSMENT_SECTION_ORDER,
  validateSection,
  type AssessmentSectionId,
} from "@/lib/validators/parent-assessment";

async function submitAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const current = getOrCreateParentAssessment(learnerId, session.tenantId);
  for (const sec of ASSESSMENT_SECTION_ORDER) {
    // `?? {}` keeps optional sections (basics, strengths, background,
    // learning_profile) non-blocking for legacy assessments whose stored
    // answers map predates these keys.
    const v = validateSection(sec, current.answers[sec] ?? {});
    if (!v.ok) {
      redirect(
        `/parent/learners/${learnerId}/assessment?step=1&error=${encodeURIComponent(
          `incomplete:${sec}`,
        )}`,
      );
    }
  }
  submitParentAssessment(learnerId, session.tenantId);
  refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "parent_assessment.submit", newRequestId(), {
    learnerId,
    metadata: { source: "ui" },
  });
  redirect(`/parent/learners/${learnerId}`);
}

export default async function AssessmentReviewPage({
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
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);

  const sectionStatus = ASSESSMENT_SECTION_ORDER.map((s) => {
    const v = validateSection(s, assessment.answers[s] ?? {});
    return { id: s, ok: v.ok };
  });
  const allValid = sectionStatus.every((s) => s.ok);

  function renderValue(v: unknown): string {
    if (v === null || v === undefined || v === "") return "—";
    if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  }

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`Review for ${learner.displayName}`}
        title="Review and submit"
        description="Check the highlights below before we generate the brain profile."
      />

      {!allValid ? (
        <div className="mb-4 rounded-md border border-aivo-warning bg-aivo-warning/10 px-3 py-2 text-sm">
          Some sections still need attention before submit.{" "}
          <Link
            className="font-semibold underline"
            href={`/parent/learners/${learner.id}/assessment?step=1`}
          >
            Go back to the wizard
          </Link>
          .
        </div>
      ) : null}

      <SectionHeader title="Your answers" />
      <div className="grid gap-4 sm:grid-cols-2">
        {ASSESSMENT_SECTION_ORDER.map((sec) => {
          const answers = (assessment.answers[sec] ?? {}) as Record<string, unknown>;
          const ok = sectionStatus.find((s) => s.id === sec)!.ok;
          return (
            <Card key={sec} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-base font-semibold">
                  {ASSESSMENT_SECTION_LABEL[sec]}
                </p>
                <Badge tone={ok ? "success" : "warning"}>{ok ? "Complete" : "Needs info"}</Badge>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                {Object.keys(answers).length === 0 ? (
                  <p className="text-aivo-ink-soft">Not yet answered.</p>
                ) : (
                  Object.entries(answers).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-3 gap-2">
                      <dt className="col-span-1 text-aivo-ink-soft capitalize">{k}</dt>
                      <dd className="col-span-2">{renderValue(v)}</dd>
                    </div>
                  ))
                )}
              </dl>
              <div className="mt-3">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/parent/learners/${learner.id}/assessment?step=${stepForSection(sec)}`}
                  >
                    Edit
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 max-w-3xl p-6">
        <form action={submitAction} className="flex flex-col gap-3">
          <input type="hidden" name="learnerId" value={learner.id} />
          <p className="text-sm text-aivo-ink-soft">
            You can still update everything from learner settings after submitting.
          </p>
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link href={`/parent/learners/${learner.id}/assessment?step=8`}>Back</Link>
            </Button>
            <Button type="submit" disabled={!allValid}>
              Submit assessment
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}

function stepForSection(sec: AssessmentSectionId): number {
  const map: Record<AssessmentSectionId, number> = {
    basics: 1,
    goals: 2,
    background: 3,
    strengths: 3,
    grade_subject: 4,
    reading: 4,
    math: 4,
    attention: 5,
    communication: 5,
    learning_profile: 5,
    sensory: 6,
    homework: 6,
    frustration: 7,
    motivation: 7,
    accommodations: 8,
    pace: 8,
    concerns: 8,
  };
  return map[sec];
}
