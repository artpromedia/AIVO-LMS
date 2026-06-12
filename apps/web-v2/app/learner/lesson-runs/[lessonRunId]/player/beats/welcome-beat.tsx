"use client";

/**
 * Sprint 15 — tutor-identity welcome beat.
 *
 * "Nova's world" and "Sage's world" must be distinguishable in five
 * seconds: the welcome beat shows the owning tutor's portrait (Sprint 06
 * art; `-reduced` variant whenever motion is off per the sensory rules),
 * the tutor's signature line in the derived accent ink on its soft wash,
 * and then the plan's generated greeting. Without a resolved tutor it
 * renders exactly the pre-Sprint-15 static treatment.
 *
 * Contrast safety: every accent consumes a `--tutor-accent*` var with a
 * neutral fallback — in high-contrast mode the shell withholds the vars,
 * so this beat degrades to the plain palette with zero per-beat logic.
 * Theming adds no animation.
 */
import { useTranslations } from "next-intl";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { MathText } from "@/components/learning/math-text";

export interface WelcomeBeatProps {
  body: string;
  tutorSlug: TutorKey | null;
  /** Sensory motion state — picks the reduced portrait variant. */
  motionOff: boolean;
}

export function WelcomeBeat({ body, tutorSlug, motionOff }: WelcomeBeatProps) {
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
    <div className="space-y-4" data-testid="welcome-beat">
      <div className="flex items-center gap-4">
        <img
          src={portrait}
          alt=""
          aria-hidden="true"
          width={72}
          height={72}
          data-testid="tutor-portrait"
          className="h-18 w-18 shrink-0 rounded-full border-2 border-[color:var(--tutor-accent,transparent)] bg-aivo-surface-2 object-cover"
        />
        <p
          className="rounded-xl bg-[color:var(--tutor-accent-soft,transparent)] px-4 py-2 font-display text-lg text-[color:var(--tutor-accent-ink,inherit)]"
          data-testid="tutor-welcome-line"
        >
          {t(`${tutorSlug}.welcome`)}
        </p>
      </div>
      <p className="font-display text-2xl">
        <MathText>{body}</MathText>
      </p>
    </div>
  );
}
