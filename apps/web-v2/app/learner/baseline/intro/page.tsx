import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  LearnerBaselineShell,
  AICompanionHero,
  PersonalizationChip,
  type PersonalizationVariant,
} from "@aivo/ui";
import {
  getActiveBaselineForLearner,
  getBaselineById,
  getIEPForLearner,
  getLearner,
  listBaselineQuestions,
  listSubjects,
} from "@/lib/db/repos";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";

/**
 * /learner/baseline/intro
 *
 * The "Assessment intro" screen from sprint 6. Sits between the
 * readiness check and the first question. Tells the learner how many
 * questions, who's helping, and starts the runner with a single tap.
 */
export default async function BaselineIntroPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const session = await requirePageRole(["learner"]);
  if (!session.learnerId) redirect("/learner/home");
  const sp = await searchParams;
  const baseline = sp.b
    ? getBaselineById(sp.b, session.tenantId)
    : getActiveBaselineForLearner(session.learnerId, session.tenantId);
  if (!baseline || baseline.learnerId !== session.learnerId) {
    redirect("/learner/baseline/subjects");
  }

  const learner = getLearner(session.learnerId, session.tenantId);
  if (!learner) redirect("/learner/home");
  const questions = listBaselineQuestions(baseline.id);
  const allSubjects = listSubjects();
  const subjectsById = new Map(allSubjects.map((s) => [s.id, s]));
  const subjects = baseline.subjectIds
    .map((id) => subjectsById.get(id))
    .filter(Boolean) as ReturnType<typeof listSubjects>;
  const tutors = subjects.map((s) => tutorForSubjectSlug(s.slug)).filter(Boolean);
  const firstTutor = tutors[0];

  const iep = getIEPForLearner(session.learnerId, session.tenantId);
  const chips: PersonalizationVariant[] = ["parent_assessment", "no_grades"];
  if (iep?.confirmedAt) chips.unshift("iep");
  chips.push("pacing");

  return (
    <LearnerBaselineShell
      headerLeft={
        <Link
          href={`/learner/baseline/readiness?b=${baseline.id}`}
          className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-sunken)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back
        </Link>
      }
      headerRight={
        <p className="text-xs text-iw-text-muted">
          Step 3 of 3
        </p>
      }
    >
      <AICompanionHero
        eyebrow={`A friendly check-in · ${questions.length} short questions`}
        title={`Ready, ${learner.preferredName || learner.firstName}?`}
        body={
          firstTutor
            ? `${firstTutor.name} from the ${firstTutor.landmark} is here to help you start. We'll go one question at a time. Skip anything you don't want to try.`
            : "We'll go one question at a time. Skip anything you don't want to try."
        }
        tutorAvatar={firstTutor?.emoji}
        chips={chips.slice(0, 4).map((v) => (
          <PersonalizationChip key={v} variant={v} />
        ))}
        actions={
          <Link
            href={`/learner/baseline/${baseline.id}`}
            className="inline-flex items-center gap-2 rounded-iw-control px-6 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
          >
            Start when you're ready
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </Link>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">Subjects today</p>
          <p className="text-2xl font-semibold text-iw-text-strong tabular-nums">
            {subjects.length}
          </p>
          <p className="text-xs text-iw-text-muted leading-relaxed">
            {subjects.map((s) => s.name).join(", ")}
          </p>
        </article>
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">Questions</p>
          <p className="text-2xl font-semibold text-iw-text-strong tabular-nums">
            {questions.length}
          </p>
          <p className="text-xs text-iw-text-muted leading-relaxed">
            Short and friendly. Skip anything if you'd rather move on.
          </p>
        </article>
        <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
          <p className="iw-label text-iw-text-muted">Time</p>
          <p className="text-2xl font-semibold text-iw-text-strong">No clock</p>
          <p className="text-xs text-iw-text-muted leading-relaxed">
            Pause whenever. AIVO will remember where you left off.
          </p>
        </article>
      </section>
    </LearnerBaselineShell>
  );
}
