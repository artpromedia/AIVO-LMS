/**
 * Sprint 7: Subjects-all page redesign.
 *
 * Renders every subject as a SubjectCard with a mastery ring + next
 * action chip. Empty state (no baseline yet) routes the learner to
 * /learner/baseline so they don't see hollow cards.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { isSubjectComingSoon } from "@/lib/feature-flags";

function masteryLabel(score: number): string {
  if (score >= 0.85) return "Strong";
  if (score >= 0.65) return "On grade";
  if (score >= 0.4) return "Building";
  if (score > 0) return "Just starting";
  return "Not started";
}

export default async function LearnerSubjectsPage() {
  const session = await requirePageRole(["learner"]);
  const learnerId = session.learnerId;
  if (!learnerId) redirect("/learner/home");

  const { map, skillMasteries } = getMasteryMap(learnerId, session.tenantId);
  const subjects = listSubjects();
  const iep = getIEPForLearner(learnerId, session.tenantId);
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
        <p className="iw-label text-iw-text-muted">All subjects</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          Pick a subject
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-2xl">
          Each subject has a tutor and a recommended next step. Tap a card to dive in.
        </p>
      </header>

      {baselineNeeded ? (
        <div className="rounded-iw-card-lg border border-iw-border bg-white p-6">
          <EmptyState
            title="Finish the baseline first"
            body="Your subject pages light up after you complete a quick baseline check-in."
            action={
              <Link
                href="/learner/baseline"
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                Start baseline
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
            const comingSoon = isSubjectComingSoon(s.slug);
            return (
              <SubjectCard
                key={s.id}
                href={comingSoon ? "#" : `/learner/subjects/${s.id}`}
                name={s.name}
                eyebrow={tutor ? `${tutor.name} · ${tutor.landmark}` : undefined}
                masteryLabel={comingSoon ? "Coming soon" : masteryLabel(avg)}
                masteryPct={comingSoon ? 0 : Math.round(avg * 100)}
                accent={tutor?.color}
                icon={tutor?.emoji ?? "📘"}
                nextAction={
                  comingSoon
                    ? "Content is on the way"
                    : avg > 0
                      ? "Pick where to start"
                      : "Start your first skill"
                }
                support={
                  comingSoon
                    ? "Coming soon"
                    : iep?.confirmedAt
                      ? "Supports on"
                      : undefined
                }
                locked={comingSoon}
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
