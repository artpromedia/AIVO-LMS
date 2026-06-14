import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { LearnerEntryButtons } from "@/components/parent/learner-entry-buttons";
import { READINESS_LABEL_KEY, READINESS_TONE, nextStepFor } from "@/lib/learner/readiness";
import type { LearnerProfile } from "@/lib/db/types";

export async function LearnerCard({ learner }: { learner: LearnerProfile }) {
  const t = await getTranslations("parent.readiness");
  const tCard = await getTranslations("parent.learner_card");
  const next = nextStepFor(learner);
  const tone = READINESS_TONE[learner.readinessState];
  const age = new Date().getFullYear() - learner.birthYear;
  const meta = [
    tCard("age", { age }),
    learner.gradeBand ? tCard("grade", { grade: learner.gradeBand }) : null,
    learner.pronouns ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card className="group relative flex flex-col gap-5 overflow-hidden rounded-iw-hero border-0 bg-white p-7 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.22)] transition-shadow hover:shadow-[0_40px_100px_-40px_rgba(124,58,237,0.28)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-[var(--aivo-aivoPurple-100)] to-[var(--aivo-aivoTeal-100)] opacity-80 blur-2xl"
      />
      <div className="relative flex items-center gap-4">
        <div className="rounded-full bg-gradient-to-br from-[var(--aivo-aivoPurple-100)] to-[var(--aivo-aivoTeal-100)] p-[3px]">
          <LearnerAvatar name={learner.displayName} size="md" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-iw-display text-2xl font-bold tracking-tight text-iw-text-strong">
            {learner.displayName}
          </p>
          <p className="text-sm text-iw-text-muted">{meta}</p>
        </div>
      </div>
      <div className="relative flex flex-wrap gap-2">
        <Badge tone={tone}>{t(READINESS_LABEL_KEY[learner.readinessState])}</Badge>
        {learner.functioningLevel ? (
          <Badge tone="neutral">{learner.functioningLevel.replace("_", " ")}</Badge>
        ) : null}
      </div>
      <div className="relative mt-auto flex flex-col gap-2">
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href={`/parent/learners/${learner.id}`}>{tCard("open_profile")}</Link>
        </Button>
        {learner.readinessState === "ready_for_today_mission" ? (
          // A set-up learner: offer both entry paths — "Open in parent view"
          // (keeps the parent session) and "Enter as learner" (PIN-gated
          // session swap). Both Server-Action paths enforce parent↔learner
          // authorization regardless of readiness.
          <LearnerEntryButtons learnerId={learner.id} size="sm" />
        ) : (
          <Button asChild size="sm" className="self-start">
            <Link href={next.href}>
              {t(next.labelKey)} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
