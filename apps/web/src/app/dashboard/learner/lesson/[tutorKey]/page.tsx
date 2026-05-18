"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Play, ChevronLeft, Wind, LogOut, Sparkles } from "lucide-react";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { useTranslations } from "next-intl";
import { StageLayout } from "@/components/stage/StageLayout";
import { CelebrationOverlay } from "@/components/stage/CelebrationOverlay";
import { useSensoryAdapter } from "@/components/stage/useSensoryAdapter";
import { useSessionFlow } from "@/components/stage/useSessionFlow";
import { useTTS } from "@/components/stage/useTTS";
import { useLocale } from "@/providers/i18n-provider";
import { TUTOR_THEMES } from "@/components/stage/types";
import type { Beat, TutorState, FunctioningLevel } from "@/components/stage/types";
import { fetchTutorSurfaceBeats } from "@/components/stage/TutorSurfaceRuntime";
import { TUTOR_KEY_TO_SKU, isTutorKey } from "@aivo/billing-entitlements";

export default function LessonPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tutorKey = params.tutorKey as TutorKey;
  const tutor = TUTORS[tutorKey];
  const tTutor = useTranslations("tutor");
  const tLearner = useTranslations("learner");
  const tCommon = useTranslations("common");

  const [functioningLevel, setFunctioningLevel] = useState<FunctioningLevel>("STANDARD");
  const [learnerName, setLearnerName] = useState("");
  const [tutorState, setTutorState] = useState<TutorState>("idle");
  const [speechText, setSpeechText] = useState<string | undefined>();
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [started, setStarted] = useState(false);
  const [sessionApiId, setSessionApiId] = useState<string | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [curriculumFocus, setCurriculumFocus] = useState<{
    title?: string;
    summary?: string;
    topics?: string[];
    weekStart?: string | null;
    weekEnd?: string | null;
  } | null>(null);
  const tCurriculum = useTranslations("curriculum");
  const tDape = useTranslations("dape");
  const [dapeProfile, setDapeProfile] = useState<{
    hasActiveTrack: boolean;
    categories: { id: string; label: string; goalCount: number }[];
  } | null>(null);
  const [dapeActivity, setDapeActivity] = useState<null | {
    category: string;
    activity: {
      name: string;
      pictureSequence: string[];
      steps: string[];
      equipment: string[];
      partnerCue: string;
      durationMin: number;
    };
  }>(null);
  const [dapeLoading, setDapeLoading] = useState(false);

  const { adaptations, getRegulationBreak } = useSensoryAdapter(
    user?.id || null,
    accessToken,
    functioningLevel,
  );

  const { state, currentBeat, progress, setPhase, loadBeats, nextBeat, recordAnswer, cleanup } =
    useSessionFlow(tutorKey, user?.id || "", functioningLevel);

  const { locale } = useLocale();
  const { speak, stop: stopTTS, isSpeaking } = useTTS(tutorKey, adaptations, locale);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    fetch(`/api/brain/${user.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.functioning_level_profile?.level) {
          setFunctioningLevel(data.functioning_level_profile.level);
        }
      })
      .catch(() => {});

    fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.name) setLearnerName(data.name);
      })
      .catch(() => {});

    const tutorSubjectMap: Record<string, string> = {
      nova: "math",
      sage: "ela",
      spark: "science",
      chrono: "history",
      pixel: "coding",
      echo: "speech",
      harmony: "sel",
      atlas: "history",
      cadence: "art",
      vigor: "other",
      lingua: "ela",
      forge: "science",
      compass: "sel",
      muse: "art",
    };
    const subjectHint = tutorSubjectMap[tutorKey] || "";
    const subjectQuery = subjectHint ? `?subject=${subjectHint}` : "";
    fetch(`/api/tutors/curriculum/learner/${user.id}/active${subjectQuery}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.focus) setCurriculumFocus(data.focus);
      })
      .catch(() => {});

    // For Vigor, check whether this learner has DAPE goals; if so, fetch a
    // suggested activity so we can offer the DAPE track on the start screen.
    if (tutorKey === "vigor") {
      fetch(`/api/family/iep/${user.id}/dape/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setDapeProfile(data);
        })
        .catch(() => {});
    }
  }, [accessToken, user, tutorKey]);

  const loadDapeActivity = useCallback(
    async (category?: string) => {
      if (!user || !accessToken) return;
      setDapeLoading(true);
      try {
        const url = `/api/family/iep/${user.id}/dape/activity${category ? `?category=${encodeURIComponent(category)}` : ""}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (res.ok) setDapeActivity(await res.json());
      } catch {
        /* ignore */
      }
      setDapeLoading(false);
    },
    [user, accessToken],
  );

  const handleNarration = useCallback(
    async (beat: Beat | null) => {
      if (!beat?.narration) {
        if (beat && !beat.interaction) {
          setTimeout(() => nextBeat(), 1500);
        }
        return;
      }
      setSpeechText(beat.narration);
      setTutorState(beat.tutorState || "speaking");
      await speak(beat.narration);
      setTutorState("idle");
      if (!beat.interaction) {
        const delay = beat.type === "celebration" ? 2000 : 1500;
        setTimeout(() => nextBeat(), delay);
      }
    },
    [speak, nextBeat],
  );

  useEffect(() => {
    if (started && currentBeat) {
      handleNarration(currentBeat);
    }
  }, [currentBeat?.id, started]);

  useEffect(() => {
    if (state.phase === "celebration" && !showCelebration) {
      setShowCelebration(true);
      setTutorState("celebrating");
      completeSessionAPI();
    }
  }, [state.phase]);

  const startStage = async () => {
    if (!user || !tutor) return;
    if (!isTutorKey(tutorKey)) {
      setLessonError("Unknown tutor.");
      return;
    }
    setLessonError(null);
    setStarted(true);

    const sku = TUTOR_KEY_TO_SKU[tutorKey];
    // Server-side entitlement gate. If the tenant isn't on a plan that
    // includes this tutor and has no active add-on, tutor-svc returns
    // 403 with `requiredSku` and `upgradePath`. Surface a parent-friendly
    // upgrade CTA instead of running the stage.
    try {
      const res = await fetch("/api/tutor/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ learnerId: user.id, tutorSku: sku }),
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setLessonError(data.error || "This tutor isn't included in your plan.");
        setStarted(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSessionApiId(data.sessionId);
      } else {
        setLessonError("Unable to start lesson. Please try again.");
        setStarted(false);
        return;
      }
    } catch {
      setLessonError("Network error. Please try again.");
      setStarted(false);
      return;
    }

    const name = learnerName || user.name || "Explorer";
    try {
      const { beats } = await fetchTutorSurfaceBeats({
        tutorKey,
        learnerId: user.id,
        functioningLevel,
        accessToken: accessToken ?? undefined,
      });
      loadBeats(beats, undefined, name);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start lesson.";
      setLessonError(message);
      setStarted(false);
    }
  };

  const completeSessionAPI = async () => {
    if (sessionApiId && accessToken) {
      try {
        await fetch(`/api/tutor/session/${sessionApiId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({}),
        });
      } catch {}

      try {
        await fetch("/api/engagement/xp/award", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            learnerId: user?.id,
            eventType: "lesson_completed",
            xpAmount: state.xpEarned || 50,
            coinReward: state.coinsEarned || 10,
            metadata: {
              tutorKey,
              correctCount: state.correctCount,
              totalAttempts: state.totalAttempts,
            },
          }),
        });
      } catch {}

      try {
        await fetch("/api/engagement/streak/update", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ learnerId: user?.id }),
        });
      } catch {}
    }
  };

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (correct) {
        setTutorState("celebrating");
        setSpeechText(
          ["Great job!", "Amazing!", "You got it!", "Wonderful!"][Math.floor(Math.random() * 4)],
        );
        recordAnswer(true, 15, 3);
        speak(
          ["Great job!", "Amazing!", "You got it!", "Wonderful!"][Math.floor(Math.random() * 4)],
        ).then(() => {
          setTutorState("idle");
          setTimeout(() => nextBeat(), 800);
        });
      } else {
        setTutorState("encouraging");
        setSpeechText("That's okay! Let's try again!");
        recordAnswer(false, 5, 1);
        speak("That's okay! Let's try again!").then(() => {
          setTutorState("idle");
        });
      }
    },
    [recordAnswer, nextBeat, speak],
  );

  const handlePause = useCallback(() => {
    stopTTS();
    setShowPause(true);
    // If this learner has DAPE goals, fetch a regulation-break activity
    // matched to their sensory profile so the pause modal can offer a
    // movement break instead of a passive timeout.
    if (dapeProfile?.hasActiveTrack) {
      const { category } = getRegulationBreak();
      loadDapeActivity(category);
    }
  }, [stopTTS, dapeProfile, getRegulationBreak, loadDapeActivity]);

  const handleCelebrationComplete = useCallback(() => {
    setShowCelebration(false);
    cleanup();
    router.push("/dashboard/learner");
  }, [cleanup, router]);

  if (loading || !user) return null;
  if (!tutor)
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-heading">
        {tTutor("not_found")}
      </div>
    );

  const theme = TUTOR_THEMES[tutorKey];

  if (!started) {
    return (
      <div className="min-h-screen vi-bg flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <section
            className="vi-card p-8 md:p-10 text-center relative overflow-hidden bg-gradient-to-br from-white"
            style={{
              background: `linear-gradient(135deg, white, ${tutor.color}10)`,
              borderColor: `${tutor.color}26`,
            }}
          >
            <div
              className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl"
              style={{ backgroundColor: `${tutor.color}30` }}
              aria-hidden
            />
            <div
              className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl"
              aria-hidden
            />
            <div className="relative">
              <div
                className="relative w-32 h-32 md:w-36 md:h-36 rounded-3xl overflow-hidden border-4 shadow-xl mx-auto mb-6 animate-breathe"
                style={{ borderColor: tutor.color }}
              >
                <Image src={tutor.avatar} alt={tutor.name} fill className="object-cover" priority />
              </div>
              <p
                className="text-xs font-bold uppercase tracking-[0.2em] mb-2"
                style={{ color: tutor.color }}
              >
                {tutor.domain}
              </p>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 leading-tight">
                Learn with {tutor.name}{" "}
                <Sparkles className="inline w-7 h-7 text-[hsl(43_100%_50%)]" aria-hidden />
              </h1>
              <p className="text-base text-slate-600 mb-1">{theme?.envName || tutor.domain}</p>
              {learnerName && (
                <p className="text-slate-500 mb-6">Ready for an adventure, {learnerName}!</p>
              )}

              <button
                onClick={startStage}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-white font-extrabold text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 mt-3"
                style={{ backgroundColor: tutor.color, boxShadow: `0 8px 24px ${tutor.color}60` }}
              >
                <Play className="w-5 h-5 fill-white" /> {tLearner("start_learning")}
              </button>

              {lessonError && (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 text-left text-sm text-red-900"
                >
                  <p className="font-bold mb-1">Could not start the lesson</p>
                  <p className="text-red-800">{lessonError}</p>
                </div>
              )}

              {tutorKey === "vigor" && dapeProfile?.hasActiveTrack && (
                <div
                  className="mt-6 text-left rounded-2xl border-2 p-4 bg-white"
                  style={{ borderColor: `${tutor.color}40` }}
                >
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div>
                      <p
                        className="text-xs font-bold uppercase tracking-wide"
                        style={{ color: tutor.color }}
                      >
                        {tDape("track_label")}
                      </p>
                      <p className="font-extrabold text-slate-900">{tDape("track_heading")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadDapeActivity()}
                      disabled={dapeLoading}
                      className="text-xs font-bold rounded-full px-3 py-1.5 disabled:opacity-50"
                      style={{ backgroundColor: `${tutor.color}18`, color: tutor.color }}
                    >
                      {dapeActivity
                        ? tDape("new_activity")
                        : dapeLoading
                          ? tDape("loading")
                          : tDape("suggest_activity")}
                    </button>
                  </div>
                  {dapeProfile.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {dapeProfile.categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => loadDapeActivity(c.id)}
                          className="text-xs font-bold rounded-full px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          {c.label} Â· {c.goalCount}
                        </button>
                      ))}
                    </div>
                  )}
                  {dapeActivity && (
                    <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                      <p className="font-extrabold text-slate-900 text-sm">
                        {dapeActivity.activity.name}
                      </p>
                      <p className="text-2xl tracking-widest" aria-hidden>
                        {dapeActivity.activity.pictureSequence.join(" ")}
                      </p>
                      <ol className="list-decimal list-inside text-xs text-slate-700 space-y-0.5">
                        {dapeActivity.activity.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                      {dapeActivity.activity.partnerCue && (
                        <p className="text-xs italic text-slate-500">
                          {tDape("partner_cue")}: {dapeActivity.activity.partnerCue}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <button
                  onClick={() => router.push("/dashboard/learner")}
                  className="mt-5 inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-full px-3 py-2"
                >
                  <ChevronLeft className="w-4 h-4" /> {tCommon("back")}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      {curriculumFocus && started && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] sm:w-auto pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div
            className="rounded-full px-4 py-2 shadow-lg backdrop-blur-md text-sm flex items-center gap-2 pointer-events-auto"
            style={{ backgroundColor: `${tutor.color}E6`, color: "white" }}
          >
            <span className="text-xs uppercase tracking-wide opacity-80 font-semibold">
              {tCurriculum("stage_banner_label")}
            </span>
            <span className="font-semibold truncate max-w-[18rem]">
              {curriculumFocus.title ||
                (curriculumFocus.topics || [])[0] ||
                curriculumFocus.summary?.slice(0, 60)}
            </span>
          </div>
        </div>
      )}
      <StageLayout
        tutorKey={tutorKey}
        phase={state.phase}
        tutorState={tutorState}
        currentBeat={currentBeat}
        progress={progress}
        totalBeats={state.totalBeats}
        currentBeatIndex={state.currentBeatIndex}
        speechText={speechText}
        functioningLevel={functioningLevel}
        adaptations={adaptations}
        onAnswer={handleAnswer}
        onPause={handlePause}
      />

      {showPause && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in px-4">
          <div
            className="vi-card p-8 max-w-sm w-full text-center space-y-5 animate-scale-in border-2"
            style={{ borderColor: `${tutor.color}26` }}
          >
            <div className="mx-auto inline-flex">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center bg-[hsl(199_89%_48%/0.12)] text-[hsl(199_89%_48%)] animate-breathe">
                <Wind className="w-8 h-8" strokeWidth={2.5} aria-hidden />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
                {tLearner("taking_break")}
              </h2>
              <p className="text-slate-600">{tLearner("take_breath")}</p>
            </div>

            {dapeProfile?.hasActiveTrack && dapeActivity && (
              <div className="rounded-xl bg-slate-50 p-3 text-left space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  {tDape("regulation_break")}
                </p>
                <p className="font-extrabold text-slate-900 text-sm">
                  {dapeActivity.activity.name}
                </p>
                <p className="text-xl tracking-widest" aria-hidden>
                  {dapeActivity.activity.pictureSequence.join(" ")}
                </p>
                <ol className="list-decimal list-inside text-xs text-slate-700 space-y-0.5">
                  {dapeActivity.activity.steps.slice(0, 3).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPause(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-full font-extrabold text-white shadow-lg hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
                style={{ backgroundColor: tutor.color, boxShadow: `0 8px 24px ${tutor.color}40` }}
              >
                <Play className="w-4 h-4 fill-white" /> {tLearner("resume")}
              </button>
              <button
                onClick={() => {
                  cleanup();
                  router.push("/dashboard/learner");
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-full font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <LogOut className="w-4 h-4" /> {tLearner("log_out")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCelebration && (
        <CelebrationOverlay
          xpEarned={state.xpEarned || 50}
          coinsEarned={state.coinsEarned || 10}
          correctCount={state.correctCount}
          totalAttempts={state.totalAttempts}
          adaptations={adaptations}
          accentColor={tutor.color}
          tutorName={tutor.name}
          onComplete={handleCelebrationComplete}
        />
      )}
    </>
  );
}
