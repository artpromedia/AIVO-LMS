import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import {
  READINESS_LABEL,
  READINESS_TONE,
  nextStepFor,
} from "@/lib/learner/readiness";
import type { LearnerProfile } from "@/lib/db/types";

export function LearnerCard({ learner }: { learner: LearnerProfile }) {
  const next = nextStepFor(learner);
  const tone = READINESS_TONE[learner.readinessState];
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <LearnerAvatar name={learner.displayName} size="md" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">
            {learner.displayName}
          </p>
          <p className="text-xs text-aivo-ink-soft">
            Age {new Date().getFullYear() - learner.birthYear}
            {learner.gradeBand ? ` · Grade ${learner.gradeBand}` : ""}
            {learner.pronouns ? ` · ${learner.pronouns}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={tone}>{READINESS_LABEL[learner.readinessState]}</Badge>
        {learner.functioningLevel ? (
          <Badge tone="neutral">{learner.functioningLevel.replace("_", " ")}</Badge>
        ) : null}
      </div>
      <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
