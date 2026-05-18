"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type {
  DiscoveryState,
  AdventurePhase,
  DifficultyTier,
  ChapterResult,
  ChapterActivities,
  Activity,
  AdventureChapter,
  FunctioningLevel,
} from "./types";
import { ADVENTURE_CHAPTERS, FUNCTIONING_LEVEL_CONFIG } from "./types";
import { FALLBACK_ACTIVITIES } from "./fallbackActivities";
import { validateDiscoveryActivities } from "./activity-schema";
import { emitDiscoveryEvent } from "./discovery-telemetry";

export type GenerationSource = "ai" | "cache" | "fallback";
export type PersonalizationLevel = "full" | "partial" | "none";

export interface ChapterGenerationStatus {
  chapterId: string;
  source: GenerationSource;
  personalizationLevel: PersonalizationLevel;
  retrying: boolean;
  reason?: string;
  rejectedCount: number;
}

interface UseDiscoveryEngineProps {
  learnerId: string;
  learnerName: string;
  functioningLevel: FunctioningLevel;
  accessToken: string | null;
  refreshToken?: () => Promise<string | null>;
}

const STORAGE_KEY_PREFIX = "aivo_discovery_";

function loadSavedState(learnerId: string): DiscoveryState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${learnerId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiscoveryState;
    if (parsed.phase === "results" || parsed.phase === "finale") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistState(learnerId: string, state: DiscoveryState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${learnerId}`, JSON.stringify(state));
  } catch {}
}

function clearSavedState(learnerId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${learnerId}`);
  } catch {}
}

export function useDiscoveryEngine({
  learnerId,
  learnerName,
  functioningLevel,
  accessToken,
  refreshToken,
}: UseDiscoveryEngineProps) {
  const config = FUNCTIONING_LEVEL_CONFIG[functioningLevel] || FUNCTIONING_LEVEL_CONFIG.STANDARD;
  const chapters = ADVENTURE_CHAPTERS.slice(0, config.chaptersCount);

  const [state, setState] = useState<DiscoveryState>(() => {
    const saved = loadSavedState(learnerId);
    if (saved) return saved;
    return {
      phase: "loading",
      currentChapterIdx: 0,
      currentActivityIdx: 0,
      chapterResults: [],
      startedAt: Date.now(),
      currentDifficulty: "easy",
      streakCorrect: 0,
      streakWrong: 0,
      totalCorrect: 0,
      totalAttempts: 0,
      xpEarned: 0,
      favoriteChapterIdx: 0,
      responseLatencies: [],
    };
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const resumeHandledRef = useRef(false);

  useEffect(() => {
    if (state.phase !== "loading" && state.phase !== "results") {
      persistState(learnerId, state);
    }
    if (state.phase === "results") {
      clearSavedState(learnerId);
    }
  }, [state, learnerId]);

  const chapterActivitiesRef = useRef<Record<string, ChapterActivities>>({});
  const chapterCorrectRef = useRef(0);
  const chapterTotalRef = useRef(0);
  const chapterLatenciesRef = useRef<number[]>([]);
  const loadingChapterRef = useRef<string | null>(null);
  const surfaceSignalsRef = useRef<Array<Record<string, unknown>>>([]);
  // Bumped each time chapter activities are loaded so derived getters
  // (which read from a ref) trigger a re-render in consumers.
  const [, setActivitiesVersion] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<Record<string, ChapterGenerationStatus>>(
    {},
  );

  const validateAndCoerceActivities = useCallback(
    (
      raw: ChapterActivities | undefined,
      chapterId: string,
    ): { activities: ChapterActivities; rejected: number } => {
      if (!raw) return { activities: { easy: [], medium: [], hard: [] }, rejected: 0 };
      const tiers: DifficultyTier[] = ["easy", "medium", "hard"];
      let rejected = 0;
      const out: ChapterActivities = { easy: [], medium: [], hard: [] };
      for (const tier of tiers) {
        const items = raw[tier] || [];
        const result = validateDiscoveryActivities(
          items as unknown as Parameters<typeof validateDiscoveryActivities>[0],
        );
        rejected += result.rejectedActivities.length;
        for (const r of result.rejectedActivities) {
          emitDiscoveryEvent("baseline_activity_rejected", {
            chapterId,
            id: r.id,
            reason: r.reason,
          });
        }
        out[tier] = result.validActivities as unknown as Activity[];
      }
      return { activities: out, rejected };
    },
    [],
  );

  const fetchChapterPayload = useCallback(
    async (chapter: AdventureChapter, token: string) => {
      const res = await fetch(`/api/assessments/learner/discovery/${learnerId}/chapter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          chapter: {
            id: chapter.id,
            title: chapter.title,
            subtitle: chapter.subtitle,
            domain: chapter.domain,
            tutorKey: chapter.tutorKey,
            sceneDescription: chapter.sceneDescription,
          },
        }),
      });
      if (!res.ok) {
        return { ok: false as const, status: res.status, reason: `http_${res.status}` };
      }
      const data = await res.json();
      return { ok: true as const, data };
    },
    [learnerId],
  );

  const loadChapterActivities = useCallback(
    async (chapter: AdventureChapter): Promise<ChapterActivities> => {
      if (chapterActivitiesRef.current[chapter.id]) {
        return chapterActivitiesRef.current[chapter.id];
      }

      const useFallback = (
        reason: string,
        source: GenerationSource = "fallback",
        level: PersonalizationLevel = "none",
      ) => {
        const fallback = FALLBACK_ACTIVITIES[chapter.id] || FALLBACK_ACTIVITIES.sage_story_garden;
        chapterActivitiesRef.current[chapter.id] = fallback;
        setActivitiesVersion((v) => v + 1);
        setGenerationStatus((prev) => ({
          ...prev,
          [chapter.id]: {
            chapterId: chapter.id,
            source,
            personalizationLevel: level,
            retrying: false,
            reason,
            rejectedCount: 0,
          },
        }));
        emitDiscoveryEvent("baseline_generation_fallback_used", { chapterId: chapter.id, reason });
        return fallback;
      };

      if (!accessToken) {
        return useFallback("no_access_token");
      }

      emitDiscoveryEvent("baseline_generation_started", { chapterId: chapter.id });
      setGenerationStatus((prev) => ({
        ...prev,
        [chapter.id]: {
          chapterId: chapter.id,
          source: "ai",
          personalizationLevel: "full",
          retrying: false,
          rejectedCount: 0,
        },
      }));

      let attempt: Awaited<ReturnType<typeof fetchChapterPayload>>;
      try {
        attempt = await fetchChapterPayload(chapter, accessToken);
      } catch (err: any) {
        attempt = { ok: false, status: 0, reason: `network_error:${err?.message ?? "unknown"}` };
      }

      if (!attempt.ok) {
        // Single retry on AI/network failure before falling back.
        setGenerationStatus((prev) => ({
          ...prev,
          [chapter.id]: {
            ...(prev[chapter.id] ?? {
              chapterId: chapter.id,
              source: "ai",
              personalizationLevel: "full",
              rejectedCount: 0,
            }),
            retrying: true,
            reason: attempt.reason,
          },
        }));
        try {
          attempt = await fetchChapterPayload(chapter, accessToken);
        } catch (err: any) {
          attempt = { ok: false, status: 0, reason: `network_error:${err?.message ?? "unknown"}` };
        }
      }

      if (!attempt.ok) {
        emitDiscoveryEvent("baseline_generation_failed", {
          chapterId: chapter.id,
          reason: attempt.reason,
        });
        return useFallback(attempt.reason);
      }

      const data = attempt.data as {
        generated?: boolean;
        activities?: ChapterActivities;
        personalizationLevel?: PersonalizationLevel;
        source?: GenerationSource;
        rejectedActivities?: unknown[];
      };

      if (!data.generated || !data.activities) {
        return useFallback("ai_no_activities");
      }

      const { activities, rejected } = validateAndCoerceActivities(data.activities, chapter.id);
      const hasActivities = (["easy", "medium", "hard"] as DifficultyTier[]).some(
        (tier) => (activities[tier] || []).length > 0,
      );
      if (!hasActivities) {
        return useFallback("all_activities_invalid");
      }

      chapterActivitiesRef.current[chapter.id] = activities;
      setActivitiesVersion((v) => v + 1);
      setGenerationStatus((prev) => ({
        ...prev,
        [chapter.id]: {
          chapterId: chapter.id,
          source: data.source ?? "ai",
          personalizationLevel: data.personalizationLevel ?? "full",
          retrying: false,
          rejectedCount: rejected + (data.rejectedActivities?.length ?? 0),
        },
      }));
      emitDiscoveryEvent("baseline_generation_succeeded", { chapterId: chapter.id, rejected });
      return activities;
    },
    [accessToken, fetchChapterPayload, validateAndCoerceActivities],
  );

  useEffect(() => {
    if (resumeHandledRef.current) return;
    const saved = loadSavedState(learnerId);
    if (!saved) return;
    resumeHandledRef.current = true;
    const needsActivities =
      saved.phase === "activity" ||
      saved.phase === "chapter-intro" ||
      saved.phase === "chapter-complete";
    if (needsActivities && chapters[saved.currentChapterIdx]) {
      loadChapterActivities(chapters[saved.currentChapterIdx]);
    }
  }, [learnerId, chapters, loadChapterActivities]);

  const getCurrentActivities = useCallback((): Activity[] => {
    const chapter = chapters[state.currentChapterIdx];
    if (!chapter) return [];
    const chapterActs = chapterActivitiesRef.current[chapter.id];
    if (!chapterActs) return [];
    const tierActs = chapterActs[state.currentDifficulty] || chapterActs.easy || [];
    return tierActs.slice(0, config.activitiesPerChapter);
  }, [state.currentChapterIdx, state.currentDifficulty, chapters, config.activitiesPerChapter]);

  const getCurrentActivity = useCallback((): Activity | null => {
    const activities = getCurrentActivities();
    return activities[state.currentActivityIdx] || null;
  }, [getCurrentActivities, state.currentActivityIdx]);

  const startAdventure = useCallback(() => {
    setState((s) => ({ ...s, phase: "pre-adventure", startedAt: Date.now() }));
  }, []);

  const beginFirstChapter = useCallback(async () => {
    if (chapters.length === 0) {
      setState((s) => ({ ...s, phase: "finale" }));
      return;
    }
    setState((s) => ({ ...s, phase: "loading" }));
    await loadChapterActivities(chapters[0]);
    chapterCorrectRef.current = 0;
    chapterTotalRef.current = 0;
    chapterLatenciesRef.current = [];
    setState((s) => ({
      ...s,
      phase: "chapter-intro",
      currentChapterIdx: 0,
      currentActivityIdx: 0,
      currentDifficulty: "easy",
    }));
  }, [chapters, loadChapterActivities]);

  const startChapterActivities = useCallback(() => {
    setState((s) => ({ ...s, phase: "activity", currentActivityIdx: 0 }));
  }, []);

  const recordSurfaceSignal = useCallback((signal: Record<string, unknown>) => {
    surfaceSignalsRef.current.push(signal);
  }, []);

  // Sprint 02 telemetry hook. When the problem-session ledger flag is on,
  // discovery activities also push answer telemetry to the relay. Per
  // Sprint 03 we send only aggregate flags (correct, hasInk, latency), not
  // raw stroke data or free-form text. Fire-and-forget.
  const ledgerEnabled =
    typeof process !== "undefined" &&
    ["1", "true", "yes", "on"].includes(
      String(process.env.NEXT_PUBLIC_AIVO_FEATURE_PROBLEM_SESSION_LEDGER ?? "")
        .trim()
        .toLowerCase(),
    );

  const emitDiscoveryTelemetry = useCallback(
    (eventType: string, payload: Record<string, unknown>): void => {
      if (!ledgerEnabled) return;
      if (!learnerId) return;
      void fetch("/api/learning/surface-telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learnerId,
          eventType,
          payload,
        }),
      }).catch(() => {
        // Swallow — telemetry is best-effort.
      });
    },
    [ledgerEnabled, learnerId],
  );

  const retryChapterGeneration = useCallback(
    async (chapter: AdventureChapter) => {
      delete chapterActivitiesRef.current[chapter.id];
      setGenerationStatus((prev) => {
        const next = { ...prev };
        delete next[chapter.id];
        return next;
      });
      return loadChapterActivities(chapter);
    },
    [loadChapterActivities],
  );

  const handleAnswer = useCallback(
    (correct: boolean, latencyMs: number, payload?: Record<string, unknown>) => {
      if (correct) chapterCorrectRef.current++;
      chapterTotalRef.current++;
      chapterLatenciesRef.current.push(latencyMs);
      if (payload) {
        recordSurfaceSignal({ ...payload, latencyMs, correct });
      }
      emitDiscoveryTelemetry("answer_attempted", {
        correct,
        latencyMs,
        hasInk:
          Number((payload as { inkStrokeCount?: number } | undefined)?.inkStrokeCount ?? 0) > 0,
      });

      setState((s) => {
        const newStreakCorrect = correct ? s.streakCorrect + 1 : 0;
        const newStreakWrong = correct ? 0 : s.streakWrong + 1;
        const newXp = s.xpEarned + (correct ? 10 : 3);

        const chapter = chapters[s.currentChapterIdx];
        if (!chapter) return s;

        const chapterActs = chapterActivitiesRef.current[chapter.id];
        if (!chapterActs) return s;
        const tierActs = chapterActs[s.currentDifficulty] || chapterActs.easy || [];
        const activities = tierActs.slice(0, config.activitiesPerChapter);
        const nextIdx = s.currentActivityIdx + 1;

        if (nextIdx >= activities.length) {
          let nextDifficulty = s.currentDifficulty;
          const chapterPct = chapterCorrectRef.current / Math.max(1, chapterTotalRef.current);
          if (chapterPct >= 0.8 && s.currentDifficulty === "easy") nextDifficulty = "medium";
          else if (chapterPct >= 0.8 && s.currentDifficulty === "medium") nextDifficulty = "hard";
          else if (chapterPct < 0.4 && s.currentDifficulty === "hard") nextDifficulty = "medium";
          else if (chapterPct < 0.4 && s.currentDifficulty === "medium") nextDifficulty = "easy";

          const result: ChapterResult = {
            chapterId: chapter.id,
            domain: chapter.domain,
            correct: chapterCorrectRef.current,
            total: chapterTotalRef.current,
            avgLatencyMs:
              chapterLatenciesRef.current.length > 0
                ? chapterLatenciesRef.current.reduce((a, b) => a + b, 0) /
                  chapterLatenciesRef.current.length
                : 0,
            difficulty: s.currentDifficulty,
          };

          return {
            ...s,
            phase: "chapter-complete" as AdventurePhase,
            totalCorrect: s.totalCorrect + (correct ? 1 : 0),
            totalAttempts: s.totalAttempts + 1,
            streakCorrect: newStreakCorrect,
            streakWrong: newStreakWrong,
            xpEarned: newXp,
            currentDifficulty: nextDifficulty,
            chapterResults: [...s.chapterResults, result],
            responseLatencies: [...s.responseLatencies, latencyMs],
          };
        }

        return {
          ...s,
          currentActivityIdx: nextIdx,
          totalCorrect: s.totalCorrect + (correct ? 1 : 0),
          totalAttempts: s.totalAttempts + 1,
          streakCorrect: newStreakCorrect,
          streakWrong: newStreakWrong,
          xpEarned: newXp,
          responseLatencies: [...s.responseLatencies, latencyMs],
        };
      });
    },
    [chapters, config.activitiesPerChapter, emitDiscoveryTelemetry, recordSurfaceSignal],
  );

  const advanceToNextChapter = useCallback(async () => {
    const nextIdx = state.currentChapterIdx + 1;
    if (nextIdx >= chapters.length) {
      setState((s) => ({ ...s, phase: "finale" }));
      return;
    }

    setState((s) => ({ ...s, phase: "break" }));
  }, [state.currentChapterIdx, chapters]);

  const resumeAfterBreak = useCallback(async () => {
    const nextIdx = state.currentChapterIdx + 1;
    if (nextIdx >= chapters.length) {
      setState((s) => ({ ...s, phase: "finale" }));
      return;
    }

    setState((s) => ({ ...s, phase: "loading" }));
    await loadChapterActivities(chapters[nextIdx]);
    chapterCorrectRef.current = 0;
    chapterTotalRef.current = 0;
    chapterLatenciesRef.current = [];
    setState((s) => ({
      ...s,
      phase: "chapter-intro",
      currentChapterIdx: nextIdx,
      currentActivityIdx: 0,
    }));
  }, [state.currentChapterIdx, chapters, loadChapterActivities]);

  const finishAdventure = useCallback(() => {
    clearSavedState(learnerId);
    setState((s) => ({ ...s, phase: "results" }));
  }, [learnerId]);

  const exitToHome = useCallback(() => {
    persistState(learnerId, stateRef.current);
  }, [learnerId]);

  const hasSavedProgress = useCallback(() => {
    return loadSavedState(learnerId) !== null;
  }, [learnerId]);

  const submitResults = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
    code?: string;
    status?: number;
  }> => {
    const payload = JSON.stringify({
      chapterResults: state.chapterResults,
      totalCorrect: state.totalCorrect,
      totalAttempts: state.totalAttempts,
      xpEarned: state.xpEarned,
      responseLatencies: state.responseLatencies,
      surfaceSignals: surfaceSignalsRef.current,
    });

    const doPost = async (token: string) => {
      return fetch(`/api/assessments/learner/discovery/${learnerId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: payload,
      });
    };

    try {
      let token = accessToken;
      if (!token && refreshToken) token = await refreshToken();
      if (!token) return { success: false, error: "No auth token", code: "no_auth_token" };

      let res = await doPost(token);

      if (res.status === 401 && refreshToken) {
        const fresh = await refreshToken();
        if (fresh) {
          res = await doPost(fresh);
        }
      }

      if (res.ok) {
        clearSavedState(learnerId);
        return { success: true };
      } else {
        const raw = await res.text();
        let code: string | undefined;
        let message: string | undefined;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            if (typeof parsed.error === "string") code = parsed.error;
            if (typeof parsed.message === "string") message = parsed.message;
            if (!code && typeof parsed.detail === "string") code = parsed.detail;
          }
        } catch {
          const trimmed = raw.trim();
          if (trimmed === "parent_assessment_required") code = trimmed;
        }
        return {
          success: false,
          error: message || raw || `HTTP ${res.status}`,
          code,
          status: res.status,
        };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error", code: "network_error" };
    }
  }, [
    accessToken,
    refreshToken,
    learnerId,
    state.chapterResults,
    state.totalCorrect,
    state.totalAttempts,
    state.xpEarned,
    state.responseLatencies,
  ]);

  return {
    state,
    chapters,
    config,
    generationStatus,
    getCurrentActivity,
    getCurrentActivities,
    startAdventure,
    beginFirstChapter,
    startChapterActivities,
    handleAnswer,
    recordSurfaceSignal,
    retryChapterGeneration,
    advanceToNextChapter,
    resumeAfterBreak,
    finishAdventure,
    exitToHome,
    hasSavedProgress,
    submitResults,
  };
}
