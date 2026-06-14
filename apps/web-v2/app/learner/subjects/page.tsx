/**
 * Subjects-all page.
 *
 * Sprint 1 (subject/tutor UX): renders the canonical discoverable set from
 * `@aivo/brand` (`getDiscoverableSubjects`) so web and mobile show the same
 * subjects. Every subject is reachable and playable end-to-end through the
 * lesson flow, with no hollow placeholder subject cards.
 *
 * Empty state (no baseline yet) routes the learner to /learner/baseline
 * so they don't see hollow cards.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { SubjectCard, EmptyState } from "@aivo/ui";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { getIEPForLearner, getMasteryMap, listSubjects } from "@/lib/db/repos";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";
import { masteryStageLabel } from "@/lib/learner/mastery-words";
import { getDiscoverableSubjects } from "@aivo/brand";
import { TutorFace } from "@/components/learner/art/tutor-character";

export default async function LearnerSubjectsPage() {
  const session = await requirePageRole(["learner"]);
  const tSubjects = await getTranslations("learner.subjects");
  const tProgress = await getTranslations("learner.progress");
  const learnerId = session.learnerId;
  if (!learnerId) redirect("/learner/home");

  const { map, skillMasteries } = await getMasteryMap(learnerId, session.tenantId);
  // Render the canonical discoverable set from the brand registry, merged with
  // the BFF-seeded subjects (which carry the DB id + mastery). Every subject is
  // navigable into its detail/lesson flow.
  const discoverable = getDiscoverableSubjects();
  const bffBySlug = new Map((await listSubjects()).map((s) => [s.slug, s]));
  const iep = await getIEPForLearner(learnerId, session.tenantId);
  const baselineNeeded = !map;

  const subjectScore = new Map<string, { score: number; count: number }>();
  for (const sm of skillMasteries) {
    const entry = subjectScore.get(sm.subjectId) ?? { score: 0, count: 0 };
    entry.score += sm.score;
    entry.count += 1;
    subjectScore.set(sm.subjectId, entry);
  }

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <p className="iw-label text-iw-text-muted">{tSubjects("page_eyebrow")}</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          {tSubjects("page_title")}
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          {tSubjects("page_description")}
        </p>
      </header>

      {baselineNeeded ? (
        <div className="rounded-iw-card-lg border border-iw-border bg-white p-6">
          <EmptyState
            title={tSubjects("baseline_needed_title")}
            body={tSubjects("baseline_needed_body")}
            action={
              <Link
                href="/learner/baseline"
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                {tSubjects("baseline_needed_cta")}
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
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {discoverable.map((s) => {
            const bff = bffBySlug.get(s.slug);
            const entry = bff ? subjectScore.get(bff.id) : undefined;
            const avg = entry ? entry.score / entry.count : 0;
            const tutor = tutorForSubjectSlug(s.slug);
            return (
              <SubjectCard
                key={s.slug}
                href={bff ? `/learner/subjects/${bff.id}` : `/learner/subjects/${s.slug}`}
                name={s.name}
                eyebrow={tutor ? `${tutor.name} · ${tutor.landmark}` : undefined}
                masteryLabel={masteryStageLabel(avg, tProgress)}
                masteryPct={Math.round(avg * 100)}
                accent={tutor?.color}
                icon={<TutorFace tutorKey={s.tutorKey} size={40} />}
                nextAction={avg > 0 ? "Pick where to start" : "Start your first skill"}
                support={iep?.confirmedAt ? tSubjects("supports_on") : undefined}
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
