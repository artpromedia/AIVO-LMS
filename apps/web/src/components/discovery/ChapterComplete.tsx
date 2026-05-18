"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Trophy, Sparkles, ChevronRight } from "lucide-react";
import { TUTORS } from "@aivo/brand";
import type { AdventureChapter, ChapterResult } from "./types";
import { IconWell, colorForTutor, VI_COLOR, VI_TINT } from "./_vi";

interface ChapterCompleteProps {
  chapter: AdventureChapter;
  result: ChapterResult;
  isLastChapter: boolean;
  onContinue: () => void;
}

export default function ChapterComplete({
  chapter,
  result,
  isLastChapter,
  onContinue,
}: ChapterCompleteProps) {
  const [show, setShow] = useState(false);
  const tutor = TUTORS[chapter.tutorKey];
  const subjectKey = colorForTutor(tutor?.color);
  const subjectColor = VI_COLOR[subjectKey];
  const subjectTint = VI_TINT[subjectKey];

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 vi-bg tier-scene-bg flex items-center justify-center overflow-y-auto py-8">
      <div
        className={`relative w-full max-w-md mx-auto px-6 transition-all duration-700 ${show ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
      >
        <section
          className="vi-card p-8 text-center relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, white, ${subjectTint})`,
            borderColor: `${subjectColor}26`,
          }}
        >
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl"
            style={{ backgroundColor: `${subjectColor}26` }}
            aria-hidden
          />
          <div className="relative">
            <div
              className="w-20 h-20 rounded-3xl overflow-hidden border-4 shadow-md mx-auto mb-4"
              style={{ borderColor: subjectColor }}
            >
              <Image
                src={tutor.avatar}
                alt={tutor.name}
                width={80}
                height={80}
                className="object-cover"
              />
            </div>

            <div className="mx-auto mb-3 inline-flex">
              <IconWell color={subjectKey} size="md">
                <Trophy className="w-7 h-7" strokeWidth={2.5} />
              </IconWell>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Chapter Complete!</h2>
            <p className="text-slate-600 text-sm mb-6">{chapter.transitionLine}</p>

            <div
              className="vi-card p-4 mb-6"
              style={{ background: subjectTint, borderColor: `${subjectColor}26` }}
            >
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color: subjectColor }}>
                    {result.correct}/{result.total}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Correct
                  </p>
                </div>
                <div className="w-px h-10 bg-slate-200" />
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-[hsl(262_83%_58%)]">
                    +{result.correct * 10}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    XP
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onContinue}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white font-extrabold text-lg shadow-xl hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
              style={{ backgroundColor: subjectColor, boxShadow: `0 8px 24px ${subjectColor}40` }}
            >
              {isLastChapter ? (
                <>
                  See Results <Sparkles className="w-5 h-5" />
                </>
              ) : (
                <>
                  Next Chapter <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
