"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useTranslations } from "next-intl";
import { Compass, ClipboardList, ChevronRight, Home, Sparkles } from "lucide-react";
import { useDiscoveryEngine } from "@/components/discovery/useDiscoveryEngine";
import PreAdventure from "@/components/discovery/PreAdventure";
import AdventureMap from "@/components/discovery/AdventureMap";
import ChapterIntro from "@/components/discovery/ChapterIntro";
import ActivityRenderer from "@/components/discovery/ActivityRenderer";
import ChapterComplete from "@/components/discovery/ChapterComplete";
import BreakActivity from "@/components/discovery/BreakActivity";
import Finale from "@/components/discovery/Finale";
import { IconWell } from "@/components/discovery/_vi";
import type { FunctioningLevel } from "@/components/discovery/types";

function ViLoadingScreen({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="fixed inset-0 vi-bg flex items-center justify-center px-6">
      <div className="vi-card p-8 max-w-md w-full text-center bg-gradient-to-br from-white via-[hsl(262_83%_58%/0.04)] to-[hsl(43_100%_50%/0.06)] border-2 border-[hsl(262_83%_58%/0.15)]">
        <div className="mx-auto mb-4 inline-flex">
          <IconWell color="primary" size="lg">{icon}</IconWell>
        </div>
        <p className="text-base font-extrabold text-slate-900">{title}</p>
        {subtitle && <p className="text-sm text-slate-500 mt-1 font-semibold">{subtitle}</p>}
        <div className="flex gap-1.5 justify-center mt-5" aria-hidden>
          <div className="w-2 h-2 rounded-full bg-[hsl(262_83%_58%)] animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-[hsl(262_83%_58%)] animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-[hsl(262_83%_58%)] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  const t = useTranslations("assessment");
  return <ViLoadingScreen icon={<Compass className="w-10 h-10" strokeWidth={2.5} />} title={t("preparing_baseline")} />;
}

export default function DiscoveryAdventurePageWrapper() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DiscoveryAdventurePage />
    </Suspense>
  );
}

function DiscoveryAdventurePage() {
  const { user, accessToken, loading, refreshToken } = useAuth();
  const router = useRouter();
  const t = useTranslations("assessment");
  const searchParams = useSearchParams();
  const queryLearnerId = searchParams.get("learnerId");
  const [learnerFL, setLearnerFL] = useState<FunctioningLevel>("STANDARD");
  const [learnerName, setLearnerName] = useState("");
  const [resolvedLearnerId, setResolvedLearnerId] = useState("");
  const [ready, setReady] = useState(false);
  const [parentAssessmentRequired, setParentAssessmentRequired] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && accessToken) {
      const isParent = user.role === "PARENT";
      const effectiveLearnerId = queryLearnerId || user.id;

      const init = async () => {
        try {
          if (isParent && queryLearnerId) {
            const learnersRes = await fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } });
            if (learnersRes.ok) {
              const learnersList = await learnersRes.json();
              const found = learnersList.find((l: any) => l.id === queryLearnerId);
              if (found) {
                setLearnerName(found.name || "");
                if (found.functioningLevel) setLearnerFL(found.functioningLevel);
                setResolvedLearnerId(found.userId || queryLearnerId);
              }
            }
          } else {
            setLearnerName(user.name || "");
            setResolvedLearnerId(user.id);
            const meRes = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
            if (meRes.ok) {
              const meData = await meRes.json();
              if (meData?.functioningLevel) setLearnerFL(meData.functioningLevel);
            }
          }

          const statusRes = await fetch(`/api/assessments/learner/discovery/${effectiveLearnerId}/status`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData?.baselineCompleted) {
              router.replace(isParent ? "/dashboard/parent" : "/dashboard/learner");
              return;
            }
            if (!statusData?.parentAssessmentCompleted) setParentAssessmentRequired(true);
          }
        } catch {}
        setReady(true);
      };

      init();
    } else if (!loading && user && !accessToken) {
      setReady(true);
    }
  }, [user, loading, router, accessToken, queryLearnerId]);

  if (loading || !user || !ready) {
    return <ViLoadingScreen icon={<Compass className="w-10 h-10" strokeWidth={2.5} />} title={t("preparing_baseline")} />;
  }

  if (parentAssessmentRequired) {
    const isParent = user.role === "PARENT";
    return (
      <div className="fixed inset-0 vi-bg flex items-center justify-center overflow-y-auto py-8 px-6">
        <div className="max-w-lg w-full">
          <section className="vi-card p-8 md:p-10 bg-gradient-to-br from-white via-[hsl(262_83%_58%/0.04)] to-[hsl(43_100%_50%/0.06)] border-2 border-[hsl(262_83%_58%/0.15)] text-center relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl" aria-hidden />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(262_83%_58%/0.18)] blur-2xl" aria-hidden />

            <div className="relative">
              <div className="mx-auto mb-5 inline-flex">
                <IconWell color="primary" size="lg"><Sparkles className="w-10 h-10" strokeWidth={2.5} /></IconWell>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(262_83%_58%)] mb-3">One More Step</p>
              <h1 className="text-3xl font-extrabold text-slate-900 mb-3 leading-tight">Almost Ready for Your Adventure!</h1>
              <p className="text-base text-slate-600 mb-6 leading-relaxed">
                {isParent
                  ? "Before your child can start their Discovery Adventure, you need to complete the Parent Assessment first. This helps us personalize the experience just for them!"
                  : "Your parent needs to finish setting things up first! Ask them to complete the Parent Assessment so we can make your adventure just right for you."}
              </p>

              <div className="vi-card p-4 mb-6 text-left bg-white">
                <div className="flex items-center gap-3">
                  <IconWell color="primary" size="sm"><ClipboardList className="w-5 h-5" strokeWidth={2.5} /></IconWell>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-extrabold text-sm">Parent Assessment</p>
                    <p className="text-slate-500 text-xs">
                      {isParent
                        ? "Tell us about your child's communication, learning style, and needs."
                        : "Your parent will answer questions about how you learn best."}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[hsl(43_100%_50%/0.16)] text-[hsl(43_100%_50%)] text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap">Needed</span>
                </div>
              </div>

              {isParent ? (
                <button
                  onClick={() => router.push(`/dashboard/parent/learner/${queryLearnerId || ""}`)}
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold text-lg shadow-xl shadow-[hsl(262_83%_58%/0.3)] hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(262_83%_58%)] focus-visible:ring-offset-2"
                  style={{ minHeight: "48px" }}
                >
                  Complete Parent Assessment <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-500 text-sm">Ask your parent or caregiver to log in and complete the setup.</p>
                  <button
                    onClick={() => router.push("/dashboard/learner")}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border-2 border-slate-200 text-slate-700 font-extrabold hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%)]"
                    style={{ minHeight: "48px" }}
                  >
                    <Home className="w-4 h-4" /> Go Back Home
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const effectiveId = resolvedLearnerId || user.id;
  const isParent = user.role === "PARENT";
  const postBaselineHref = isParent && queryLearnerId
    ? `/dashboard/parent/learner/${queryLearnerId}/brain-review`
    : "/dashboard/learner";

  return (
    <DiscoveryAdventureInner
      learnerId={effectiveId}
      learnerName={learnerName}
      functioningLevel={learnerFL}
      accessToken={accessToken}
      refreshToken={refreshToken}
      postBaselineHref={postBaselineHref}
    />
  );
}

function DiscoveryAdventureInner({
  learnerId, learnerName, functioningLevel, accessToken, refreshToken, postBaselineHref,
}: {
  learnerId: string;
  learnerName: string;
  functioningLevel: FunctioningLevel;
  accessToken: string | null;
  refreshToken: () => Promise<string | null>;
  postBaselineHref: string;
}) {
  const router = useRouter();
  const t = useTranslations("assessment");
  const {
    state, chapters, getCurrentActivity, getCurrentActivities,
    startAdventure, beginFirstChapter, startChapterActivities, handleAnswer,
    advanceToNextChapter, resumeAfterBreak, exitToHome, hasSavedProgress, submitResults,
  } = useDiscoveryEngine({ learnerId, learnerName, functioningLevel, accessToken, refreshToken });

  useEffect(() => {
    if (!hasSavedProgress()) startAdventure();
  }, [startAdventure, hasSavedProgress]);

  const currentChapter = chapters[state.currentChapterIdx];
  const currentActivity = getCurrentActivity();
  const currentActivities = getCurrentActivities();
  const lastResult = state.chapterResults[state.chapterResults.length - 1];

  if (state.phase === "loading") {
    return <ViLoadingScreen icon={<Sparkles className="w-10 h-10" strokeWidth={2.5} />} title={t("ai_preparing")} subtitle={t("personalizing")} />;
  }

  if (state.phase === "pre-adventure") {
    return <PreAdventure learnerName={learnerName} onStart={beginFirstChapter} />;
  }

  if (state.phase === "chapter-intro" && currentChapter) {
    return (
      <div>
        <div className="fixed top-0 left-0 right-0 z-50">
          <AdventureMap currentChapterIdx={state.currentChapterIdx} chapterResults={state.chapterResults} totalChapters={chapters.length} />
        </div>
        <ChapterIntro
          chapter={currentChapter}
          chapterNumber={state.currentChapterIdx + 1}
          totalChapters={chapters.length}
          onReady={startChapterActivities}
        />
      </div>
    );
  }

  if (state.phase === "activity" && currentChapter && currentActivity) {
    return (
      <div>
        <div className="fixed top-0 left-0 right-0 z-50">
          <AdventureMap currentChapterIdx={state.currentChapterIdx} chapterResults={state.chapterResults} totalChapters={chapters.length} />
        </div>
        <ActivityRenderer
          activity={currentActivity}
          chapter={currentChapter}
          activityNumber={state.currentActivityIdx + 1}
          totalActivities={currentActivities.length}
          onAnswer={handleAnswer}
          onSkip={() => handleAnswer(false, 0)}
        />
      </div>
    );
  }

  if (state.phase === "chapter-complete" && currentChapter && lastResult) {
    return (
      <ChapterComplete
        chapter={currentChapter}
        result={lastResult}
        isLastChapter={state.currentChapterIdx >= chapters.length - 1}
        onContinue={advanceToNextChapter}
      />
    );
  }

  if (state.phase === "break") {
    return <BreakActivity chapterNumber={state.currentChapterIdx + 1} onBreakComplete={resumeAfterBreak} functioningLevel={functioningLevel} />;
  }

  if (state.phase === "finale") {
    return (
      <Finale
        learnerName={learnerName}
        learnerId={learnerId}
        chapterResults={state.chapterResults}
        totalCorrect={state.totalCorrect}
        totalAttempts={state.totalAttempts}
        xpEarned={state.xpEarned}
        functioningLevel={functioningLevel}
        onFinish={() => router.push(postBaselineHref)}
        onExitHome={() => { exitToHome(); router.push(postBaselineHref); }}
        onSubmitResults={submitResults}
      />
    );
  }

  if (state.phase === "results") {
    router.push("/dashboard/learner");
    return null;
  }

  return null;
}
