import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button, type ButtonProps } from "@/components/ui/button";
import { StartLearningButton } from "@/components/parent/start-learning-button";

/**
 * The two ways a parent opens a learner's app from the parent surfaces:
 *
 *   1. "Open in parent view" — `enterLearnerHome`: keeps the PARENT session and
 *      sets the active-learner cookie ("Parent · learner view"). No PIN.
 *   2. "Enter as learner" — routes to the PIN hand-off
 *      (`/parent/learners/[id]/enter`), which signs the device in AS the
 *      learner (a true session swap) after the learner's PIN is verified.
 *
 * Shown together for a set-up learner so the parent explicitly chooses who is
 * driving — instead of a single ambiguous "start learning" button.
 */
export async function LearnerEntryButtons({
  learnerId,
  size,
  className,
}: {
  readonly learnerId: string;
  readonly size?: ButtonProps["size"];
  readonly className?: string;
}) {
  const t = await getTranslations("parent.learner_card");
  return (
    <div className={className ?? "flex flex-col gap-2 sm:flex-row sm:items-center"}>
      <StartLearningButton
        learnerId={learnerId}
        label={t("enter_parent_view")}
        size={size}
        variant="outline"
      />
      <Button asChild size={size}>
        <Link href={`/parent/learners/${learnerId}/enter`} data-testid="enter-as-learner-cta">
          <KeyRound className="mr-1 h-4 w-4" /> {t("enter_as_learner")}{" "}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
