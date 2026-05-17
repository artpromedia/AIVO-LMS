"use client";
import { useCallback, useRef, useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse, SurfaceTelemetryEvent } from "@aivo/learner-surfaces";
import type { Beat, SessionPhase, SessionState, FunctioningLevel } from "./types";
import type { TutorKey } from "@aivo/brand";
import { SESSION_DURATIONS } from "./types";

export interface SurfaceSubmissionFeedback {
  surfaceId: string;
  correct: boolean;
  score: number;
  feedback: string;
  misconceptions: string[];
}

// Sprint 06: deterministic recommendation candidate as returned by
// POST /api/tutor/recommendation-candidates. Mirrors the @aivo/scoring
// RecommendationCandidate shape but kept loosely typed in the web
// layer so the API contract change is the source of truth.
export interface RecommendationCandidate {
  kind:
    | "repeated_misconception"
    | "low_process_engagement"
    | "high_hint_dependence"
    | "mastery_signal"
    | "frustration_signal"
    | "accommodation_hint";
  confidence: number;
  title: string;
  rationale: string;
  evidenceIndices: number[];
  payload: Record<string, unknown>;
}

interface RecommendationSampleInternal {
  surfaceId: string;
  occurredAt: string;
  result: {
    correct: boolean;
    score: number;
    feedback: string;
    misconceptions: string[];
    mode: string;
  };
  durationMs?: number;
  inkStrokeCount?: number;
  geometryActionCount?: number;
  hintsRequested?: number;
}

export interface SessionProcessSignals {
  surfaceEvents: SurfaceTelemetryEvent[];
  surfaceResponses: SurfaceResponse[];
  surfaceFeedback: SurfaceSubmissionFeedback[];
  beatsCompleted: number;
  attemptedAnswers: number;
  correctAnswers: number;
  scratchpadUseCount: number;
  hintUsageCount: number;
  erasuresCount: number;
}

const INITIAL_PROCESS_SIGNALS: SessionProcessSignals = {
  surfaceEvents: [],
  surfaceResponses: [],
  surfaceFeedback: [],
  beatsCompleted: 0,
  attemptedAnswers: 0,
  correctAnswers: 0,
  scratchpadUseCount: 0,
  hintUsageCount: 0,
  erasuresCount: 0,
};

const INITIAL_STATE: SessionState = {
  phase: "loading",
  currentBeatIndex: 0,
  beats: [],
  totalBeats: 0,
  xpEarned: 0,
  coinsEarned: 0,
  correctCount: 0,
  totalAttempts: 0,
  startedAt: Date.now(),
  tutorKey: "nova" as TutorKey,
  learnerId: "",
  functioningLevel: "STANDARD",
};

export function useSessionFlow(
  tutorKey: TutorKey,
  learnerId: string,
  functioningLevel: FunctioningLevel,
) {
  const [state, setState] = useState<SessionState>({
    ...INITIAL_STATE,
    tutorKey,
    learnerId,
    functioningLevel,
    startedAt: Date.now(),
  });
  const [processSignals, setProcessSignals] =
    useState<SessionProcessSignals>(INITIAL_PROCESS_SIGNALS);
  const [lastFeedback, setLastFeedback] = useState<SurfaceSubmissionFeedback | null>(null);
  const [recommendationCandidates, setRecommendationCandidates] = useState<
    RecommendationCandidate[]
  >([]);
  const recommendationSamplesRef = useRef<RecommendationSampleInternal[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxDurationMs = SESSION_DURATIONS[functioningLevel].max * 60 * 1000;

  const setPhase = useCallback((phase: SessionPhase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const loadBeats = useCallback((beats: Beat[], sessionId?: string, learnerName?: string) => {
    setState((s) => ({
      ...s,
      beats,
      totalBeats: beats.length,
      currentBeatIndex: 0,
      sessionId,
      learnerName,
      phase: "opening",
      startedAt: Date.now(),
    }));
    setProcessSignals(INITIAL_PROCESS_SIGNALS);
  }, []);

  const derivePhase = useCallback((beatIndex: number, beats: Beat[]): SessionPhase => {
    if (beats.length === 0) return "loading";
    const beat = beats[beatIndex];
    if (!beat) return "celebration";
    if (beatIndex === 0) return "opening";
    if (beat.id.startsWith("warmup") || beat.id === "warmup") return "warmup";
    if (beat.id.startsWith("check") || beat.id === "check") return "check";
    if (beat.id.startsWith("close") || beat.type === "celebration") return "celebration";
    return "core";
  }, []);

  const nextBeat = useCallback(() => {
    setState((s) => {
      const next = s.currentBeatIndex + 1;
      if (next >= s.beats.length) {
        return { ...s, phase: "celebration" };
      }
      const elapsed = Date.now() - s.startedAt;
      if (elapsed > maxDurationMs) {
        return { ...s, phase: "celebration" };
      }
      const phase = derivePhase(next, s.beats);
      return { ...s, currentBeatIndex: next, phase };
    });
    setProcessSignals((p) => ({ ...p, beatsCompleted: p.beatsCompleted + 1 }));
  }, [maxDurationMs, derivePhase]);

  const recordAnswer = useCallback(
    (correct: boolean, xp: number = 0, coins: number = 0, payload?: Record<string, unknown>) => {
      setState((s) => ({
        ...s,
        correctCount: s.correctCount + (correct ? 1 : 0),
        totalAttempts: s.totalAttempts + 1,
        xpEarned: s.xpEarned + xp,
        coinsEarned: s.coinsEarned + coins,
      }));
      setProcessSignals((p) => ({
        ...p,
        attemptedAnswers: p.attemptedAnswers + 1,
        correctAnswers: p.correctAnswers + (correct ? 1 : 0),
        erasuresCount: p.erasuresCount + Number(payload?.erasureCount ?? 0),
        scratchpadUseCount:
          p.scratchpadUseCount + (Number(payload?.inkStrokeCount ?? 0) > 0 ? 1 : 0),
      }));
    },
    [],
  );

  // Sprint 02 / 03 adapter: flag-aware fire-and-forget telemetry relay.
  // When NEXT_PUBLIC_AIVO_FEATURE_PROBLEM_SESSION_LEDGER is "true" / "1" /
  // "yes" / "on", surface events and final answers are POSTed to a relay
  // endpoint in learning-svc which forwards them to the problem-session
  // ledger. The call is fire-and-forget: errors never reach the UI.
  const ledgerEnabled =
    typeof process !== "undefined" &&
    ["1", "true", "yes", "on"].includes(
      String(process.env.NEXT_PUBLIC_AIVO_FEATURE_PROBLEM_SESSION_LEDGER ?? "")
        .trim()
        .toLowerCase(),
    );

  const emitTelemetry = useCallback(
    (eventType: string, payload: Record<string, unknown>): void => {
      if (!ledgerEnabled) return;
      const sessionId = (typeof window !== "undefined" ? state.sessionId : undefined) ?? undefined;
      if (!sessionId || !state.learnerId) return;
      void fetch("/api/learning/surface-telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learnerId: state.learnerId,
          sessionId,
          eventType,
          payload,
        }),
      }).catch(() => {
        // Swallow — telemetry is best-effort.
      });
    },
    [ledgerEnabled, state.sessionId, state.learnerId],
  );

  const recordSurfaceEvent = useCallback(
    (event: SurfaceTelemetryEvent) => {
      setProcessSignals((p) => {
        const hintBumped = event.type === "tool_changed" && event.payload?.tool === "hint" ? 1 : 0;
        return {
          ...p,
          surfaceEvents: [...p.surfaceEvents, event],
          hintUsageCount: p.hintUsageCount + hintBumped,
        };
      });
      // Emit aggregated event types to the ledger (NOT every pointer event,
      // per the Sprint 03 high-volume-mode rule).
      if (event.type === "tool_changed" && event.payload?.tool === "hint") {
        emitTelemetry("hint_requested", { tool: "hint" });
      }
      if (event.type === "surface_started") {
        emitTelemetry("surface_rendered", { surfaceId: event.surfaceId });
      }
    },
    [emitTelemetry],
  );

  const recordSurfaceResponse = useCallback(
    (response: SurfaceResponse, surface?: LearnerSurfaceSpec) => {
      setProcessSignals((p) => ({
        ...p,
        surfaceResponses: [...p.surfaceResponses, response],
      }));
      emitTelemetry("answer_attempted", {
        surfaceId: response.surfaceId,
        hasAnswer: response.answer !== undefined,
        hasInk: Array.isArray(response.inkStrokes) && response.inkStrokes.length > 0,
        geometryActionCount: Array.isArray(response.geometryActions)
          ? response.geometryActions.length
          : 0,
      });

      // Sprint 05: when the surface spec is forwarded, run real
      // scoring via tutor-svc and store the feedback. No demo
      // fallback — failures are silent here but logged via the
      // existing rejection telemetry hook.
      if (!surface || !state.learnerId) return;
      void fetch("/api/tutor/surface-submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learnerId: state.learnerId,
          sessionId: state.sessionId ?? undefined,
          tutorKey: state.tutorKey,
          surface: { id: surface.id, type: surface.type, scoring: surface.scoring },
          response,
        }),
      })
        .then(async (res) => (res.ok ? res.json() : null))
        .then((data: unknown) => {
          if (!data || typeof data !== "object") return;
          const d = data as Partial<SurfaceSubmissionFeedback> & {
            surfaceId?: string;
          };
          if (typeof d.surfaceId !== "string") return;
          const entry: SurfaceSubmissionFeedback = {
            surfaceId: d.surfaceId,
            correct: Boolean(d.correct),
            score: typeof d.score === "number" ? d.score : 0,
            feedback: typeof d.feedback === "string" ? d.feedback : "",
            misconceptions: Array.isArray(d.misconceptions) ? d.misconceptions : [],
          };
          setProcessSignals((p) => ({
            ...p,
            surfaceFeedback: [...p.surfaceFeedback, entry],
          }));
          setLastFeedback(entry);

          // Sprint 06: append a deterministic sample, then ask
          // tutor-svc for recommendation candidates derived from the
          // rolling window. No demo fallback — silent on network
          // failure so the stage UI keeps running.
          const mode = typeof (d as { mode?: unknown }).mode === "string"
            ? ((d as { mode: string }).mode)
            : "exact";
          const sample: RecommendationSampleInternal = {
            surfaceId: entry.surfaceId,
            occurredAt: new Date().toISOString(),
            result: {
              correct: entry.correct,
              score: entry.score,
              feedback: entry.feedback,
              misconceptions: entry.misconceptions,
              mode,
            },
            durationMs:
              typeof response.durationMs === "number" ? response.durationMs : undefined,
            inkStrokeCount: Array.isArray(response.inkStrokes)
              ? response.inkStrokes.length
              : 0,
            geometryActionCount: Array.isArray(response.geometryActions)
              ? response.geometryActions.length
              : 0,
          };
          const nextSamples = [...recommendationSamplesRef.current, sample].slice(-24);
          recommendationSamplesRef.current = nextSamples;

          void fetch("/api/tutor/recommendation-candidates", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              learnerId: state.learnerId,
              sessionId: state.sessionId ?? undefined,
              tutorKey: state.tutorKey,
              samples: nextSamples,
            }),
          })
            .then(async (res) => (res.ok ? res.json() : null))
            .then((rec: unknown) => {
              if (!rec || typeof rec !== "object") return;
              const candidates = (rec as { candidates?: unknown }).candidates;
              if (!Array.isArray(candidates)) return;
              setRecommendationCandidates(candidates as RecommendationCandidate[]);
            })
            .catch(() => {
              // best-effort — recommendations are advisory
            });
        })
        .catch(() => {
          // best-effort — UI continues without scoring feedback
        });
    },
    [emitTelemetry, state.learnerId, state.sessionId, state.tutorKey],
  );

  const currentBeat = state.beats[state.currentBeatIndex] || null;
  const progress = state.totalBeats > 0 ? (state.currentBeatIndex + 1) / state.totalBeats : 0;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    state,
    processSignals,
    currentBeat,
    progress,
    lastFeedback,
    recommendationCandidates,
    setPhase,
    loadBeats,
    nextBeat,
    recordAnswer,
    recordSurfaceEvent,
    recordSurfaceResponse,
    cleanup,
  };
}
