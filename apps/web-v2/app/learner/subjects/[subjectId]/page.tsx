/**
 * Sprint 7: Subject detail page redesign.
 *
 * Replaces the dense Card/Badge stack with calm soft-glass panels:
 * a tutor hero card, a "next up" focus card, a soft path strip, and
 * a per-skill list that uses InsightChips for status.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  TodayFocusCard,
  GlassCard,
  InsightChip,
  EmptyState,
} from "@aivo/ui";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  getIEPForLearner,
  getMasteryMap,
  getSubjectDetail,
} from "@/lib/db/repos";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";

const LEVEL_LABEL: Record<string, string> = {
  not_started: "Not started yet",
  emerging: "Just starting",
  approaching: "Growing",
  on_grade_level: "On track",
  stretching: "Stretching",
};

const KIND_LABEL: Record<string, string> = {
  first_skill: "Start here",
  next_unmastered: "Next up",
  review: "Quick review",
  stretch: "Stretch goal",
};

export default async function LearnerSubjectDetailPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const session = await requirePageRole(["learner"]);
  const learnerId = session.learnerId;
  if (!learnerId) redirect("/learner/home");

  const { subjectId } = await params;
  const detail = await getSubjectDetail(learnerId, session.tenantId, subjectId);
  if (!detail) notFound();

  const { map } = await getMasteryMap(learnerId, session.tenantId);
  const iep = await getIEPForLearner(learnerId, session.tenantId);
  const tutor = tutorForSubjectSlug(detail.subject.slug);
  const accent = tutor?.color ?? "var(--aivo-sensory-primary)";

  if (!map) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <header className="flex flex-col gap-2 mb-6">
          <p className="iw-label text-iw-text-muted">{detail.subject.name}</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
            Welcome to {detail.subject.name}
          </h1>
          <p className="text-sm text-iw-text-muted max-w-2xl">{detail.subject.description}</p>
        </header>
        <div className="rounded-iw-card-lg border border-iw-border bg-white p-6">
          <EmptyState
            title="Finish the baseline first"
            body="Once you've done the baseline check-in, we'll pick the right starting skill for you here."
            action={
              <Link
                href="/learner/baseline"
                className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
              >
                Start baseline
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const nextSkill = detail.skills.find((s) => s.id === detail.nextSkillId) ?? null;
  const subjectNodes = detail.pathNodesForSubject;

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-3">
          <span
            className="w-14 h-14 rounded-iw-control inline-flex items-center justify-center text-3xl"
            style={{ backgroundColor: `${accent}1A`, color: accent }}
            aria-hidden="true"
          >
            {tutor?.emoji ?? "📘"}
          </span>
          <div>
            <p className="iw-label text-iw-text-muted">{detail.subject.name}</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong leading-tight">
              {tutor ? `${detail.subject.name} with ${tutor.name}` : detail.subject.name}
            </h1>
          </div>
        </div>
        <p className="text-sm text-iw-text-muted max-w-2xl">{detail.subject.description}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <InsightChip tone="primary" size="md">
            {LEVEL_LABEL[detail.currentLevel] ?? detail.currentLevel.replaceAll("_", " ")}
          </InsightChip>
          {iep?.confirmedAt ? (
            <InsightChip tone="accent" size="md">
              IEP supports on
            </InsightChip>
          ) : null}
          {tutor ? (
            <InsightChip tone="warm" size="md">
              {tutor.landmark}
            </InsightChip>
          ) : null}
        </div>
      </header>

      {nextSkill ? (
        <TodayFocusCard
          eyebrow="Next up"
          title={nextSkill.name}
          body={
            nextSkill.mastery
              ? `You're at ${(nextSkill.mastery.score * 100).toFixed(0)}% — let's keep going.`
              : "Your first lesson here will set the level — no pressure."
          }
          accent={accent}
          companion={
            <span
              className="w-12 h-12 rounded-full inline-flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${accent}1A`, color: accent }}
              aria-hidden="true"
            >
              {tutor?.emoji ?? "✨"}
            </span>
          }
          meta={
            <>
              <InsightChip tone="primary" size="md">
                {nextSkill.gradeBand}
              </InsightChip>
              <InsightChip tone="info" size="md">
                Read-aloud available
              </InsightChip>
            </>
          }
          action={
            <Link
              href={`/learner/home?subjectId=${detail.subject.id}&skillId=${nextSkill.id}`}
              className="inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              style={{ backgroundColor: accent }}
            >
              Start lesson
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </Link>
          }
        />
      ) : null}

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">Recommended path</h2>
        {subjectNodes.length === 0 ? (
          <div className="rounded-iw-card-lg border border-iw-border bg-white p-6">
            <EmptyState
              title="No path nodes yet"
              body="Finish the baseline and we'll suggest the right starting point."
              action={
                <Link
                  href="/learner/baseline"
                  className="inline-flex items-center gap-2 rounded-iw-control px-4 py-2 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110"
                >
                  Start baseline
                </Link>
              }
            />
          </div>
        ) : (
          <ol className="grid gap-3 md:grid-cols-2">
            {subjectNodes.map((node, i) => {
              const skill = detail.skills.find((s) => s.id === node.skillId);
              return (
                <li
                  key={node.id}
                  className="flex items-start gap-3 rounded-iw-card-lg border border-iw-border bg-white p-4"
                >
                  <span
                    className="shrink-0 w-9 h-9 rounded-iw-control flex items-center justify-center text-sm font-bold tabular-nums"
                    style={{ backgroundColor: `${accent}1A`, color: accent }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <InsightChip tone="primary" size="sm">
                        {KIND_LABEL[node.kind] ?? node.kind.replaceAll("_", " ")}
                      </InsightChip>
                      <span className="text-xs text-iw-text-muted">
                        ~{node.estimatedMinutes} min
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-iw-text-strong">
                      {skill?.name ?? "Skill"}
                    </p>
                    <p className="text-xs text-iw-text-muted leading-relaxed">{node.reason}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-iw-text-strong">All skills</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detail.skills.map((s) => (
            <GlassCard key={s.id} elevation="raised" density="compact" radius="card">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-iw-text-strong">{s.name}</p>
                <p className="text-xs text-iw-text-muted">{s.gradeBand}</p>
                <InsightChip
                  tone={s.mastery ? "primary" : "neutral"}
                  size="sm"
                  className="self-start capitalize"
                >
                  {s.mastery ? s.mastery.level.replaceAll("_", " ") : "not measured"}
                </InsightChip>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
