"use client";

/**
 * Sprint 13: client-side beat-by-beat lesson player.
 *
 * Beats:
 *   welcome → goal → story → micro → example → guided[] → checks[] → celebrate
 *   → progress → next-step
 *
 * - One beat at a time. Large buttons. Enter/Space advance.
 * - Hint and Break buttons. Hint usage is tracked in the outcome.
 * - Resume: current beat index is mirrored to ?step= so refresh keeps place.
 * - Each beat view fires `POST /step` so we have a server-side audit trail.
 * - On the final beat, "I'm done" calls `POST /complete` with the aggregate
 *   outcome (checksCorrect/Total, hintsUsed, scaffoldsUsed, secondsActive).
 * - Honors accessibility prefs (reducedMotion, largeText, dyslexia font,
 *   highContrast) via wrapper classes + animation gating.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type SyntheticEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/page-header";
import { AudioControlBar, FocusMode } from "@/components/playful-calm";
import { MathText } from "@/components/learning/math-text";
import {
  SurfaceRouter,
  type SurfaceRouterItem,
  type SurfaceRouterSubmitResult,
  type SurfaceTelemetryEvent,
} from "@aivo/learner-surfaces";
import { AACTargetProvider, AACScanRoot } from "@aivo/aac-bridge";
import {
  deriveSensoryAdaptations,
  sensoryCSSVars,
  toStageSensoryProfile,
} from "@aivo/stage-runtime";
import type { FunctioningLevel } from "@aivo/stage-ui";
import { createLessonRunApi } from "./lesson-player-mutations";
import { toast } from "@/lib/use-toast";
import { InLessonTutorPanel } from "@/components/learner/in-lesson-tutor-panel";
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

type Beat =
  | { kind: "welcome"; key: string; body: string }
  | { kind: "goal"; key: string; body: string }
  | { kind: "story"; key: string; body: string }
  | { kind: "micro"; key: string; body: string }
  | { kind: "example"; key: string; prompt: string; explanation: string }
  | {
      kind: "guided";
      key: string;
      gpId: string;
      surfaceType: SurfaceRouterItem["surfaceType"];
      prompt: string;
      expectedAnswer?: string;
      choices?: string[];
      hint: string;
      scaffold: string;
      skillId?: string;
      media?: {
        surfaceType: "video" | "audio";
        assets: Array<{
          id: string;
          kind: "video" | "audio" | "captions";
          src: string;
          alt?: string;
          mimeType?: string;
          language?: string;
          label?: string;
          default?: boolean;
        }>;
      };
    }
  | {
      kind: "check";
      key: string;
      checkId: string;
      surfaceType: SurfaceRouterItem["surfaceType"];
      prompt: string;
      expectedAnswer?: string;
      choices?: string[];
      supportIfWrong: string;
      media?: {
        surfaceType: "video" | "audio";
        assets: Array<{
          id: string;
          kind: "video" | "audio" | "captions";
          src: string;
          alt?: string;
          mimeType?: string;
          language?: string;
          label?: string;
          default?: boolean;
        }>;
      };
    }
  | { kind: "celebrate"; key: string; body: string }
  | { kind: "progress"; key: string; body: string }
  | { kind: "next"; key: string; body: string };

function buildBeats(plan: GeneratedLessonPlan, shorter: boolean): Beat[] {
  const beats: Beat[] = [
    { kind: "welcome", key: "welcome", body: plan.tutorGreeting },
    { kind: "goal", key: "goal", body: plan.objective },
    { kind: "story", key: "story", body: plan.storyHook },
    { kind: "micro", key: "micro", body: plan.microLesson },
    {
      kind: "example",
      key: "example",
      prompt: plan.example.prompt,
      explanation: plan.example.explanation,
    },
  ];
  // shorterSteps preference: drop the story-hook beat to slim the lesson.
  const trimmed = shorter ? beats.filter((b) => b.kind !== "story") : beats;
  plan.guidedPractice.forEach((g, i) =>
    trimmed.push({
      kind: "guided",
      key: `gp-${i}`,
      gpId: g.id,
      surfaceType:
        (g as { surfaceType?: SurfaceRouterItem["surfaceType"] }).surfaceType ??
        (g.choices?.length ? "choice_grid" : "math_expression"),
      prompt: g.prompt,
      expectedAnswer: g.expectedAnswer,
      choices: g.choices,
      hint: g.hint,
      scaffold: g.scaffold,
      skillId: g.skillId,
      media: g.media,
    }),
  );
  plan.checksForUnderstanding.forEach((c, i) =>
    trimmed.push({
      kind: "check",
      key: `chk-${i}`,
      checkId: c.id,
      surfaceType:
        (c as { surfaceType?: SurfaceRouterItem["surfaceType"] }).surfaceType ??
        (c.choices?.length ? "choice_grid" : "math_expression"),
      prompt: c.prompt,
      expectedAnswer: c.expectedAnswer,
      choices: c.choices,
      supportIfWrong: c.supportIfWrong,
      media: c.media,
    }),
  );
  trimmed.push({ kind: "celebrate", key: "celebrate", body: plan.encouragement });
  trimmed.push({ kind: "progress", key: "progress", body: plan.parentSummary });
  trimmed.push({ kind: "next", key: "next", body: plan.nextRecommendedStep });
  return trimmed;
}

function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isCorrect(expected: string | undefined, actual: string): boolean {
  if (!expected) return true; // open-ended response — accept any non-empty answer
  return normalizeAnswer(expected) === normalizeAnswer(actual);
}

/**
 * Wave E (S9): identity of the agent tutor watching this lesson. Present
 * ONLY when the tenant flag `tutorAgenticMode` is on AND the subject is
 * piloted (see lib/bff/agent-pilot.ts). When absent the player renders
 * and behaves byte-identically to the pre-agent build — the agent is
 * pure enrichment. Re-exported from agent-directives for callers.
 */
export type { LessonAgentConfig } from "@/lib/learner/agent-directives";

type Props = {
  learnerId: string;
  lessonRunId: string;
  plan: GeneratedLessonPlan;
  accessibility: AccessibilityPreferences;
  /**
   * Parent-curated sensory modalities (LearnerSensoryProfile.modalities),
   * loaded server-side by the route. Null when no profile is curated yet —
   * the stage then runs on neutral defaults.
   */
  sensoryModalities?: Record<string, string> | null;
  functioningLevel?: FunctioningLevel;
  initialStatus: LessonRunStatus;
  v2Enabled?: boolean;
  sessionId?: string;
  subjectSlug?: string | null;
  agent?: LessonAgentConfig | null;
};

type LessonMediaProps = {
  media: NonNullable<Extract<Beat, { kind: "guided" | "check" }>["media"]>;
  onTelemetry: (event: string) => void;
};

function toVttDataUri(vtt: string): string {
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`;
}

function LessonMedia({ media, onTelemetry }: LessonMediaProps) {
  const mediaAsset = media.assets.find((asset) => asset.kind === media.surfaceType);
  const captions = media.assets.find((asset) => asset.kind === "captions");
  if (!mediaAsset || !captions) return null;
  const source =
    captions.src.startsWith("WEBVTT") || captions.src.includes("\n")
      ? toVttDataUri(captions.src)
      : captions.src.endsWith(".vtt")
        ? captions.src
        : toVttDataUri(captions.src);

  const props = {
    controls: true,
    className: "w-full rounded-md border border-aivo-border",
    onPlay: () => onTelemetry("play"),
    onPause: () => onTelemetry("pause"),
    onSeeked: () => onTelemetry("seek"),
    onEnded: () => onTelemetry("complete"),
    onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
      const track = event.currentTarget.textTracks?.[0];
      if (track && track.mode !== "showing") {
        track.mode = "showing";
        onTelemetry("caption-on");
      }
    },
  };

  if (media.surfaceType === "video") {
    return (
      <video {...props} data-testid="lesson-media-video">
        <source src={mediaAsset.src} />
        <track
          kind="captions"
          srcLang={captions.language ?? "en"}
          label={captions.label ?? "English"}
          src={source}
          default
        />
      </video>
    );
  }

  return (
    <audio {...props} data-testid="lesson-media-audio">
      <source src={mediaAsset.src} />
      <track
        kind="captions"
        srcLang={captions.language ?? "en"}
        label={captions.label ?? "English"}
        src={source}
        default
      />
    </audio>
  );
}

/**
 * How often the "Break reminders" preference nudges the learner. Long, calm
 * cadence — this is a gentle prompt, not a nag. The break screen already
 * exists; the reminder just routes the learner into it on a timer.
 */
const BREAK_REMINDER_MS = 10 * 60_000;

export function LessonPlayer({
  learnerId,
  lessonRunId,
  plan,
  accessibility,
  sensoryModalities = null,
  functioningLevel = "STANDARD",
  initialStatus,
  agent,
}: Props) {
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
  function runAgentTurn(
    interactiveBeat: Extract<Beat, { kind: "guided" | "check" }>,
    candidate: string,
    correct: boolean,
  ) {
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

  function toSurfaceItem(
    sourceBeat: Extract<Beat, { kind: "guided" | "check" }>,
  ): SurfaceRouterItem {
    // Wave E (S9): an accepted agent `present_surface` re-presents the
    // CURRENT item on a different (allow-listed) surface; cleared on
    // advance. Without an override this is exactly the source beat.
    const currentBeat =
      agentSurfaceOverride && PRESENTABLE_SURFACES.has(agentSurfaceOverride)
        ? {
            ...sourceBeat,
            surfaceType: agentSurfaceOverride as SurfaceRouterItem["surfaceType"],
          }
        : sourceBeat;
    return {
      id: currentBeat.kind === "guided" ? currentBeat.gpId : currentBeat.checkId,
      surfaceType: currentBeat.surfaceType,
      prompt: currentBeat.prompt,
      choices: currentBeat.choices,
      expectedAnswer: currentBeat.expectedAnswer,
      instructions:
        currentBeat.kind === "guided" ? t("instructions_guided") : t("instructions_check"),
      answerInput: { type: "text", label: t("answer_label"), placeholder: t("answer_placeholder") },
      scratchpad:
        currentBeat.surfaceType === "scratchpad" || currentBeat.surfaceType === "ink_canvas"
          ? { enabled: true, width: 520, height: 300 }
          : undefined,
      diagram:
        currentBeat.surfaceType === "geometry_workspace" || currentBeat.surfaceType === "geometry"
          ? {
              canvasMode: "svg",
              width: 480,
              height: 320,
              shapes: [
                { id: "fixture-rect", kind: "rectangle", x: 110, y: 70, width: 220, height: 150 },
              ],
            }
          : undefined,
      numberLine:
        currentBeat.surfaceType === "number_line"
          ? {
              min: 0,
              max: 10,
              step: 1,
            }
          : undefined,
      codingSandbox:
        currentBeat.surfaceType === "coding_sandbox"
          ? { language: "javascript", starterCode: "// write your solution\n" }
          : undefined,
      artCanvas: currentBeat.surfaceType === "art_canvas" ? { showGuides: true } : undefined,
      voiceResponse:
        currentBeat.surfaceType === "voice_response" ? { language: "en-US" } : undefined,
      // Sprint 4–8 surfaces. Authored specs ride on the beat when the
      // curriculum/item-bank provides them; otherwise a coherent default
      // fixture keeps the activity playable (and serves as the authoring
      // template) instead of rendering blank.
      readingAnnotation:
        currentBeat.surfaceType === "reading_annotation"
          ? ((currentBeat as { readingAnnotation?: SurfaceRouterItem["readingAnnotation"] })
              .readingAnnotation ?? {
              question: currentBeat.prompt,
              tools: ["highlight"],
              passage: [
                { id: "s1", text: "The little fox was thirsty." },
                { id: "s2", text: "It ran all the way to the cool stream." },
                { id: "s3", text: "Then it took a long, happy drink." },
              ],
              expectedEvidenceIds: ["s2"],
            })
          : undefined,
      graph:
        currentBeat.surfaceType === "graph"
          ? ((currentBeat as { graph?: SurfaceRouterItem["graph"] }).graph ?? {
              xMin: 0,
              xMax: 10,
              yMin: 0,
              yMax: 10,
              step: 1,
              mode: "points",
            })
          : undefined,
      dragManipulative:
        currentBeat.surfaceType === "drag_manipulative"
          ? ((currentBeat as { dragManipulative?: SurfaceRouterItem["dragManipulative"] })
              .dragManipulative ?? {
              items: [
                { id: "i1", label: "3" },
                { id: "i2", label: "8" },
              ],
              targets: [
                { id: "odd", label: "Odd" },
                { id: "even", label: "Even" },
              ],
              correctPlacement: { i1: "odd", i2: "even" },
            })
          : undefined,
      multiStep:
        currentBeat.surfaceType === "multi_step_workspace"
          ? ((currentBeat as { multiStep?: SurfaceRouterItem["multiStep"] }).multiStep ?? {
              steps: [
                { id: "a", prompt: "Show your first step." },
                { id: "b", prompt: "Show your next step." },
                { id: "c", prompt: "Write your final answer." },
              ],
            })
          : undefined,
      scienceDiagram:
        currentBeat.surfaceType === "science_diagram"
          ? ((currentBeat as { scienceDiagram?: SurfaceRouterItem["scienceDiagram"] })
              .scienceDiagram ?? {
              width: 480,
              height: 320,
              diagram: {
                canvasMode: "svg",
                width: 480,
                height: 320,
                shapes: [{ id: "cell", kind: "circle", cx: 240, cy: 160, r: 110 }],
              },
              targets: [
                { id: "t1", x: 240, y: 160, correctLabelId: "nucleus" },
                { id: "t2", x: 240, y: 60, correctLabelId: "membrane" },
              ],
              labels: [
                { id: "nucleus", text: "Nucleus" },
                { id: "membrane", text: "Membrane" },
              ],
            })
          : undefined,
      musicSequencer:
        currentBeat.surfaceType === "music_sequencer"
          ? ((currentBeat as { musicSequencer?: SurfaceRouterItem["musicSequencer"] })
              .musicSequencer ?? {
              tracks: ["Clap", "Drum"],
              steps: 8,
              tempo: 90,
            })
          : undefined,
    };
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

  // ----- Accessibility-derived classes + DOM attributes -----
  // Dyslexia font is applied via `data-typeface="dyslexia"` (see below), which
  // resolves to the bundled Atkinson Hyperlegible / OpenDyslexic webfonts plus
  // the spec'd letter-spacing/line-height. The previous `font-mono` mapping was
  // wrong — monospace is not a dyslexia-friendly face.
  const rootClass = [
    accessibility.largeText ? "text-lg leading-relaxed" : "",
    accessibility.highContrast ? "bg-aivo-surface text-black" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ----- Sensory profile → stage adaptations (Sprint 03) -----
  // The per-learner profile sets the BASE vars; the global sensory mode
  // multiplies on top in CSS (var(--aivo-sensory-motionScale): standard 1,
  // calm 0.5, high-contrast 0) so the calmer of the two always wins and the
  // values stay hydration-safe (no client-only reads).
  const sensoryAdaptations = deriveSensoryAdaptations(
    toStageSensoryProfile(sensoryModalities),
    { functioningLevel },
  );
  const stageVars = sensoryCSSVars(sensoryAdaptations) as React.CSSProperties;
  const stageDensity =
    sensoryAdaptations.maxOnScreenElements <= 3
      ? "minimal"
      : sensoryAdaptations.maxOnScreenElements <= 4
        ? "reduced"
        : "standard";
  // Surfaces consume reducedMotion through their existing settings prop —
  // a vestibular/proprioceptive-hyper profile quiets them with no API change.
  const effectiveAccessibility =
    sensoryAdaptations.motionReduced && !accessibility.reducedMotion
      ? { ...accessibility, reducedMotion: true }
      : accessibility;
  const motionOff = accessibility.reducedMotion || sensoryAdaptations.motionReduced;
  const transitionClass = motionOff
    ? ""
    : "transition-all duration-[calc(var(--stage-transition-duration,300ms)*var(--aivo-sensory-motionScale,1))]";

  // Data attributes consumed by app/a11y-modes.css + app/fonts-dyslexia.css so
  // the remaining preferences actually render rather than just persisting.
  const a11yAttrs = {
    "data-typeface": accessibility.dyslexiaFriendlyFont ? "dyslexia" : undefined,
    "data-keyboard-optimized": accessibility.keyboardOptimized ? "on" : undefined,
    "data-visual-supports": accessibility.visualSupports ? "on" : undefined,
  } as const;

  if (onBreak) {
    return (
      <Card className={`p-8 text-center ${rootClass}`}>
        <PageHeader
          eyebrow={t("break_eyebrow")}
          title={t("break_title")}
          description={t("break_desc")}
        />
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => setOnBreak(false)}>{t("break_resume")}</Button>
          <Button variant="soft" onClick={() => complete(true)} disabled={completing}>
            {t("break_end")}
          </Button>
        </div>
      </Card>
    );
  }

  // Sprint 7 — wrap the entire lesson-player tree in the AAC target
  // provider when the learner has enabled AAC. Surfaces (ChoiceGrid,
  // submit buttons) auto-register via useAACTarget; AACScanRoot listens
  // for Space (activate) and ArrowRight (advance) so a single-switch
  // device mapped to those keys can drive the whole flow.
  const aacEnabled = accessibility.aacEnabled === true;
  const innerTree = (
    <div
      className={`${rootClass} [filter:saturate(var(--stage-saturation,100%))]`}
      style={stageVars}
      data-stage-density={stageDensity}
      {...a11yAttrs}
    >
      {plan.lessonMode === "holiday_prep" ? (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-iw-accent-soft px-3 py-1 text-xs font-medium text-iw-ink">
          {t("holiday_prep")}
        </span>
      ) : plan.lessonMode === "summer_bridge" ? (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-iw-accent-soft px-3 py-1 text-xs font-medium text-iw-ink">
          {t("summer_bridge")}
        </span>
      ) : null}
      <PageHeader
        eyebrow={plan.tutorPersona}
        title={plan.title}
        description={plan.objective}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{t("min", { n: plan.estimatedMinutes })}</Badge>
            <Button variant="ghost" onClick={() => setOnBreak(true)}>
              {t("take_break")}
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <AudioControlBar />
      </div>
      {agent ? (
        <InLessonTutorPanel
          tutor={{
            tutorKey: agent.tutorKey,
            name: agent.name,
            icon: agent.icon,
            color: agent.color,
          }}
          message={agentMsg}
          thinking={agentThinking}
          breakOffer={agentBreakOffer}
          onAcceptBreak={() => {
            setAgentBreakOffer(null);
            setOnBreak(true);
          }}
          onDeclineBreak={() => setAgentBreakOffer(null)}
          endEarly={agentEndEarly}
          onFinishEarly={() => complete(false)}
          reducedMotion={accessibility.reducedMotion}
        />
      ) : null}
      <div className="mb-4">
        <Progress
          value={((stepIdx + 1) / beats.length) * 100}
          aria-label={`Step ${stepIdx + 1} of ${beats.length}`}
        />
        <p className="mt-1 text-xs text-aivo-ink-soft" aria-live="polite">
          {t("step_of", { current: stepIdx + 1, total: beats.length })}
        </p>
      </div>

      <FocusMode title={beat.kind === "check" ? t("focus_check") : t("focus_lesson")}>
        <Card className={`p-6 ${transitionClass}`}>
          {/* Each beat sets aria-live so read-aloud announces it. */}
          <div aria-live="polite" className="space-y-4">
            {beat.kind === "welcome" ||
            beat.kind === "goal" ||
            beat.kind === "story" ||
            beat.kind === "micro" ||
            beat.kind === "celebrate" ||
            beat.kind === "progress" ||
            beat.kind === "next" ? (
              <p className="font-display text-2xl">
                <MathText>{beat.body}</MathText>
              </p>
            ) : null}

            {beat.kind === "example" && (
              <>
                <p className="font-display text-2xl">
                  <MathText>{beat.prompt}</MathText>
                </p>
                <p className="text-aivo-ink-soft">
                  <MathText>{beat.explanation}</MathText>
                </p>
              </>
            )}

            {beat.kind === "guided" && (
              <>
                <p className="font-display text-2xl">
                  <MathText>{beat.prompt}</MathText>
                </p>
                {beat.media ? (
                  <LessonMedia
                    media={beat.media}
                    onTelemetry={(event) => emitMediaTelemetry(beat.media!.surfaceType, event)}
                  />
                ) : null}
                <SurfaceRouter
                  item={toSurfaceItem(beat)}
                  accessibilitySettings={effectiveAccessibility}
                  onSubmitAndAdvance={submitSurface}
                  onEvent={emitSurfaceTelemetry}
                />
                {showHint && (
                  <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    {t("hint_prefix")} <MathText>{beat.hint}</MathText>
                  </p>
                )}
                {feedback === "correct" && (
                  <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                    {t("nice_work")}
                  </p>
                )}
                {feedback === "incorrect" && (
                  <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
                    {t("not_quite")} <MathText>{beat.scaffold}</MathText>
                  </p>
                )}
                {agentScaffold && (
                  <p
                    data-testid="agent-scaffold"
                    className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    {t("agent_scaffold_prefix")} <MathText>{agentScaffold}</MathText>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="soft" onClick={requestHint} disabled={showHint}>
                    {t("hint_btn")}
                  </Button>
                  <Button variant="ghost" onClick={useScaffold}>
                    {t("show_me_how")}
                  </Button>
                </div>
              </>
            )}

            {beat.kind === "check" && (
              <>
                <p className="font-display text-2xl">
                  <MathText>{beat.prompt}</MathText>
                </p>
                {beat.media ? (
                  <LessonMedia
                    media={beat.media}
                    onTelemetry={(event) => emitMediaTelemetry(beat.media!.surfaceType, event)}
                  />
                ) : null}
                <SurfaceRouter
                  item={toSurfaceItem(beat)}
                  accessibilitySettings={effectiveAccessibility}
                  onSubmitAndAdvance={submitSurface}
                  onEvent={emitSurfaceTelemetry}
                />
                {feedback === "correct" && (
                  <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                    {t("check_correct")}
                  </p>
                )}
                {feedback === "incorrect" && (
                  <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
                    {t("check_close")} <MathText>{beat.supportIfWrong}</MathText>
                  </p>
                )}
                {agentScaffold && (
                  <p
                    data-testid="agent-scaffold"
                    className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    {t("agent_scaffold_prefix")} <MathText>{agentScaffold}</MathText>
                  </p>
                )}
              </>
            )}
          </div>

          <div className="mt-6 flex justify-between gap-2">
            <Button
              variant="soft"
              onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
              disabled={stepIdx === 0}
            >
              {t("back")}
            </Button>
            {!isLastBeat ? (
              <Button onClick={advance} disabled={isInteractive && feedback === null}>
                {t("next")}
              </Button>
            ) : (
              <Button onClick={() => complete(false)} disabled={completing}>
                {completing ? t("saving") : t("done")}
              </Button>
            )}
          </div>
          {completeError ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {completeError}
            </p>
          ) : null}
        </Card>
      </FocusMode>
    </div>
  );

  if (!aacEnabled) return innerTree;
  return (
    <AACTargetProvider
      enabled
      inputMethod={accessibility.aacInputMethod}
      scanDelayMs={accessibility.aacScanDelayMs}
      onEvent={(evt) => {
        // Mirror AAC activations into the existing surface-telemetry
        // sink so analytics can correlate them with lesson outcomes.
        emitSurfaceTelemetry({
          id: globalThis.crypto?.randomUUID?.() ?? `aac-${evt.targetId}-${Date.now()}`,
          surfaceId: "aac",
          type: "answer_changed",
          occurredAt: new Date().toISOString(),
          payload: { source: "aac", targetId: evt.targetId, method: evt.method },
        } satisfies SurfaceTelemetryEvent);
      }}
    >
      <AACScanRoot>{innerTree}</AACScanRoot>
    </AACTargetProvider>
  );
}
