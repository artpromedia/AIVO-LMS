"use client";

/**
 * Sprint 15 — tutor-identity celebrate beat: the tutor's signature
 * celebrate line rides above the plan's encouragement, in the accent ink
 * on the soft wash with an accent border. Same contract as the welcome
 * beat: vars carry neutral fallbacks (high-contrast suppression happens
 * in the shell), the reduced portrait variant follows the motion state,
 * and no animation is added to the existing layout.
 */
import { useTranslations } from "next-intl";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { MathText } from "@/components/learning/math-text";

export interface CelebrateBeatProps {
  body: string;
  tutorSlug: TutorKey | null;
  motionOff: boolean;
}

export function CelebrateBeat({ body, tutorSlug, motionOff }: CelebrateBeatProps) {
  const t = useTranslations("learner.tutor_lines");
  if (!tutorSlug) {
    return (
      <p className="font-display text-2xl">
        <MathText>{body}</MathText>
      </p>
    );
  }
  const tutor = TUTORS[tutorSlug];
  const portrait = motionOff ? tutor.avatarReduced : tutor.avatar;
  return (
    <div className="space-y-4" data-testid="celebrate-beat">
      <div className="flex items-center gap-3 rounded-xl border-2 border-[color:var(--tutor-accent,transparent)] bg-[color:var(--tutor-accent-soft,transparent)] px-4 py-3">
        <img
          src={portrait}
          alt=""
          aria-hidden="true"
          width={48}
          height={48}
          data-testid="tutor-portrait"
          className="h-12 w-12 shrink-0 rounded-full bg-aivo-surface-2 object-cover"
        />
        <p
          className="font-display text-lg text-[color:var(--tutor-accent-ink,inherit)]"
          data-testid="tutor-celebrate-line"
        >
          {t(`${tutorSlug}.celebrate`)}
        </p>
      </div>
      <p className="font-display text-2xl">
        <MathText>{body}</MathText>
      </p>
    </div>
  );
}
