"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { BREAK_OPTIONS, type BreakType, type BreakOption, type FunctioningLevel } from "./types";

interface BreakActivityProps {
  chapterNumber: number;
  onBreakComplete: () => void;
  functioningLevel?: FunctioningLevel;
  parentMinDurationSec?: number;
}

const EXERCISES = [
  { name: "Reach for the Sky!", emoji: "🙆", instruction: "Stretch your arms up high!" },
  { name: "Touch Your Toes!", emoji: "🙇", instruction: "Bend down and try to touch your toes!" },
  { name: "Wiggle Dance!", emoji: "💃", instruction: "Shake your whole body!" },
  { name: "Big Deep Breath!", emoji: "🌬️", instruction: "Breathe in slowly... and out..." },
  { name: "Shoulder Rolls!", emoji: "🤷", instruction: "Roll your shoulders in big circles!" },
  { name: "Jumping Stars!", emoji: "⭐", instruction: "Jump and spread your arms like a star!" },
];

const MUSIC_VISUALS = [
  { emoji: "🎵", color: "hsl(var(--visual-primary))" },
  { emoji: "🎶", color: "hsl(var(--visual-reading))" },
  { emoji: "🎹", color: "hsl(var(--visual-math))" },
  { emoji: "🎸", color: "hsl(var(--visual-sel))" },
  { emoji: "🥁", color: "hsl(var(--visual-science))" },
  { emoji: "🎺", color: "hsl(var(--visual-math))" },
];

const WORD_GAME_WORDS = [
  { scrambled: "PPLAE", answer: "APPLE", hint: "A red fruit" },
  { scrambled: "ASTR", answer: "STAR", hint: "It shines at night" },
  { scrambled: "OBOK", answer: "BOOK", hint: "You read it" },
  { scrambled: "RTEE", answer: "TREE", hint: "It grows in the ground" },
  { scrambled: "IFHS", answer: "FISH", hint: "It lives in water" },
  { scrambled: "ATBO", answer: "BOAT", hint: "It floats on water" },
  { scrambled: "OMNO", answer: "MOON", hint: "You see it at night" },
];

export default function BreakActivity({ chapterNumber, onBreakComplete, functioningLevel = "STANDARD", parentMinDurationSec = 0 }: BreakActivityProps) {
  const [selectedBreak, setSelectedBreak] = useState<BreakType | null>(null);
  const [show, setShow] = useState(false);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [wordSolved, setWordSolved] = useState(false);
  const [musicNoteIdx, setMusicNoteIdx] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTextFree = functioningLevel === "NON_VERBAL" || functioningLevel === "PRE_SYMBOLIC";
  const minDurationMet = elapsedSec >= parentMinDurationSec;

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setWordIdx(Math.floor(Math.random() * WORD_GAME_WORDS.length));
    setExerciseIdx(Math.floor(Math.random() * EXERCISES.length));
  }, []);

  const startBreak = useCallback((option: BreakOption) => {
    setSelectedBreak(option.type);
    setElapsedSec(0);
  }, []);

  useEffect(() => {
    if (!selectedBreak) return;
    timerRef.current = setInterval(() => {
      setElapsedSec(t => t + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [selectedBreak]);

  useEffect(() => {
    if (!selectedBreak || selectedBreak !== "exercise") return;
    const interval = setInterval(() => {
      setExerciseIdx(i => (i + 1) % EXERCISES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [selectedBreak]);

  useEffect(() => {
    if (!selectedBreak || selectedBreak !== "music") return;
    const interval = setInterval(() => {
      setMusicNoteIdx(i => (i + 1) % MUSIC_VISUALS.length);
    }, 800);
    return () => clearInterval(interval);
  }, [selectedBreak]);

  const breakOptions = isTextFree
    ? BREAK_OPTIONS.filter(o => o.type !== "word_game")
    : BREAK_OPTIONS;

  if (!selectedBreak) {
    return (
      <div className="fixed inset-0 vi-bg tier-scene-bg flex items-center justify-center px-4">
        <div className={`max-w-md w-full text-center transition-all duration-700 ${show ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
          <div className="text-5xl mb-4">🎉</div>
          {!isTextFree && (
            <>
              <h2 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">
                Great job on Chapter {chapterNumber}!
              </h2>
              <p className="vi-text-muted font-body mb-8">
                Time for a break. Pick what feels good — take as long as you need!
              </p>
            </>
          )}
          {isTextFree && (
            <div className="mb-8" />
          )}

          <div className="space-y-3">
            {breakOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => startBreak(option)}
                className="vi-card w-full flex items-center gap-4 p-4 hover:bg-[hsl(var(--visual-surface-soft))] hover:scale-[1.02] active:scale-[0.98] transition-all text-left group focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))]"
                style={{ minHeight: "72px" }}
                aria-label={option.label}
              >
                <div className="text-4xl group-hover:scale-110 transition-transform">
                  {option.emoji}
                </div>
                {!isTextFree && (
                  <div className="flex-1">
                    <p className="font-heading font-extrabold text-slate-900 text-lg">{option.label}</p>
                    <p className="vi-text-muted text-sm font-body">{option.description}</p>
                  </div>
                )}
              </button>
            ))}
          </div>

          {parentMinDurationSec <= 0 && (
            <button
              onClick={onBreakComplete}
              className="mt-6 vi-text-muted hover:text-slate-700 text-sm font-body transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-primary))] rounded-md px-2 py-1"
              style={{ minHeight: "48px" }}
            >
              {isTextFree ? "➡️" : "Skip break"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 vi-bg tier-scene-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {selectedBreak === "music" && (
          <div className="space-y-6">
            <div className="text-6xl mb-4 animate-pulse">🎵</div>
            {!isTextFree && (
              <>
                <h2 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">Relax & Listen</h2>
                <p className="vi-text-muted font-body mb-6">Close your eyes and enjoy the moment...</p>
              </>
            )}
            <div className="vi-card p-6 flex justify-center gap-4 h-32 items-end">
              {MUSIC_VISUALS.map((note, i) => (
                <div
                  key={i}
                  className="w-8 rounded-t-full transition-all duration-500"
                  style={{
                    backgroundColor: note.color,
                    height: `${20 + Math.sin((musicNoteIdx + i) * 1.2) * 40 + 40}%`,
                    opacity: i === musicNoteIdx % MUSIC_VISUALS.length ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-center gap-3 mt-4 flex-wrap">
              {MUSIC_VISUALS.map((note, i) => (
                <span
                  key={i}
                  className="text-3xl transition-all duration-300"
                  style={{
                    transform: i === musicNoteIdx % MUSIC_VISUALS.length ? "scale(1.5) translateY(-8px)" : "scale(1)",
                    opacity: i === musicNoteIdx % MUSIC_VISUALS.length ? 1 : 0.4,
                  }}
                >
                  {note.emoji}
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedBreak === "word_game" && (
          <div className="space-y-6">
            <div className="text-6xl mb-4">🔤</div>
            <h2 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">Word Scramble!</h2>
            <p className="vi-text-muted font-body mb-2">Unscramble the letters to find the word</p>
            <div className="vi-card p-6">
              <div className="flex justify-center gap-2 mb-4">
                {WORD_GAME_WORDS[wordIdx].scrambled.split("").map((letter, i) => (
                  <div
                    key={i}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-heading font-extrabold text-slate-900 shadow-md"
                    style={{ backgroundColor: "hsl(var(--visual-sel))" }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <p className="vi-text-muted text-sm mb-4">Hint: {WORD_GAME_WORDS[wordIdx].hint}</p>
              {wordSolved ? (
                <div className="font-heading font-extrabold text-lg" style={{ color: "hsl(var(--visual-science))" }}>
                  Correct! Great job! 🎉
                </div>
              ) : (
                <div className="flex gap-2 justify-center">
                  <input
                    type="text"
                    value={guess}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setGuess(val);
                      const scrambled = WORD_GAME_WORDS[wordIdx].scrambled;
                      const sorted = (s: string) => s.split("").sort().join("");
                      if (val.length === scrambled.length && sorted(val) === sorted(scrambled)) {
                        setWordSolved(true);
                      }
                    }}
                    placeholder="Type your answer..."
                    className="px-4 py-2 rounded-xl bg-[hsl(var(--visual-surface-soft))] vi-border border-2 text-slate-900 placeholder-[hsl(var(--visual-text-muted))] font-heading font-extrabold text-center focus:outline-none focus:ring-[3px] focus:ring-[hsl(var(--visual-sel))] w-40"
                    maxLength={WORD_GAME_WORDS[wordIdx].scrambled.length}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {selectedBreak === "exercise" && (
          <div className="space-y-6">
            <div className="text-7xl mb-4 transition-all duration-500" key={exerciseIdx}>
              {EXERCISES[exerciseIdx].emoji}
            </div>
            {!isTextFree && (
              <>
                <h2 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">
                  {EXERCISES[exerciseIdx].name}
                </h2>
                <p className="text-slate-700 font-body text-lg mb-4">
                  {EXERCISES[exerciseIdx].instruction}
                </p>
              </>
            )}
            <div className="flex justify-center gap-2">
              {EXERCISES.map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i === exerciseIdx ? "scale-125" : ""
                  }`}
                  style={{
                    backgroundColor: i === exerciseIdx ? "hsl(var(--visual-sel))" : "hsl(var(--visual-border))",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={onBreakComplete}
            disabled={!minDurationMet}
            className={`px-8 py-4 rounded-full font-heading font-extrabold text-lg shadow-md transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))] ${
              minDurationMet
                ? "text-white hover:scale-105 active:scale-95"
                : "vi-text-muted cursor-not-allowed opacity-60 bg-[hsl(var(--visual-surface-soft))]"
            }`}
            style={minDurationMet ? { backgroundColor: "hsl(var(--visual-sel))" } : undefined}
            aria-label="I'm ready to go back"
          >
            {isTextFree ? "✅ ➡️" : "I'm ready to go back"}
          </button>
          {!minDurationMet && !isTextFree && (
            <p className="vi-text-muted text-xs mt-2 font-body">
              Take your time — {parentMinDurationSec - elapsedSec}s before you can continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
