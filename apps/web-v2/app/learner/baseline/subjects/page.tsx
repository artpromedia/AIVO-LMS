import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import {
  LearnerBaselineShell,
  PersonalizationChip,
} from "@aivo/ui";
import {
  createBaseline,
  getActiveBaselineForLearner,
  getBrainProfile,
  getOrCreateParentAssessment,
  listSubjects,
} from "@/lib/db/repos";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";

async function startWithSubjectsAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "learner" || !session.learnerId) redirect("/login");
  const learnerId = session.learnerId;
  const subjectIds = formData.getAll("subjectIds").map(String).filter(Boolean);
  if (subjectIds.length === 0) {
    redirect("/learner/baseline/subjects?error=pick_one");
  }
  const assessment = getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) redirect("/learner/home");
  if (!getBrainProfile(learnerId, session.tenantId)) redirect("/learner/home");

  // Reuse the active baseline if one is already in flight; otherwise create fresh.
  let baseline = getActiveBaselineForLearner(learnerId, session.tenantId);
  if (!baseline || baseline.status === "complete") {
    const created = createBaseline({ learnerId, tenantId: session.tenantId, subjectIds });
    if (!created) redirect("/learner/home");
    baseline = created!.baseline;
    audit(session, "baseline.create", newRequestId(), {
      learnerId,
      metadata: {
        baselineId: baseline.id,
        subjectIds,
        source: "learner_subject_pick",
      },
    });
  }
  redirect(`/learner/baseline/readiness?b=${baseline.id}`);
}

export default async function BaselineSubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["learner"]);
  const sp = await searchParams;
  if (!session.learnerId) redirect("/learner/home");
  const subjects = listSubjects();
  const focusSubjects =
    ((await getOrCreateParentAssessment(session.learnerId, session.tenantId)).answers
      .grade_subject as { focusSubjects?: string[] } | undefined)?.focusSubjects ?? [];

  // Highlight focus subjects from the parent assessment with a tag.
  const focusSet = new Set(focusSubjects.map((s) => s.toLowerCase()));

  return (
    <LearnerBaselineShell
      headerLeft={
        <Link
          href="/learner/baseline/why"
          className="inline-flex items-center gap-1.5 rounded-iw-control px-3 py-1.5 text-sm font-semibold text-iw-text-strong bg-white border border-iw-border hover:bg-[var(--aivo-color-surface-muted)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back
        </Link>
      }
      headerRight={<PersonalizationChip variant="parent_assessment" />}
    >
      <section className="flex flex-col gap-2">
        <p className="iw-label text-iw-text-muted">Step 1 of 3</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong leading-snug">
          Where do you want to start?
        </h1>
        <p className="text-base text-iw-text-muted max-w-2xl">
          Pick one or more subjects. AIVO will pick a small handful of friendly questions just for
          you.
        </p>
      </section>

      {sp.error === "pick_one" ? (
        <p
          role="alert"
          className="rounded-iw-card border border-[var(--aivo-color-status-warning-default)] bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)] px-4 py-2.5 text-sm"
        >
          Pick at least one subject to start.
        </p>
      ) : null}

      <form action={startWithSubjectsAction} className="flex flex-col gap-4">
        <fieldset>
          <legend className="sr-only">Choose subjects</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => {
              const tutor = tutorForSubjectSlug(s.slug);
              const isFocus = focusSet.has(s.slug) || focusSet.has(s.name.toLowerCase());
              return (
                <label
                  key={s.id}
                  className="group relative flex flex-col gap-3 cursor-pointer select-none rounded-iw-card-lg border-2 bg-white p-5 transition-all duration-150 hover:border-[var(--aivo-color-aivoPurple-200)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--aivo-sensory-ringFocus)] focus-within:ring-offset-2 border-iw-border has-[:checked]:border-[var(--aivo-sensory-primary)] has-[:checked]:bg-[var(--aivo-color-aivoPurple-50)]/40 has-[:checked]:shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.15)]"
                >
                  <input
                    type="checkbox"
                    name="subjectIds"
                    value={s.id}
                    defaultChecked={isFocus}
                    className="sr-only"
                  />
                  <header className="flex items-center justify-between gap-2">
                    <span
                      className="w-12 h-12 rounded-iw-control flex items-center justify-center text-2xl"
                      style={
                        tutor
                          ? { backgroundColor: `${tutor.color}1A`, color: tutor.color }
                          : undefined
                      }
                      aria-hidden="true"
                    >
                      {tutor?.emoji ?? "📘"}
                    </span>
                    <span
                      className="w-6 h-6 rounded-full border-2 border-iw-border bg-white group-has-[:checked]:border-[var(--aivo-sensory-primary)] group-has-[:checked]:bg-[var(--aivo-sensory-primary)] flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-white opacity-0 group-has-[:checked]:opacity-100"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 8 7 12 13 4" />
                      </svg>
                    </span>
                  </header>
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-semibold text-iw-text-strong">{s.name}</p>
                    <p className="text-sm text-iw-text-muted leading-relaxed line-clamp-2">
                      {s.description}
                    </p>
                  </div>
                  {tutor ? (
                    <p className="text-xs text-iw-text-muted mt-1">
                      With {tutor.name} · {tutor.landmark}
                    </p>
                  ) : null}
                  {isFocus ? (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-iw-chip text-[10px] font-semibold uppercase tracking-wide bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)]">
                      Picked by grown-up
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
          <p className="text-xs text-iw-text-muted">
            Subjects with a "Picked by grown-up" tag come from your parent's setup.
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-[var(--aivo-color-surface-canvas)]"
          >
            Get ready
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </LearnerBaselineShell>
  );
}
