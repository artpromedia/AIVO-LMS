/**
 * State 1 — Intro / overview for the teacher "Classroom insights" assessment.
 *
 * Sets expectations before the eight-section flow: who it's about, how long it
 * takes, why it matters, and the privacy boundary. "Start" (or "Resume" when a
 * draft already has answers) deep-links into the in-progress wizard. RBAC +
 * roster scope are enforced here and again in the BFF on every write.
 */
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  getLearner,
  teacherCanAccessLearner,
  getOrCreateTeacherAssessmentDraft,
} from "@/lib/db/repos";
import {
  TEACHER_ASSESSMENT_SECTIONS,
  TEACHER_ASSESSMENT_TOTAL_QUESTIONS,
} from "@/lib/teacher/assessment-content";
import {
  AssessmentBreadcrumb,
  LearnerSummaryCard,
  InfoRow,
  ClockIcon,
  ShieldIcon,
  HeartIcon,
  HelpIcon,
  ListIcon,
  ArrowRightIcon,
  PRIMARY_BTN,
  SECONDARY_BTN,
  gradeBandLabel,
} from "@/components/teacher/assessment/shared";

export const dynamic = "force-dynamic";

export default async function TeacherAssessmentIntro({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const { learnerId } = await params;
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const name = learner.displayName;
  const draft = await getOrCreateTeacherAssessmentDraft(
    learnerId,
    session.tenantId,
    session.userId,
  );
  const answeredSections = Object.values(draft.answers ?? {}).filter(
    (s) => s && typeof s === "object" && Object.keys(s).length > 0,
  ).length;
  const hasProgress = answeredSections > 0;

  const wizardHref = `/teacher/learners/${learner.id}/assessment`;
  const backHref = `/teacher/learners/${learner.id}`;

  return (
    <>
      <AssessmentBreadcrumb learnerName={name} />

      <LearnerSummaryCard
        name={name}
        metaLine={`${gradeBandLabel(learner.gradeBand)} · Teacher assessment`}
        chips={["Confidential", "~15 min"]}
        right={
          <span className="inline-flex flex-col items-end gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-iw-text-muted">
              Estimated time
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-iw-text-strong">
              <ClockIcon className="h-4 w-4 text-[var(--aivo-sensory-primary)]" />
              <span className="tabular-nums">15–20 min</span>
            </span>
          </span>
        }
      />

      <section className="mt-5 rounded-iw-card border border-iw-border bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--aivo-sensory-primary)]">
          Teacher input
        </p>
        <h1 className="mt-2 font-iw-display text-2xl font-bold text-iw-text-strong sm:text-3xl">
          Share your classroom insights about {name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-iw-text-muted">
          You see {name} in a setting no one else does. Your answers across{" "}
          <span className="font-semibold text-iw-text-strong tabular-nums">
            {TEACHER_ASSESSMENT_SECTIONS.length} sections
          </span>{" "}
          and{" "}
          <span className="font-semibold text-iw-text-strong tabular-nums">
            {TEACHER_ASSESSMENT_TOTAL_QUESTIONS} short questions
          </span>{" "}
          help AIVO build a learning experience that fits {name} — most are
          quick taps, and you can pause and resume anytime.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <InfoRow
            icon={<HeartIcon className="h-5 w-5" />}
            title="It shapes the brain-clone"
            body={`Your contribution joins the family's input so ${name}'s plan reflects how they actually learn with you.`}
          />
          <InfoRow
            icon={<ListIcon className="h-5 w-5" />}
            title="Mostly taps, not essays"
            body="Single- and multi-select questions move fast; the few open notes are optional."
          />
          <InfoRow
            icon={<ClockIcon className="h-5 w-5" />}
            title="Autosaves as you go"
            body="Every answer is saved the moment you pick it — close the tab and come back without losing a thing."
          />
          <InfoRow
            icon={<ShieldIcon className="h-5 w-5" />}
            title="Private & professional"
            body={`Visible to ${name}'s family and care team — never shared beyond their plan.`}
          />
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href={wizardHref} className={PRIMARY_BTN}>
            {hasProgress ? "Resume assessment" : "Start assessment"}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link href={backHref} className={SECONDARY_BTN}>
            Back to {name}
          </Link>
          {hasProgress ? (
            <span className="text-xs text-iw-text-muted">
              <span className="tabular-nums">{answeredSections}</span> of{" "}
              <span className="tabular-nums">{TEACHER_ASSESSMENT_SECTIONS.length}</span> sections
              started
            </span>
          ) : null}
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-3 rounded-iw-card border border-iw-border bg-[var(--aivo-color-aivoPurple-50)] p-4">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-iw-control bg-white text-[var(--aivo-sensory-primary)]"
          aria-hidden="true"
        >
          <HelpIcon className="h-5 w-5" />
        </span>
        <p className="min-w-0 text-sm text-iw-text-strong">
          Not sure about an answer? Pick your best read — every question is
          editable from the review screen before you submit.
        </p>
      </section>

      <section className="mt-4 flex items-center gap-4 rounded-iw-card border border-iw-border bg-white p-5">
        <Image
          src="/images/mascot/virtual-brain-robot.png"
          alt=""
          aria-hidden="true"
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 object-contain"
        />
        <p className="min-w-0 text-sm leading-relaxed text-iw-text-muted">
          <span className="font-semibold text-iw-text-strong">Thank you.</span>{" "}
          Teachers who share their view help AIVO get {name}&rsquo;s support
          right from day one — it genuinely makes a difference.
        </p>
      </section>
    </>
  );
}
