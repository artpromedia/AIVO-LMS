"use client";

/**
 * Shared answer-feedback callout for the interactive beats (check + guided).
 *
 * Keeps the existing localized message (passed as children) and the
 * emerald/rose semantics, but gives the moment character: a tutor-tinted
 * reaction badge and a gentle pop-in. Correct earns a check that pops;
 * "not quite" is never shaming — the tutor character cheers the learner on,
 * matching the warm, second-person copy already in the catalog.
 *
 * Motion is applied ONLY when `motionOff` is false; calm / high-contrast /
 * reduced-motion render the identical static, fully-legible callout. The
 * accompanying chime is fired by the player (use-chime), gated by data-sound.
 */
import { Check } from "lucide-react";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { TutorCharacter } from "@/components/learner/art/tutor-character";

export function AnswerFeedback({
  tone,
  motionOff,
  tutorSlug,
  children,
}: {
  tone: "correct" | "incorrect";
  motionOff: boolean;
  tutorSlug: TutorKey | null;
  children: React.ReactNode;
}) {
  const correct = tone === "correct";
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl p-3 text-sm ${
        correct ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
      } ${motionOff ? "" : "lx-pop-in"}`}
      data-feedback={tone}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          correct ? "bg-emerald-100" : "bg-white/70"
        } ${correct && !motionOff ? "lx-check-pop" : ""}`}
        aria-hidden="true"
      >
        {correct ? (
          <Check size={20} className="text-emerald-700" strokeWidth={3} />
        ) : tutorSlug ? (
          <TutorCharacter color={TUTORS[tutorSlug].color} size={34} />
        ) : (
          <span className="text-base">💪</span>
        )}
      </span>
      <p className="self-center">{children}</p>
    </div>
  );
}
