"use client";

/**
 * Sprint 12 — the lesson player's beat state machine, extracted verbatim
 * from the original lesson-player.tsx into a render-free hook.
 *
 * Owns: beat order derivation (incl. the `shorterSteps` story omission),
 * current index + `?step=` resume sync, feedback/hint state, the four
 * legacy counters, break entry/exit (including the `breakReminders`
 * interval — the machine is the chosen home for BREAK_REMINDER_MS since
 * `onBreak` is machine state), the Wave E agent loop, and completion.
 * All network writes flow through the Sprint 08 outbox-backed
 * lesson-player-mutations module.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  SurfaceRouterItem,
  SurfaceRouterSubmitResult,
  SurfaceTelemetryEvent,
} from "@aivo/learner-surfaces";
import { createLessonRunApi } from "../lesson-player-mutations";
import { toast } from "@/lib/use-toast";
import {
  PRESENTABLE_SURFACES,
  type AgentTurnDecision,
  type LessonAgentConfig,
  type LessonAgentDirective,
} from "@/lib/learner/agent-directives";
import type {
  AccessibilityPreferences,
  GeneratedLessonPlan,
  LessonRunStatus,
  LessonStepKind,
} from "@/lib/db/types";
import { type Beat, type InteractiveBeat, buildBeats, isCorrect } from "./beats";
import { toSurfaceItem as buildSurfaceItem } from "./surface-item";

/**
 * How often the "Break reminders" preference nudges the learner. Long, calm
 * cadence — this is a gentle prompt, not a nag. The break screen already
 * exists; the reminder just routes the learner into it on a timer.
 */
export const BREAK_REMINDER_MS = 10 * 60_000;

export interface BeatMachineOptions {
  learnerId: string;
  lessonRunId: string;
  plan: GeneratedLessonPlan;
  accessibility: AccessibilityPreferences;
  initialStatus: LessonRunStatus;
  agent?: LessonAgentConfig | null;
}

export interface BeatMachineState {
  beats: Beat[];
  stepIdx: number;
  beat: Beat;
  isLastBeat: boolean;
  isInteractive: boolean;
  feedback: null | "correct" | "incorrect";
  showHint: boolean;
  onBreak: boolean;
  completing: boolean;
  completeError: string | null;
  agentMsg: string | null;
  agentThinking: boolean;
  agentBreakOffer: { durationSeconds: number } | null;
  agentEndEarly: { reason: string } | null;
  agentScaffold: string | null;
}

export interface BeatMachineActions {
  advance: () => void;
  back: () => void;
  submitSurface: (result: SurfaceRouterSubmitResult) => void;
  requestHint: () => void;
  useScaffold: () => void;
  complete: (abandoned: boolean) => void;
  startBreak: () => void;
  endBreak: () => void;
  acceptAgentBreak: () => void;
  declineAgentBreak: () => void;
  toSurfaceItem: (beat: InteractiveBeat) => SurfaceRouterItem;
  emitMediaTelemetry: (surfaceType: "video" | "audio", event: string) => void;
  emitSurfaceTelemetry: (event: SurfaceTelemetryEvent) => void;
}

export function useBeatMachine({
  learnerId,
  lessonRunId,
  plan,
  accessibility,
  initialStatus,
  agent,
}: BeatMachineOptions): BeatMachineState & BeatMachineActions {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("learner.lesson_player");
  // One typed, outbox-backed network layer for every write this player
  // makes — see lesson-player-mutations.ts. The first offline queue event
  // per run surfaces a single calm toast.
  const runApi = useMemo(
    () =>
      createLessonRunApi({
        learnerId,
        lessonRunId,
        onQueuedOffline: (kind) =>
          toast({
            title: t(kind === "complete" ? "offline_complete_title" : "offline_saved_title"),
            description: t("offline_saved_body"),
            variant: "success",
          }),
      }),
    [learnerId, lessonRunId, t],
  );
  // Base beats are static per mount (plan + prefs arrive as server props).
  // Held in state (not useMemo) because an accepted agent `remediate`
  // splices a remediation beat after the current one — with the agent
  // off, the state never updates and rendering is identical to before.
  const [beats, setBeats] = useState<Beat[]>(() =>
    buildBeats(plan, accessibility.shorterSteps),
  );
  const startStep = (() => {
    const raw = Number(searchParams?.get("step") ?? 0);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.min(raw, beats.length - 1);
  })();
  const [stepIdx, setStepIdx] = useState(startStep);
  const [feedback, setFeedback] = useState<null | "correct" | "incorrect">(null);
  const [showHint, setShowHint] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  // The four counters and the start timestamp below are kept only for
  // their re-render side-effect (and to mirror the legacy on-device state
  // shape). The server now derives checks/hints/scaffolds/seconds from
  // LessonInteraction rows; see complete() below. Prefixed with `_` to
  // signal intentional unused-read.
  const [_hintsUsed, setHintsUsed] = useState(0);
  const [_scaffoldsUsed, setScaffoldsUsed] = useState(0);
  const [_checksTotal, setChecksTotal] = useState(0);
  const [_checksCorrect, setChecksCorrect] = useState(0);
  const [completing, startTransition] = useTransition();
  const [completeError, setCompleteError] = useState<string | null>(null);
  const _startTimeRef = useRef<number>(Date.now());
  const seenBeats = useRef<Set<string>>(new Set());
  const beat = beats[stepIdx];
  const isLastBeat = stepIdx === beats.length - 1;
  const isInteractive = beat.kind === "guided" || beat.kind === "check";

  // ── Wave E (S9): agent-loop state. Inert unless `agent` is provided. ──
  const agentSessionRef = useRef<string | null>(null);
  const [agentMsg, setAgentMsg] = useState<string | null>(null);
  const [agentThinking, setAgentThinking] = useState(false);
  const [agentBreakOffer, setAgentBreakOffer] = useState<{ durationSeconds: number } | null>(
    null,
  );
  const [agentEndEarly, setAgentEndEarly] = useState<{ reason: string } | null>(null);
  const [agentScaffold, setAgentScaffold] = useState<string | null>(null);
  const [agentSurfaceOverride, setAgentSurfaceOverride] = useState<string | null>(null);
  const missStreakRef = useRef(0);
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const hintsRef = useRef(0);
  const scaffoldsRef = useRef(0);
  const beatStartRef = useRef<number>(Date.now());
  const stepIdxRef = useRef(0);
  // S10: a break taken during this beat is the player's frustration
  // signal — it triggers a fresh learner-snapshot fetch server-side.
  const frustrationRef = useRef(false);

  // Mark lesson_started once on mount when status === "ready".
  // Deps are intentionally empty: this is a mount-only side-effect.
  useEffect(() => {
    if (initialStatus === "ready") {
      runApi.markStarted();
    }
  }, []);

  // Wave E (S9): open the tutor-agent session once on mount when agentic
  // mode is on for this lesson. Any failure leaves agentSessionRef null and
  // the player runs exactly as before — the agent is never load-bearing.
  // Mount-only by design (agent identity is fixed per lesson run).
  useEffect(() => {
    if (!agent) return;
    let cancelled = false;
    fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/agent-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(4000),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          json: {
            data?: { enabled?: boolean; session?: { sessionId?: string } };
          } | null,
        ) => {
          if (cancelled) return;
          const data = json?.data;
          const sid = data?.enabled === true ? data.session?.sessionId : null;
          if (typeof sid === "string" && sid) agentSessionRef.current = sid;
        },
      )
      .catch(() => {
        // Agent open failed (timeout/offline). Explicitly degradable: the
        // ref stays null and the lesson runs exactly as a non-agent lesson.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // `hapticsEnabled` preference — fire a short vibration on answer feedback
  // (Web Vibration API; a no-op on desktop / unsupported browsers). Honors the
  // pref so a learner who finds vibration aversive never feels it.
  const pulse = useCallback(
    (pattern: number | number[]) => {
      if (!accessibility.hapticsEnabled) return;
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(pattern);
      }
    },
    [accessibility.hapticsEnabled],
  );

  // `breakReminders` preference — gently route the learner into the existing
  // break screen on a calm cadence. Cleared on unmount or when the pref flips.
  useEffect(() => {
    if (!accessibility.breakReminders) return;
    const id = window.setInterval(() => setOnBreak(true), BREAK_REMINDER_MS);
    return () => window.clearInterval(id);
  }, [accessibility.breakReminders]);

  // `extraHints` preference — surface the hint by default on guided beats
  // instead of requiring the learner to ask. (They can still ignore it.)
  useEffect(() => {
    if (accessibility.extraHints && beat.kind === "guided") setShowHint(true);
  }, [stepIdx, accessibility.extraHints]);

  // Persist current step in URL + emit lesson_step_viewed once per beat.
  useEffect(() => {
    if (onBreak) return;
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(stepIdx));
    window.history.replaceState({}, "", url.toString());
    if (!seenBeats.current.has(beat.key)) {
      seenBeats.current.add(beat.key);
      const stepKind: LessonStepKind =
        beat.kind === "welcome"
          ? "intro"
          : beat.kind === "goal"
            ? "intro"
            : beat.kind === "story"
              ? "intro"
              : beat.kind === "micro"
                ? "micro_lesson"
                : beat.kind === "example"
                  ? "example"
                  : beat.kind === "guided"
                    ? "guided_practice"
                    : beat.kind === "check"
                      ? "check_for_understanding"
                      : beat.kind === "celebrate"
                        ? "celebrate"
                        : beat.kind === "progress"
                          ? "progress_update"
                          : "next_step";
      postStep({
        stepKind,
        stepRefId: beat.kind === "guided" ? beat.gpId : beat.kind === "check" ? beat.checkId : null,
      });
    }
  }, [stepIdx, beat, learnerId, lessonRunId, onBreak]);

  function emitMediaTelemetry(surfaceType: "video" | "audio", event: string) {
    postStep({
      stepKind: "answer_submitted",
      stepRefId: beat.kind === "guided" ? beat.gpId : beat.kind === "check" ? beat.checkId : null,
      response: `media:${surfaceType}:${event}`,
      isCorrect: null,
    });
  }

  /**
   * Sprint 9 — wrap every step POST with an Idempotency-Key and
   * enqueue the call to the offline outbox when the network is down.
   * The server short-circuits replays with the same key, so a
   * mid-flight crash + reconnect can't double-record a step.
   */
  function postStep(payload: Record<string, unknown>): void {
    runApi.postStep(payload);
  }

  function advance() {
    if (stepIdx < beats.length - 1) {
      setStepIdx(stepIdx + 1);
      setFeedback(null);
      setShowHint(false);
    }
  }

  function back() {
    setStepIdx(Math.max(0, stepIdx - 1));
  }

  // Wave E (S9): entering a beat resets the per-beat agent surface state.
  useEffect(() => {
    beatStartRef.current = Date.now();
    stepIdxRef.current = stepIdx;
    frustrationRef.current = false;
    if (!agent) return;
    setAgentScaffold(null);
    setAgentSurfaceOverride(null);
    setAgentMsg(null);
  }, [stepIdx, agent]);

  // S10: a break during the beat marks the frustration signal for the
  // next observation (works for learner-initiated and reminder breaks).
  useEffect(() => {
    if (onBreak) frustrationRef.current = true;
  }, [onBreak]);

  /**
   * Wave E (S9): apply one validated agent directive. Every branch is a
   * defined, bounded behaviour; unknown shapes land on "none" upstream.
   */
  function applyAgentDirective(directive: LessonAgentDirective) {
    switch (directive.type) {
      case "none":
        return;
      case "advance":
        if (directive.encouragement) setAgentMsg(directive.encouragement);
        return;
      case "say":
        setAgentMsg(directive.text);
        return;
      case "show_scaffold":
        setAgentScaffold(directive.text);
        return;
      case "insert_remediation": {
        // Mirror of SessionMachine.insertBeat: splice right after the
        // current beat so "Next" lands on the re-teach moment.
        const framed =
          directive.approach === "worked_example"
            ? t("agent_remediation_worked", {
                focus: directive.focus,
                prompt: plan.example.prompt,
                explanation: plan.example.explanation,
              })
            : t("agent_remediation_intro", { focus: directive.focus });
        const remBeat: Beat = {
          kind: "micro",
          key: `agent-rem-${Date.now()}`,
          body: framed,
        };
        setBeats((prev) => [
          ...prev.slice(0, stepIdx + 1),
          remBeat,
          ...prev.slice(stepIdx + 1),
        ]);
        setAgentMsg(t("agent_remediation_msg"));
        return;
      }
      case "offer_break":
        setAgentBreakOffer({ durationSeconds: directive.durationSeconds });
        return;
      case "switch_modality":
        setAgentMsg(t(`agent_modality_${directive.modality}`));
        return;
      case "present_surface":
        if (isInteractive && PRESENTABLE_SURFACES.has(directive.surfaceType)) {
          setAgentSurfaceOverride(directive.surfaceType);
          setAgentMsg(t("agent_new_surface"));
        }
        return;
      case "end_early":
        setAgentEndEarly({ reason: directive.reason });
        return;
    }
  }

  /**
   * Wave E (S9): one agent turn after an answer. Hard 1500ms deadline —
   * on timeout (or any failure) the fetch aborts, the late decision is
   * DISCARDED, and the player continues deterministically. The server
   * still records the turn for its ladder; the learner never waits.
   */
  function runAgentTurn(interactiveBeat: InteractiveBeat, candidate: string, correct: boolean) {
    const sessionId = agentSessionRef.current;
    if (!agent || !sessionId || agentThinking || agentEndEarly) return;
    const observation = {
      beatIndex: stepIdx,
      totalBeats: beats.length,
      beatKind: interactiveBeat.kind,
      beatKinds: beats.map((b) => b.kind),
      prompt: interactiveBeat.prompt,
      learnerResponse: candidate,
      isCorrect: correct,
      expectedAnswer: interactiveBeat.expectedAnswer,
      attemptsOnBeat: attemptsRef.current.get(interactiveBeat.key) ?? 1,
      hintsUsed: hintsRef.current,
      scaffoldsUsed: scaffoldsRef.current,
      recentMissStreak: missStreakRef.current,
      secondsOnBeat: Math.max(0, Math.round((Date.now() - beatStartRef.current) / 1000)),
      skillId: interactiveBeat.kind === "guided" ? interactiveBeat.skillId : undefined,
      frustrationEvent: frustrationRef.current || undefined,
    };
    const requestStep = stepIdx;
    setAgentThinking(true);
    fetch(`/api/bff/learners/${learnerId}/lesson-runs/${lessonRunId}/agent-turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, observation }),
      signal: AbortSignal.timeout(1500),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          json: {
            data?: {
              enabled?: boolean;
              decision?: AgentTurnDecision;
              directive?: LessonAgentDirective;
            };
          } | null,
        ) => {
          // Discard a decision that lands after the learner moved on —
          // beats must never shift underneath the current position.
          if (stepIdxRef.current !== requestStep) return;
          const data = json?.data;
          if (data?.enabled === true && data.directive) {
            applyAgentDirective(data.directive);
          }
        },
      )
      .catch(() => {
        // Timeout / network — deterministic advance, exactly today's flow.
      })
      .finally(() => setAgentThinking(false));
  }

  function emitSurfaceTelemetry(event: SurfaceTelemetryEvent) {
    runApi.postSurfaceTelemetry({
      learnerId,
      sessionId: lessonRunId,
      eventType: event.type,
      payload: event.payload ?? {},
    });
  }

  function toSurfaceItem(sourceBeat: InteractiveBeat): SurfaceRouterItem {
    return buildSurfaceItem(sourceBeat, agentSurfaceOverride, {
      instructionsGuided: t("instructions_guided"),
      instructionsCheck: t("instructions_check"),
      answerLabel: t("answer_label"),
      answerPlaceholder: t("answer_placeholder"),
    });
  }

  function submitSurface(result: SurfaceRouterSubmitResult) {
    if (!isInteractive) return;
    const interactiveBeat = beat.kind === "guided" || beat.kind === "check" ? beat : null;
    if (!interactiveBeat) return;
    const expected = interactiveBeat.expectedAnswer;
    const candidate =
      typeof result.response.answer === "string"
        ? result.response.answer
        : (result.response.selectedChoiceId ?? "");
    const correct = result.isCorrect === null ? isCorrect(expected, candidate) : result.isCorrect;

    setFeedback(correct ? "correct" : "incorrect");
    // Distinct haptic signatures: a single soft tap for correct, a short
    // double-buzz for "not quite". No-op unless hapticsEnabled.
    pulse(correct ? 30 : [20, 40, 20]);
    if (beat.kind === "check") {
      setChecksTotal((n) => n + 1);
      if (correct) setChecksCorrect((n) => n + 1);
    }
    postStep({
      stepKind: "answer_submitted",
      stepRefId:
        interactiveBeat.kind === "guided"
          ? interactiveBeat.gpId
          : interactiveBeat.kind === "check"
            ? interactiveBeat.checkId
            : null,
      response: candidate,
      isCorrect: correct,
    });
    // Wave E (S9): hand the observation to the tutor agent (no-op when
    // agentic mode is off for this lesson).
    attemptsRef.current.set(
      interactiveBeat.key,
      (attemptsRef.current.get(interactiveBeat.key) ?? 0) + 1,
    );
    missStreakRef.current = correct ? 0 : missStreakRef.current + 1;
    runAgentTurn(interactiveBeat, candidate, correct);
  }

  function requestHint() {
    if (beat.kind !== "guided") return;
    setShowHint(true);
    setHintsUsed((n) => n + 1);
    hintsRef.current += 1;
    postStep({ stepKind: "hint_used", stepRefId: beat.gpId });
  }

  function useScaffold() {
    if (beat.kind !== "guided") return;
    setScaffoldsUsed((n) => n + 1);
    scaffoldsRef.current += 1;
    postStep({ stepKind: "scaffold_used", stepRefId: beat.gpId });
  }

  function complete(abandoned: boolean) {
    // The BFF now derives checks/hints/scaffolds/seconds from server-recorded
    // LessonInteraction rows (post-architect-review hardening). The client
    // only contributes `abandoned` (a UX signal not represented in
    // interactions) and, for agent lessons, the agentSessionId so the BFF
    // can close the agent session server-side and weave the agent's parent
    // note into the run summary (Wave E S11).
    const agentSessionId = agent ? agentSessionRef.current : null;
    startTransition(async () => {
      const { done } = await runApi.complete({
        outcome: { abandoned },
        ...(agentSessionId ? { agentSessionId } : {}),
      });
      if (!done) {
        // Surface the failure instead of redirecting blindly — otherwise the
        // run would silently stay in_progress and mastery would never update.
        // The agent session id is kept so a retry can still close it.
        setCompleteError(t("complete_error"));
        return;
      }
      // Completed — or queued offline with a toast; the outbox replay
      // finishes the run server-side. Either way the learner moves on.
      agentSessionRef.current = null;
      router.push("/learner/home");
      router.refresh();
    });
  }

  return {
    beats,
    stepIdx,
    beat,
    isLastBeat,
    isInteractive,
    feedback,
    showHint,
    onBreak,
    completing,
    completeError,
    agentMsg,
    agentThinking,
    agentBreakOffer,
    agentEndEarly,
    agentScaffold,
    advance,
    back,
    submitSurface,
    requestHint,
    useScaffold,
    complete,
    startBreak: () => setOnBreak(true),
    endBreak: () => setOnBreak(false),
    acceptAgentBreak: () => {
      setAgentBreakOffer(null);
      setOnBreak(true);
    },
    declineAgentBreak: () => setAgentBreakOffer(null),
    toSurfaceItem,
    emitMediaTelemetry,
    emitSurfaceTelemetry,
  };
}
