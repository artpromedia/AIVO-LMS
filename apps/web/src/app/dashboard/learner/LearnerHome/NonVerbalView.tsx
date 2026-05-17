"use client";
import Image from "next/image";
import { Cloud } from "lucide-react";
import { TUTORS } from "@aivo/brand";
import type { NextAction } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";

interface NonVerbalViewProps {
  action: NextAction | null;
  onStart: () => void;
  onBreak: () => void;
}

export function NonVerbalView({ action, onStart, onBreak }: NonVerbalViewProps) {
  const tutorKey = action?.tutorKey || "nova";
  const tutor = TUTORS[tutorKey as keyof typeof TUTORS] || TUTORS.nova;
  const t = useTranslations("learner");

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 gap-8">
      <button
        onClick={onStart}
        className="w-full max-w-sm rounded-3xl p-10 shadow-lg border-4 text-center hover:shadow-2xl transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-4 active:scale-[0.97]"
        style={{
          borderColor: tutor.color,
          background: `linear-gradient(135deg, ${tutor.color}10, ${tutor.color}25)`,
          minHeight: "var(--learner-hit-target, 88px)",
        }}
      >
        <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden shadow-xl mb-4" style={{ borderColor: tutor.color, borderWidth: "5px" }}>
          <Image src={tutor.avatar} alt={tutor.name} fill className="object-cover object-top" sizes="128px" />
        </div>
        <div className="text-2xl font-heading font-bold" style={{ color: tutor.color }}>
          {action?.title || t("play_with_tutor", { name: tutor.name })}
        </div>
      </button>

      <button
        onClick={onBreak}
        className="w-full max-w-sm rounded-2xl p-6 bg-sky-50 border-2 border-sky-200 text-center hover:bg-sky-100 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sky-400"
        style={{ minHeight: "var(--learner-hit-target, 88px)" }}
      >
        <Cloud className="w-12 h-12 mx-auto mb-2 text-sky-400" strokeWidth={2} aria-hidden="true" />
        <span className="text-xl font-heading font-bold text-sky-700">{t("take_a_break")}</span>
      </button>
    </div>
  );
}
