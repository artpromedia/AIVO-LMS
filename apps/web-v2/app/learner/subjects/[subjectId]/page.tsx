import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { getMasteryMap, getSubjectDetail } from "@/lib/db/repos";

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
  const detail = getSubjectDetail(learnerId, session.tenantId, subjectId);
  if (!detail) notFound();

  // If the learner hasn't completed the baseline yet, the mastery map is null
  // and there's no learning path to anchor a "Start lesson" CTA. Render a
  // baseline-first empty state instead of a misleading next-skill prompt.
  const { map } = getMasteryMap(learnerId, session.tenantId);
  if (!map) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow={detail.subject.name}
          title={`Welcome to ${detail.subject.name}`}
          description={detail.subject.description}
        />
        <EmptyState
          title="Finish the baseline first"
          description="Once you've done the baseline check-in, we'll pick the right starting skill for you here."
          action={
            <Button asChild>
              <Link href="/learner/baseline">
                Start baseline <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
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
      <PageHeader
        eyebrow={detail.subject.name}
        title={`Welcome to ${detail.subject.name}`}
        description={detail.subject.description}
        actions={
          <Badge tone="primary" className="capitalize">
            {LEVEL_LABEL[detail.currentLevel] ?? detail.currentLevel}
          </Badge>
        }
      />

      <Card className="flex flex-col gap-3 p-[var(--aivo-density-card-pad)] sm:flex-row sm:items-center">
        <Sparkles className="h-6 w-6 text-aivo-primary" />
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            Your tutor for {detail.subject.name}
          </p>
          <p className="font-display text-lg font-semibold">{detail.recommendedTutorPersona}</p>
        </div>
        {nextSkill ? (
          <Button
            asChild
            // Sprint 10 will introduce LessonRun creation. Until then this links
            // to learner home with the next-skill context so the button is not
            // dead.
          >
            <Link href={`/learner/home?subjectId=${detail.subject.id}&skillId=${nextSkill.id}`}>
              <Play className="mr-1 h-4 w-4" /> Start lesson
            </Link>
          </Button>
        ) : null}
      </Card>

      <SectionHeader title="Next skill" className="mt-6" />
      {nextSkill ? (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">{nextSkill.name}</p>
          <p className="mt-1 text-xs text-aivo-ink-soft">Grade band: {nextSkill.gradeBand}</p>
          {nextSkill.mastery ? (
            <p className="mt-2 text-sm">
              Current mastery:{" "}
              <span className="font-semibold capitalize">
                {nextSkill.mastery.level.replaceAll("_", " ")}
              </span>{" "}
              · {(nextSkill.mastery.score * 100).toFixed(0)}%
            </p>
          ) : (
            <p className="mt-2 text-sm text-aivo-ink-soft">
              No baseline data yet — your first lesson will set the level.
            </p>
          )}
        </Card>
      ) : (
        <EmptyState title="No skills yet" description="Add skills via the seed." />
      )}

      <SectionHeader title="Recommended lessons" className="mt-6" />
      {subjectNodes.length === 0 ? (
        <EmptyState
          title="No path nodes for this subject yet"
          description="Finish the baseline and we'll suggest the right starting point."
          action={
            <Button asChild>
              <Link href="/learner/baseline">
                Start baseline <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {subjectNodes.map((node) => {
            const skill = detail.skills.find((s) => s.id === node.skillId);
            return (
              <Card key={node.id} className="flex items-start gap-3 p-4">
                <Badge tone="primary">{KIND_LABEL[node.kind] ?? node.kind}</Badge>
                <div className="flex-1 text-sm">
                  <p className="font-semibold">{skill?.name ?? "Skill"}</p>
                  <p className="mt-1 text-xs text-aivo-ink-soft">{node.reason}</p>
                </div>
                <span className="shrink-0 text-xs text-aivo-ink-soft">
                  ~{node.estimatedMinutes} min
                </span>
              </Card>
            );
          })}
        </div>
      )}

      <SectionHeader title="All skills in this subject" className="mt-8" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {detail.skills.map((s) => (
          <Card key={s.id} className="p-4">
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="mt-1 text-xs text-aivo-ink-soft">{s.gradeBand}</p>
            <Badge tone={s.mastery ? "primary" : "neutral"} className="mt-2 capitalize">
              {s.mastery ? s.mastery.level.replaceAll("_", " ") : "not measured"}
            </Badge>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
