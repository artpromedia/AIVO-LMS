"use client";
import { Check } from "lucide-react";
import { ADVENTURE_CHAPTERS, type ChapterResult } from "./types";

interface AdventureMapProps {
  currentChapterIdx: number;
  chapterResults: ChapterResult[];
  totalChapters: number;
}

export default function AdventureMap({
  currentChapterIdx,
  chapterResults,
  totalChapters,
}: AdventureMapProps) {
  const chapters = ADVENTURE_CHAPTERS.slice(0, totalChapters);
  const completedIds = new Set(chapterResults.map((r) => r.chapterId));
  const progressPct = (Math.max(0, currentChapterIdx) / Math.max(1, chapters.length - 1)) * 100;

  return (
    <div className="w-full bg-white border-b-2 border-slate-200/60 backdrop-blur">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="relative flex items-center justify-between">
          <div
            className="absolute top-1/2 left-2 right-2 h-1 -translate-y-1/2 bg-slate-100 rounded-full"
            aria-hidden
          />
          <div
            className="absolute top-1/2 left-2 h-1 -translate-y-1/2 bg-[hsl(262_83%_58%)] rounded-full transition-all duration-700"
            style={{ width: `calc(${progressPct}% * (100% - 16px) / 100%)` }}
            aria-hidden
          />
          {chapters.map((chapter, idx) => {
            const isCompleted = completedIds.has(chapter.id);
            const isCurrent = idx === currentChapterIdx;
            const result = chapterResults.find((cr) => cr.chapterId === chapter.id);
            return (
              <div key={chapter.id} className="relative z-10 flex flex-col items-center gap-1">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border-2 transition-all duration-500 ${
                    isCompleted
                      ? "bg-[hsl(262_83%_58%)] border-[hsl(262_83%_58%)] text-white shadow-md"
                      : isCurrent
                        ? "bg-white border-[hsl(262_83%_58%)] text-[hsl(262_83%_58%)] shadow-md scale-110"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" strokeWidth={3} />
                  ) : (
                    <span aria-hidden>{chapter.landmark.emoji}</span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-extrabold text-center max-w-[72px] leading-tight ${
                    isCompleted
                      ? "text-[hsl(262_83%_58%)]"
                      : isCurrent
                        ? "text-slate-900"
                        : "text-slate-400"
                  }`}
                >
                  {chapter.landmark.label}
                </span>
                {isCompleted && result && (
                  <span className="text-[10px] font-bold text-slate-500">
                    {result.correct}/{result.total}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
