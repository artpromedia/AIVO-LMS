"use client";
import { useState } from "react";
import Image from "next/image";
import { Compass, Sparkles, Play, Map } from "lucide-react";
import { TUTORS } from "@aivo/brand";
import { TUTOR_INTROS } from "./types";
import { IconWell } from "./_vi";

interface PreAdventureProps {
  learnerName: string;
  onStart: () => void;
  onShowMap?: () => void;
  lightMode?: boolean;
}

export default function PreAdventure({ learnerName, onStart, onShowMap }: PreAdventureProps) {
  const [currentTutor, setCurrentTutor] = useState(0);
  const [allRevealed, setAllRevealed] = useState(false);
  const [replayingIdx, setReplayingIdx] = useState<number | null>(null);

  const handleNext = () => {
    if (currentTutor < TUTOR_INTROS.length - 1) setCurrentTutor(currentTutor + 1);
    else setAllRevealed(true);
  };

  const displayIdx = replayingIdx !== null ? replayingIdx : currentTutor;
  const displayIntro = TUTOR_INTROS[displayIdx];
  const displayTutor = TUTORS[displayIntro.tutorKey];

  return (
    <div className="fixed inset-0 vi-bg tier-scene-bg flex flex-col items-center justify-center overflow-y-auto py-8">
      <div className="relative w-full max-w-xl mx-auto px-6">
        <section className="vi-card p-8 md:p-10 bg-gradient-to-br from-white via-[hsl(262_83%_58%/0.04)] to-[hsl(43_100%_50%/0.06)] border-2 border-[hsl(262_83%_58%/0.15)] text-center relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl" aria-hidden />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(262_83%_58%/0.18)] blur-2xl" aria-hidden />

          <div className="relative">
            <div className="mx-auto mb-5 inline-flex">
              <IconWell color="primary" size="lg"><Compass className="w-10 h-10" strokeWidth={2.5} /></IconWell>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(262_83%_58%)] mb-3">A Quick Adventure</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 leading-tight">
              Hi{learnerName ? `, ${learnerName}` : ""}! <Sparkles className="inline w-7 h-7 text-[hsl(43_100%_50%)]" aria-hidden />
            </h1>
            <p className="text-base text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
              Some really cool friends want to meet you!
            </p>

            <div className="mb-6" key={displayIdx}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 shadow-lg" style={{ borderColor: displayIntro.color }}>
                  <Image src={displayTutor.avatar} alt={displayIntro.name} width={96} height={96} className="object-cover" />
                </div>
                <p className="text-xl font-extrabold text-slate-900">{displayIntro.name}</p>
                <p className="text-sm text-slate-600 leading-relaxed max-w-xs">&ldquo;{displayIntro.line}&rdquo;</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 mb-6" role="radiogroup" aria-label="Tutor friends">
              {TUTOR_INTROS.map((intro, idx) => {
                const isRevealed = idx <= currentTutor;
                const isCurrent = idx === displayIdx;
                return (
                  <button
                    key={intro.tutorKey}
                    onClick={() => isRevealed && setReplayingIdx(idx)}
                    disabled={!isRevealed}
                    role="radio"
                    aria-checked={isCurrent}
                    aria-label={isRevealed ? `Replay ${intro.name}'s intro` : `${intro.name} — not yet revealed`}
                    className={`w-10 h-10 rounded-2xl overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%)] ${
                      isCurrent ? "scale-110 shadow-md" : isRevealed ? "opacity-70 hover:opacity-100" : "opacity-30 grayscale"
                    }`}
                    style={{ borderColor: isRevealed ? intro.color : "#e2e8f0" }}
                  >
                    <Image src={TUTORS[intro.tutorKey].avatar} alt={intro.name} width={40} height={40} className="object-cover" />
                  </button>
                );
              })}
            </div>

            {!allRevealed ? (
              <div className="space-y-3">
                <button
                  onClick={() => { setReplayingIdx(null); handleNext(); }}
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold text-lg shadow-xl shadow-[hsl(262_83%_58%/0.3)] hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(262_83%_58%)] focus-visible:ring-offset-2"
                  style={{ minHeight: "var(--learner-hit-target, 56px)" }}
                >
                  Meet the next friend <Sparkles className="w-5 h-5" />
                </button>
                <p className="text-xs text-slate-400 font-semibold">{currentTutor + 1} of {TUTOR_INTROS.length} friends</p>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={onStart}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold text-xl shadow-xl shadow-[hsl(262_83%_58%/0.3)] hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(262_83%_58%)] focus-visible:ring-offset-2"
                  style={{ minHeight: "var(--learner-hit-target, 56px)" }}
                >
                  <Play className="w-5 h-5 fill-white" /> Let&apos;s Go!
                </button>
                {onShowMap && (
                  <button
                    onClick={onShowMap}
                    className="block mx-auto inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border-2 border-slate-200 text-slate-700 font-bold text-sm hover:border-[hsl(262_83%_58%/0.3)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%)]"
                  >
                    <Map className="w-4 h-4" /> Show me the map first
                  </button>
                )}
              </div>
            )}
            <p className="mt-5 text-xs text-slate-400 font-semibold">About 10 minutes · Pause anytime</p>
          </div>
        </section>
      </div>
    </div>
  );
}
