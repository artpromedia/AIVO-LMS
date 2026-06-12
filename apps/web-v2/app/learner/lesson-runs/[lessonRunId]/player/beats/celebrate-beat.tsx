"use client";

/**
 * Sprint 15 — tutor-identity celebrate beat: the tutor's signature
 * celebrate line rides above the plan's encouragement, in the accent ink
 * on the soft wash with an accent border.
 *
 * Phase 2 adds a *designed* completion moment: a sound-gated chime (the My
 * Workspace Sound control governs it; Off = silence) and a motion-gated
 * sparkle burst behind the tutor portrait. Both collapse cleanly — when
 * `motionOff` the burst is not rendered and the static, fully-legible
 * celebration reads on its own. Existing testids/markup are preserved.
 */
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { MathText } from "@/components/learning/math-text";
import { useChime } from "@/lib/learner/use-chime";

export interface CelebrateBeatProps {
  body: string;
  tutorSlug: TutorKey | null;
  motionOff: boolean;
}

function SparkleBurst() {
  return (
    <span className="lx-burst" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} style={{ ["--a" as string]: `${i * 30}deg` }} />
      ))}
    </span>
  );
}

export function CelebrateBeat({ body, tutorSlug, motionOff }: CelebrateBeatProps) {
  const t = useTranslations("learner.tutor_lines");
  const chime = useChime();
  const played = useRef(false);

  // One warm completion chime when the celebrate beat first appears. Gated by
  // data-sound inside useChime (Off = nothing scheduled).
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    chime.complete();
  }, [chime]);

  if (!tutorSlug) {
    return (
      <div className="relative">
        {!motionOff && <SparkleBurst />}
        <p className="font-display text-2xl">
          <MathText>{body}</MathText>
        </p>
      </div>
    );
  }

  const tutor = TUTORS[tutorSlug];
  const portrait = motionOff ? tutor.avatarReduced : tutor.avatar;
  return (
    <div className="space-y-4" data-testid="celebrate-beat">
      <div className="relative flex items-center gap-3 rounded-xl border-2 border-[color:var(--tutor-accent,transparent)] bg-[color:var(--tutor-accent-soft,transparent)] px-4 py-3">
        {!motionOff && <SparkleBurst />}
        <img
          src={portrait}
          alt=""
          aria-hidden="true"
          width={48}
          height={48}
          data-testid="tutor-portrait"
          className={`relative h-12 w-12 shrink-0 rounded-full bg-aivo-surface-2 object-cover ${
            motionOff ? "" : "lx-check-pop"
          }`}
        />
        <p
          className="relative font-display text-lg text-[color:var(--tutor-accent-ink,inherit)]"
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
