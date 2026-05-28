/**
 * Subjects-all page.
 *
 * Renders only production-ready subjects (`productionReady === true` in
 * `@aivo/brand`'s LEARNER_SUBJECTS). Non-ready subjects are hidden from
 * the learner grid until their curriculum + item bank lands; we no
 * longer ship a "Coming soon" placeholder card (route-audit gate).
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
import {
  getIEPForLearner,
  getMasteryMap,
  listSubjects,
} from "@/lib/db/repos";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";
import { getProductionReadySubjects } from "@aivo/brand";

function masteryLabel(score: number, t: (key: string) => string): string {
  if (score >= 0.85) return t("mastery_strong");
  if (score >= 0.65) return t("mastery_on_grade");
  if (score >= 0.4) return t("mastery_building");
  if (score > 0) return t("mastery_just_starting");
  return t("mastery_not_started");
}

export default async function LearnerSubjectsPage() {
  const session = await requirePageRole(["learner"]);
  const tSubjects = await getTranslations("learner.subjects");
  const tProgress = await getTranslations("learner.progress");
  const learnerId = session.learnerId;
  if (!learnerId) redirect("/learner/home");

  const { map, skillMasteries } = await getMasteryMap(learnerId, session.tenantId);
  // Intersect BFF-seeded subjects with the brand registry's production-
  // ready set so non-ready slugs (currently world-languages, coding,
  // and the other content-team-WIP rows) never reach the learner UI.
  const productionReadySlugs = new Set(getProductionReadySubjects().map((s) => s.slug));
  const subjects = (await listSubjects()).filter((s) => productionReadySlugs.has(s.slug));
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
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 5 7 7-7 7" />
                </svg>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const entry = subjectScore.get(s.id);
            const avg = entry ? entry.score / entry.count : 0;
            const tutor = tutorForSubjectSlug(s.slug);
            return (
              <SubjectCard
                key={s.id}
                href={`/learner/subjects/${s.id}`}
                name={s.name}
                eyebrow={tutor ? `${tutor.name} · ${tutor.landmark}` : undefined}
                masteryLabel={masteryLabel(avg, tProgress)}
                masteryPct={Math.round(avg * 100)}
                accent={tutor?.color}
                icon={tutor?.emoji ?? "📘"}
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
