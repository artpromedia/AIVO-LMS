"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { Trophy, Sparkles, Home, Award, Loader2, CheckCircle2 } from "lucide-react";
import { TUTORS } from "@aivo/brand";
import { ADVENTURE_CHAPTERS, TUTOR_INTROS, type ChapterResult, type FunctioningLevel } from "./types";
import { IconWell } from "./_vi";
import { loadBadges, unlockBadges, type UnlockedBadge } from "@/lib/badges";

interface FinaleProps {
  learnerName: string;
  /** Used to persist per-domain badges across sessions. Optional — if
   *  unset (e.g. unauthenticated preview routes) badges still render but
   *  aren't saved. */
  learnerId?: string;
  chapterResults: ChapterResult[];
  totalCorrect: number;
  totalAttempts: number;
  xpEarned: number;
  functioningLevel: FunctioningLevel;
  onFinish: () => void;
  onExitHome?: () => void;
  onSubmitResults: () => Promise<{ success: boolean; error?: string; code?: string; status?: number }>;
}

type FinaleStage = "celebration" | "saving" | "saved" | "error";

interface FriendlyError {
  title: string;
  body: string;
  retryable: boolean;
}

function describeSaveError(code: string | undefined, status: number | undefined): FriendlyError {
  if (code === "parent_assessment_required") {
    return {
      title: "We need a grown-up first",
      body: "Ask the grown-up to finish the parent setup, then come back and tap Try saving again.",
      retryable: true,
    };
  }
  if (code === "no_auth_token" || status === 401 || status === 403) {
    return {
      title: "We need to sign you back in",
      body: "Your sign-in expired. Ask the grown-up to sign in again, then tap Try saving again.",
      retryable: true,
    };
  }
  if (code === "network_error") {
    return {
      title: "We can't reach the internet",
      body: "Check the Wi-Fi or try again in a moment — your progress is still here.",
      retryable: true,
    };
  }
  if (status === 502 || status === 503 || status === 504) {
    return {
      title: "Our helpers are taking a quick break",
      body: "Something on our side is slow right now. Wait a moment, then tap Try saving again.",
      retryable: true,
    };
  }
  if (status && status >= 500) {
    return {
      title: "Something went wrong on our side",
      body: "It's not your fault! Tap Try saving again — your progress is still here.",
      retryable: true,
    };
  }
  return {
    title: "We couldn't save your results",
    body: "Tap Try saving again — your progress is still here.",
    retryable: true,
  };
}

export default function Finale({
  learnerName, learnerId, chapterResults, totalCorrect, totalAttempts, xpEarned,
  onFinish, onExitHome, onSubmitResults,
}: FinaleProps) {
  const [stage, setStage] = useState<FinaleStage>("celebration");
  const [step, setStep] = useState(0);

  // Per-domain badges. We award one badge per chapter the learner reached
  // ≥50% on (the same threshold the existing celebratory grid uses), then
  // merge with whatever's already in localStorage so re-runs accumulate
  // rather than reset the wall. The "Baseline Complete" badge is still
  // surfaced separately above — these are *domain* badges (math/ela/etc.),
  // resolved off each chapter's tutor key.
  const earnedBadgeIds = useMemo(() => {
    return chapterResults
      .filter((r) => r.total > 0 && r.correct / r.total >= 0.5)
      .map((r) => {
        const ch = ADVENTURE_CHAPTERS.find((c) => c.id === r.chapterId);
        return ch ? `domain:${ch.tutorKey}` : null;
      })
      .filter((x): x is string => !!x);
  }, [chapterResults]);

  const [unlockedBadges, setUnlockedBadges] = useState<UnlockedBadge[]>([]);

  // On mount: hydrate already-unlocked badges, then merge in this run's
  // newly earned ones. Triggering this in an effect (not a render) keeps
  // SSR safe and avoids double-writes under StrictMode.
  useEffect(() => {
    if (!learnerId) {
      setUnlockedBadges(earnedBadgeIds.map((id) => ({ id, unlockedAt: Date.now() })));
      return;
    }
    setUnlockedBadges(loadBadges(learnerId));
  }, [learnerId, earnedBadgeIds]);

  useEffect(() => {
    if (!learnerId || earnedBadgeIds.length === 0) return;
    setUnlockedBadges(unlockBadges(learnerId, earnedBadgeIds));
  }, [learnerId, earnedBadgeIds]);

  const [saveError, setSaveError] = useState<string>("");
  const [saveErrorCode, setSaveErrorCode] = useState<string | undefined>(undefined);
  const [saveErrorStatus, setSaveErrorStatus] = useState<number | undefined>(undefined);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const saveResults = useCallback(async () => {
    setStage("saving");
    const result = await onSubmitResults();
    if (result.success) {
      setSaveError("");
      setSaveErrorCode(undefined);
      setSaveErrorStatus(undefined);
      setShowErrorDetails(false);
      setStage("saved");
    } else {
      console.error("[Finale] submitResults failed:", result.code, result.status, result.error);
      setSaveError(result.error || "Unknown error");
      setSaveErrorCode(result.code);
      setSaveErrorStatus(result.status);
      setShowErrorDetails(false);
      setStage("error");
    }
  }, [onSubmitResults]);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 800);
    const t2 = setTimeout(() => setStep(2), 1800);
    const t3 = setTimeout(() => setStep(3), 2800);
    const t4 = setTimeout(() => { setStep(4); saveResults(); }, 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [saveResults]);

  const statusSection = () => {
    if (stage === "saving") {
      return (
        <div className="vi-card p-5 mt-5 flex items-center gap-3 justify-center">
          <Loader2 className="w-5 h-5 text-[hsl(262_83%_58%)] animate-spin" />
          <div className="text-left">
            <p className="text-sm font-extrabold text-slate-900">Saving your results...</p>
            <p className="text-xs text-slate-500">Almost done!</p>
          </div>
        </div>
      );
    }
    if (stage === "saved") {
      return (
        <div className="vi-card p-5 mt-5" style={{ background: "hsl(142 71% 45% / 0.06)", borderColor: "hsl(142 71% 45% / 0.3)" }}>
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-6 h-6 text-[hsl(142_71%_45%)]" />
            <p className="text-sm font-extrabold text-[hsl(142_71%_45%)]">Adventure Complete!</p>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Your results are saved. Your parent will review them and set up your personalized Brain — then the real learning adventure begins!
          </p>
          <button
            onClick={onFinish}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[hsl(142_71%_45%)] text-white font-extrabold shadow-lg hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
            style={{ minHeight: "48px" }}
          >
            <Home className="w-4 h-4" /> Go Home
          </button>
        </div>
      );
    }
    if (stage === "error") {
      const friendly = describeSaveError(saveErrorCode, saveErrorStatus);
      const hasDetails = !!(saveError || saveErrorCode || saveErrorStatus);
      return (
        <div className="vi-card p-5 mt-5" style={{ background: "hsl(43 100% 50% / 0.06)", borderColor: "hsl(43 100% 50% / 0.3)" }}>
          <p className="text-sm font-extrabold text-[hsl(43_100%_50%)] mb-1">{friendly.title}</p>
          <p className="text-xs text-slate-600 mb-2">{friendly.body}</p>
          {hasDetails ? (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowErrorDetails(v => !v)}
                className="text-[11px] text-slate-500 underline font-bold"
              >
                {showErrorDetails ? "Hide details" : "Show details"}
              </button>
              {showErrorDetails ? (
                <p className="mt-1 text-[10px] text-slate-400 font-mono break-all max-h-20 overflow-auto">
                  {saveErrorStatus ? `[${saveErrorStatus}] ` : ""}
                  {saveErrorCode ? `${saveErrorCode}: ` : ""}
                  {saveError}
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            onClick={saveResults}
            className="w-full mb-2 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold shadow-lg hover:scale-105 active:scale-95 transition-transform"
            style={{ minHeight: "48px" }}
          >
            Try saving again
          </button>
          <button
            onClick={onFinish}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[hsl(43_100%_50%)] text-white font-extrabold shadow-lg hover:scale-105 active:scale-95 transition-transform"
            style={{ minHeight: "48px" }}
          >
            Continue <Sparkles className="w-4 h-4" />
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 vi-bg tier-scene-bg flex items-center justify-center overflow-y-auto py-8">
      <div className="relative w-full max-w-md mx-auto px-6">
        <section className="vi-card p-8 bg-gradient-to-br from-white via-[hsl(262_83%_58%/0.04)] to-[hsl(43_100%_50%/0.06)] border-2 border-[hsl(262_83%_58%/0.15)] text-center relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl" aria-hidden />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(262_83%_58%/0.18)] blur-2xl" aria-hidden />

          <div className="relative">
            <div className={`transition-all duration-1000 ${step >= 0 ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}>
              <div className="mx-auto mb-3 inline-flex">
                <IconWell color="primary" size="lg"><Trophy className="w-10 h-10" strokeWidth={2.5} /></IconWell>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">You Did It!</h1>
              <p className="text-slate-600">
                {learnerName ? `${learnerName}, you` : "You"} explored every world and discovered so much!
              </p>
            </div>

            <div className={`mt-6 flex justify-center gap-2 transition-all duration-1000 ${step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              {TUTOR_INTROS.map((intro) => {
                const tutor = TUTORS[intro.tutorKey];
                return (
                  <div key={intro.tutorKey} className="w-12 h-12 rounded-2xl overflow-hidden border-2 shadow-sm" style={{ borderColor: intro.color }}>
                    <Image src={tutor.avatar} alt={intro.name} width={48} height={48} className="object-cover" />
                  </div>
                );
              })}
            </div>

            <div className={`mt-6 transition-all duration-1000 ${step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              <div className="vi-card p-5 space-y-4 bg-white">
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <p className="text-3xl font-extrabold text-[hsl(43_100%_50%)]">{totalCorrect}/{totalAttempts}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Correct</p>
                  </div>
                  <div className="w-px h-12 bg-slate-200" />
                  <div className="text-center">
                    <p className="text-3xl font-extrabold text-[hsl(262_83%_58%)]">+{xpEarned}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">XP Earned</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {chapterResults.map((result) => {
                    const ch = ADVENTURE_CHAPTERS.find(c => c.id === result.chapterId);
                    return (
                      <div key={result.chapterId} className="bg-slate-50 rounded-2xl p-2 text-center border border-slate-100">
                        <div className="text-lg" aria-hidden>{ch?.landmark.emoji || "📚"}</div>
                        <p className="text-[10px] text-slate-600 font-bold">{result.correct}/{result.total}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`mt-5 transition-all duration-1000 ${step >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              <div className="vi-card p-4" style={{ background: "hsl(43 100% 50% / 0.06)", borderColor: "hsl(43 100% 50% / 0.3)" }}>
                <div className="flex items-center gap-3 justify-center">
                  <Award className="w-7 h-7 text-[hsl(43_100%_50%)]" strokeWidth={2.5} />
                  <div className="text-left">
                    <p className="text-sm font-extrabold text-[hsl(43_100%_50%)]">Baseline Complete</p>
                    <p className="text-[11px] text-slate-500">Your first badge!</p>
                  </div>
                </div>
              </div>

              {unlockedBadges.length > 0 && (
                <div className="vi-card p-4 mt-3" aria-label="Badge wall">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Domain badges</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {unlockedBadges.map((b) => {
                      const tutorKey = b.id.startsWith("domain:") ? b.id.slice(7) : b.id;
                      const tutor = TUTORS[tutorKey as keyof typeof TUTORS];
                      const isFresh = earnedBadgeIds.includes(b.id);
                      const tone = tutor?.color || "#7C3AED";
                      return (
                        <div
                          key={b.id}
                          className={`flex flex-col items-center gap-1 ${isFresh ? "scale-105" : "opacity-80"}`}
                          title={tutor ? `${tutor.name} — unlocked` : b.id}
                        >
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-sm"
                            style={{ borderColor: tone, background: `${tone}1a` }}
                          >
                            {tutor?.avatar ? (
                              <Image src={tutor.avatar} alt={tutor.name} width={40} height={40} className="rounded-full object-cover" />
                            ) : (
                              <Sparkles className="w-5 h-5" style={{ color: tone }} />
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-600 text-center max-w-[60px] leading-tight">
                            {tutor?.name || b.id}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className={`transition-all duration-1000 ${step >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              {statusSection()}
            </div>

            {onExitHome && stage !== "saving" && (
              <button
                onClick={async () => { if (stage === "celebration") await saveResults(); onExitHome(); }}
                className="mt-4 text-slate-500 hover:text-slate-700 text-sm font-bold transition"
                style={{ minHeight: "48px" }}
              >
                Go home — progress is saved
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
