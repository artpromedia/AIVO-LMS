"use client";
import Image from "next/image";
import { TUTORS } from "@aivo/brand";
import { ADVENTURE_CHAPTERS } from "./types";

interface AdventureMapPreviewProps {
  totalChapters: number;
  learnerName: string;
  onClose: () => void;
  lightMode?: boolean;
}

export default function AdventureMapPreview({
  totalChapters,
  learnerName,
  onClose,
  lightMode = false,
}: AdventureMapPreviewProps) {
  const chapters = ADVENTURE_CHAPTERS.slice(0, totalChapters);
  const textPrimary = lightMode ? "text-slate-900" : "text-white";
  const textSecondary = lightMode ? "text-slate-500" : "text-white/60";
  const bgClass = lightMode
    ? "from-amber-50 via-white to-purple-50"
    : "from-indigo-950 via-purple-950 to-slate-950";

  return (
    <div
      className={`fixed inset-0 bg-gradient-to-br ${bgClass} flex flex-col items-center justify-center overflow-auto`}
    >
      <div className="relative z-10 text-center px-6 py-12 max-w-2xl w-full">
        <h1 className={`text-3xl font-heading font-bold ${textPrimary} mb-2`}>
          Your Adventure Map
        </h1>
        <p className={`${textSecondary} mb-8`}>
          {learnerName}, here&apos;s what your adventure looks like!
        </p>

        <div className="relative">
          <div
            className={`absolute left-1/2 top-0 bottom-0 w-0.5 ${lightMode ? "bg-purple-200" : "bg-white/10"} -translate-x-1/2`}
          />

          <div className="space-y-6">
            {chapters.map((chapter, idx) => {
              const tutor = TUTORS[chapter.tutorKey];
              const isLeft = idx % 2 === 0;

              return (
                <div
                  key={chapter.id}
                  className={`relative flex items-center gap-4 ${isLeft ? "flex-row" : "flex-row-reverse"}`}
                >
                  <div className={`flex-1 ${isLeft ? "text-right" : "text-left"}`}>
                    <div
                      className={`inline-block ${lightMode ? "bg-white border border-slate-200" : "bg-white/10 backdrop-blur border border-white/10"} rounded-2xl p-4 max-w-[240px]`}
                    >
                      <p className={`font-heading font-bold ${textPrimary} text-sm`}>
                        {chapter.title}
                      </p>
                      <p className={`text-xs ${textSecondary} mt-1`}>with {tutor.name}</p>
                    </div>
                  </div>

                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="w-14 h-14 rounded-full overflow-hidden border-3 shadow-lg"
                      style={{ borderColor: tutor.color, boxShadow: `0 0 20px ${tutor.color}30` }}
                    >
                      <Image
                        src={tutor.avatar}
                        alt={tutor.name}
                        width={56}
                        height={56}
                        className="object-cover"
                      />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-xs font-bold text-slate-700">
                      {idx + 1}
                    </div>
                  </div>

                  <div className="flex-1" />
                </div>
              );
            })}

            <div className="relative flex items-center justify-center">
              <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl flex items-center justify-center text-3xl">
                🏆
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-10 px-10 py-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xl font-heading font-bold shadow-2xl shadow-amber-500/30 hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-400"
          style={{ minHeight: "var(--learner-hit-target, 56px)" }}
        >
          I&apos;m ready to start! 🚀
        </button>
      </div>
    </div>
  );
}
