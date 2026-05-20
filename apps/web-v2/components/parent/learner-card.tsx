import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { READINESS_LABEL, READINESS_TONE, nextStepFor } from "@/lib/learner/readiness";
import type { LearnerProfile } from "@/lib/db/types";

export function LearnerCard({ learner }: { learner: LearnerProfile }) {
  const next = nextStepFor(learner);
  const tone = READINESS_TONE[learner.readinessState];
  return (
    <Card className="group relative flex flex-col gap-5 overflow-hidden rounded-iw-hero border-0 bg-white p-7 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.22)] transition-shadow hover:shadow-[0_40px_100px_-40px_rgba(124,58,237,0.28)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-[var(--aivo-color-aivoPurple-100,#ede9fe)] to-[var(--aivo-color-aivoTeal-100,#ccfbf1)] opacity-80 blur-2xl"
      />
      <div className="relative flex items-center gap-4">
        <div className="rounded-full bg-gradient-to-br from-[var(--aivo-color-aivoPurple-100,#ede9fe)] to-[var(--aivo-color-aivoTeal-100,#ccfbf1)] p-[3px]">
          <LearnerAvatar name={learner.displayName} size="md" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-iw-display text-2xl font-bold tracking-tight text-iw-text-strong">
            {learner.displayName}
          </p>
          <p className="text-sm text-iw-text-muted">
            Age {new Date().getFullYear() - learner.birthYear}
            {learner.gradeBand ? ` · Grade ${learner.gradeBand}` : ""}
            {learner.pronouns ? ` · ${learner.pronouns}` : ""}
          </p>
        </div>
      </div>
      <div className="relative flex flex-wrap gap-2">
        <Badge tone={tone}>{READINESS_LABEL[learner.readinessState]}</Badge>
        {learner.functioningLevel ? (
          <Badge tone="neutral">{learner.functioningLevel.replace("_", " ")}</Badge>
        ) : null}
      </div>
      <div className="relative mt-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" size="sm">
          <Link href={`/parent/learners/${learner.id}`}>Open profile</Link>
        </Button>
        <Button asChild size="sm">
          <Link href={next.href}>
            {next.label} <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
