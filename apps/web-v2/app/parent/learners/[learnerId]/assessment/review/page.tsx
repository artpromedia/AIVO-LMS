import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import {
  AssessmentShell,
  QuestionCard,
  AssessmentFooter,
  ASSESSMENT_BACK_CLASS,
  ASSESSMENT_GHOST_CLASS,
  InsightChip,
  ReassuranceCard,
} from "@aivo/ui";
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
  WIZARD_STEPS,
  validateSection,
  type AssessmentSectionId,
} from "@/lib/validators/parent-assessment";

async function submitAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/parent/learners");
  }
  const current = await getOrCreateParentAssessment(learnerId, session.tenantId);
  for (const sec of ASSESSMENT_SECTION_ORDER) {
    const v = validateSection(sec, current.answers[sec] ?? {});
    if (!v.ok) {
      redirect(
        `/parent/learners/${learnerId}/assessment?step=${stepForSection(sec)}&error=${encodeURIComponent(
          sec,
        )}`,
      );
    }
  }
  await submitParentAssessment(learnerId, session.tenantId);
  await refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "parent_assessment.submit", newRequestId(), {
    learnerId,
    metadata: { source: "ui" },
  });
  redirect(`/parent/learners/${learnerId}/iep`);
}

function stepForSection(sec: AssessmentSectionId): number {
  const step = WIZARD_STEPS.find((s) => s.sections.includes(sec));
  return step?.id ?? 1;
}

function summarizeAnswers(answers: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [, v] of Object.entries(answers)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      parts.push(v.join(", "));
    } else if (typeof v === "boolean") {
      if (v) parts.push("yes");
    } else {
      parts.push(String(v));
    }
  }
  return parts.join(" · ").slice(0, 160);
}

export default async function AssessmentReviewPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.learner_assessment_review");
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);

  const stepStatus = WIZARD_STEPS.map((step) => {
    const sectionStatus = step.sections.map((sec) => {
      const v = validateSection(sec, assessment.answers[sec] ?? {});
      return { id: sec, ok: v.ok };
    });
    return {
      id: step.id,
      label: step.label,
      longLabel: step.longLabel,
      sections: sectionStatus,
      ok: sectionStatus.every((s) => s.ok),
    };
  });
  const allValid = stepStatus.every((s) => s.ok);
  const incompleteCount = stepStatus.filter((s) => !s.ok).length;

  return (
    <AssessmentShell
      eyebrow={`Review for ${learner.displayName}`}
      reassurance={
        <>
          <ReassuranceCard
            tone="info"
            title={t("reassurance_review_title")}
            body="After submit, AIVO uses these answers to generate a personalized baseline. You'll still be able to edit everything later."
          />
          <ReassuranceCard
            tone="privacy"
            title={t("reassurance_next_title")}
            body="We'll route you to the optional IEP step. If you'd rather skip, your assessment alone is plenty for AIVO to start."
          />
        </>
      }
    >
      <form action={submitAction}>
        <input type="hidden" name="learnerId" value={learner.id} />
        <QuestionCard
          eyebrow="Review & submit"
          title={`A quick look back before AIVO starts personalising for ${learner.preferredName || learner.firstName}`}
          helper={
            allValid
              ? "Everything looks complete. Submit when you're ready — you can come back and edit later."
              : `${incompleteCount} step${incompleteCount === 1 ? "" : "s"} still need a touch-up before we can submit.`
          }
          tag={allValid ? "Ready to submit" : "Almost ready"}
          actions={
            <AssessmentFooter
              back={
                <Link
                  href={`/parent/learners/${learner.id}/assessment?step=${WIZARD_STEPS.length}`}
                  className={ASSESSMENT_BACK_CLASS}
                >
                  {t("back_to_last_step")}
                </Link>
              }
              saveExit={
                <Link href={`/parent/learners/${learner.id}`} className={ASSESSMENT_GHOST_CLASS}>
                  {t("save_exit")}
                </Link>
              }
              primaryLabel="Submit assessment"
              primaryDisabled={!allValid}
            />
          }
        >
          <ol className="grid gap-3 sm:grid-cols-2">
            {stepStatus.map((step) => {
              const answers = step.sections
                .map((s) => {
                  const obj = (assessment.answers[s.id] ?? {}) as Record<string, unknown>;
                  return summarizeAnswers(obj);
                })
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={step.id}
                  className={`flex flex-col gap-2 rounded-iw-card border bg-white p-4 ${
                    step.ok ? "border-iw-border" : "border-[var(--aivo-status-warning)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-iw-text-strong">{step.longLabel}</p>
                    <InsightChip tone={step.ok ? "success" : "warning"} size="sm">
                      {step.ok ? "Complete" : "Needs info"}
                    </InsightChip>
                  </div>
                  {answers ? (
                    <p className="text-xs text-iw-text-muted leading-relaxed line-clamp-2">
                      {answers}
                    </p>
                  ) : (
                    <p className="text-xs text-iw-text-muted italic">{t("not_yet_answered")}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {step.sections.map((sec) => (
                      <InsightChip key={sec.id} tone={sec.ok ? "neutral" : "warning"} size="sm">
                        {ASSESSMENT_SECTION_LABEL[sec.id]}
                      </InsightChip>
                    ))}
                  </div>
                  <Link
                    href={`/parent/learners/${learner.id}/assessment?step=${step.id}`}
                    className="self-start text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline mt-1"
                  >
                    {t("edit_answers")}
                  </Link>
                </li>
              );
            })}
          </ol>
        </QuestionCard>
      </form>
    </AssessmentShell>
  );
}
