"use client";
import { useState } from "react";
import Image from "next/image";
import { Play, RotateCw, Users, ChevronRight } from "lucide-react";
import { TUTORS } from "@aivo/brand";
import type { AdventureChapter } from "./types";
import { colorForTutor, VI_COLOR, VI_TINT } from "./_vi";

interface ChapterIntroProps {
  chapter: AdventureChapter;
  chapterNumber: number;
  totalChapters: number;
  onReady: () => void;
  onBringGrownUp?: () => void;
  lightMode?: boolean;
}

export default function ChapterIntro({ chapter, chapterNumber, totalChapters, onReady, onBringGrownUp }: ChapterIntroProps) {
  const [phase, setPhase] = useState<"intro" | "ready">("intro");
  const tutor = TUTORS[chapter.tutorKey];
  const subjectKey = colorForTutor(tutor?.color);
  const subjectColor = VI_COLOR[subjectKey];
  const subjectTint = VI_TINT[subjectKey];

  if (phase === "ready") {
    return (
      <div className="fixed inset-0 vi-bg tier-scene-bg flex flex-col items-center justify-center overflow-y-auto py-8 pt-20">
        <div className="relative w-full max-w-md mx-auto px-6">
          <section className="vi-card p-8 text-center" style={{ borderColor: `${subjectColor}26` }}>
            <div className="mx-auto mb-5 inline-flex">
              <div className="w-20 h-20 rounded-3xl overflow-hidden border-4 shadow-md" style={{ borderColor: subjectColor }}>
                <Image src={tutor.avatar} alt={tutor.name} width={80} height={80} className="object-cover" />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: subjectColor }}>Ready?</p>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Let&apos;s Begin</h2>
            <p className="text-slate-600 mb-6">{tutor.name} will guide you through this chapter.</p>

            <div className="space-y-3 max-w-xs mx-auto">
              <button
                onClick={onReady}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full text-white font-extrabold text-lg shadow-xl hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
                style={{ backgroundColor: subjectColor, boxShadow: `0 8px 24px ${subjectColor}40`, minHeight: "var(--learner-hit-target, 56px)" }}
              >
                <Play className="w-5 h-5 fill-white" /> Start
              </button>
              <button
                onClick={() => setPhase("intro")}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white border-2 border-slate-200 text-slate-700 font-bold text-sm hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                style={{ minHeight: "var(--learner-hit-target, 48px)" }}
              >
                <RotateCw className="w-4 h-4" /> Hear it again
              </button>
              {onBringGrownUp && (
                <button
                  onClick={onBringGrownUp}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[hsl(340_82%_52%/0.1)] text-[hsl(340_82%_52%)] font-bold text-sm hover:bg-[hsl(340_82%_52%/0.16)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(340_82%_52%)]"
                  style={{ minHeight: "var(--learner-hit-target, 48px)" }}
                >
                  <Users className="w-4 h-4" /> Bring my grown-up
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 vi-bg tier-scene-bg flex flex-col items-center justify-center overflow-y-auto py-8 pt-20">
      <div className="relative w-full max-w-md mx-auto px-6">
        <section
          className="vi-card p-8 text-center relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, white, ${subjectTint})`, borderColor: `${subjectColor}26` }}
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl" style={{ backgroundColor: `${subjectColor}26` }} aria-hidden />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
              Chapter {chapterNumber} of {totalChapters}
            </p>
            <div className="text-6xl mb-3" aria-hidden>{chapter.landmark.emoji}</div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-1">{chapter.title}</h1>
            <p className="text-lg text-slate-600 mb-6">{chapter.subtitle}</p>

            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-4 shadow-md" style={{ borderColor: subjectColor }}>
                <Image src={tutor.avatar} alt={tutor.name} width={64} height={64} className="object-cover" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your guide</p>
                <p className="font-extrabold text-slate-900">{tutor.name}</p>
              </div>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed max-w-xs mx-auto mb-6">{chapter.sceneDescription}</p>

            <button
              onClick={() => setPhase("ready")}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white font-extrabold text-lg shadow-xl hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
              style={{ backgroundColor: subjectColor, boxShadow: `0 8px 24px ${subjectColor}40`, minHeight: "var(--learner-hit-target, 56px)" }}
            >
              I&apos;m ready! <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
