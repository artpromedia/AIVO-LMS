/**
 * Sprint C-07 — Teacher assessment REVIEW & submit (step 5).
 *
 * A compact recap: each section with a complete/edit affordance and an
 * edit link back to the relevant wizard step, then the client submit
 * island (timer + submit → completion). Mirrors the parent review screen.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AssessmentShell, QuestionCard, ASSESSMENT_GHOST_CLASS } from "@aivo/ui";
import {
  getLearner,
  teacherCanAccessLearner,
  getOrCreateTeacherAssessmentDraft,
} from "@/lib/db/repos";
import {
  TEACHER_ROLE_LABELS,
  type TeacherAssessmentSectionId,
} from "@/lib/validators/teacher-assessment";
import type { TeacherAssessmentDraft } from "@/lib/db/types";
import { TeacherAssessmentSubmit } from "../teacher-assessment-submit";

export const dynamic = "force-dynamic";

const SECTION_STEP: Record<TeacherAssessmentSectionId, number> = {
  context: 1,
  strengths: 2,
  supports: 3,
  observations: 4,
};

function answersOf(
  draft: TeacherAssessmentDraft,
  section: TeacherAssessmentSectionId,
): Record<string, unknown> {
  return (draft.answers[section] ?? {}) as Record<string, unknown>;
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

export default async function TeacherAssessmentReview({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const t = await getTranslations("teacher.learner_assessment");
  const { learnerId } = await params;
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const name = learner.displayName;

  const draft = await getOrCreateTeacherAssessmentDraft(learnerId, session.tenantId, session.userId);

  const ctx = answersOf(draft, "context");
  const str = answersOf(draft, "strengths");
  const sup = answersOf(draft, "supports");
  const obs = answersOf(draft, "observations");

  const roleLabel =
    typeof ctx.teacherRole === "string"
      ? t(`context_role_${ctx.teacherRole}`)
      : t("review_empty");
  const gradeLabel =
    typeof ctx.gradeLevel === "string"
      ? t(`context_grade_${String(ctx.gradeLevel).replace(/-/g, "_")}`)
      : t("review_empty");

  const sections: Array<{
    id: TeacherAssessmentSectionId;
    title: string;
    complete: boolean;
    lines: string[];
  }> = [
    {
      id: "context",
      title: t("review_section_context"),
      complete: Boolean(ctx.teacherRole && ctx.gradeLevel),
      lines: [`${roleLabel} · ${gradeLabel}`],
    },
    {
      id: "strengths",
      title: t("review_section_strengths"),
      complete: asList(str.strengths).length > 0,
      lines:
        asList(str.strengths).length > 0
          ? asList(str.strengths)
          : [t("review_empty")],
    },
    {
      id: "supports",
      title: t("review_section_supports"),
      complete: asList(sup.challenges).length > 0 || asList(sup.accommodations).length > 0,
      lines: [
        ...asList(sup.accommodations),
        ...(asList(sup.accommodations).length === 0 && asList(sup.challenges).length === 0
          ? [t("review_empty_optional")]
          : []),
      ],
    },
    {
      id: "observations",
      title: t("review_section_observations"),
      complete: typeof obs.observations === "string" && obs.observations.length > 0,
      lines: [
        typeof obs.observations === "string" && obs.observations
          ? obs.observations
          : t("review_empty_optional"),
      ],
    },
  ];

  // Keep TEACHER_ROLE_LABELS referenced so the projection mapping stays
  // discoverable from the review surface (the BFF uses it on submit).
  void TEACHER_ROLE_LABELS;

  return (
    <AssessmentShell eyebrow={t("eyebrow", { name })}>
      <QuestionCard
        eyebrow={t("review_label")}
        title={t("review_header", { name })}
        helper={t("review_helper")}
      >
        <ul className="flex flex-col gap-3">
          {sections.map((s) => (
            <li
              key={s.id}
              className="rounded-iw-card border border-iw-border bg-white p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-iw-text-strong">{s.title}</span>
                  {s.complete ? (
                    <span className="inline-flex items-center gap-1 rounded-iw-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)]">
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="3 8 7 12 13 4" />
                      </svg>
                      {t("review_complete")}
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/teacher/learners/${learner.id}/assessment?step=${SECTION_STEP[s.id]}`}
                  className={ASSESSMENT_GHOST_CLASS}
                >
                  {t("review_edit")}
                </Link>
              </div>
              <ul className="flex flex-col gap-0.5">
                {s.lines.map((line, i) => (
                  <li key={i} className="text-xs text-iw-text-muted leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="pt-2 border-t border-iw-border">
          <TeacherAssessmentSubmit
            learnerId={learner.id}
            learnerName={name}
            startedAtMs={draft.startedAtMs}
            backToLearnerHref={`/teacher/learners/${learner.id}`}
            rosterHref="/teacher/learners"
          />
        </div>
      </QuestionCard>
    </AssessmentShell>
  );
}
