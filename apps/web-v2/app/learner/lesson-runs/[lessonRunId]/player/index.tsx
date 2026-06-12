"use client";

/**
 * Sprint 12 — composition root for the decomposed lesson player.
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
 *
 * State lives in use-beat-machine.ts; presentation derivation + the AAC
 * mount in accessibility-shell.tsx; per-section markup under beats/. The
 * exported component name and props are identical to the pre-decomposition
 * lesson-player.tsx.
 */
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/page-header";
import { AudioControlBar, FocusMode } from "@/components/playful-calm";
import { InLessonTutorPanel } from "@/components/learner/in-lesson-tutor-panel";
import type { FunctioningLevel } from "@aivo/stage-ui";
import type { TutorKey } from "@aivo/brand";
import type { LessonAgentConfig } from "@/lib/learner/agent-directives";
import type {
  AccessibilityPreferences,
  GeneratedLessonPlan,
  LessonRunStatus,
} from "@/lib/db/types";
import { useBeatMachine } from "./use-beat-machine";
import {
  AccessibilityShell,
  deriveStagePresentation,
} from "./accessibility-shell";
import { BreakScreen } from "./break-screen";
import { StaticBeat } from "./beats/static-beat";
import { WelcomeBeat } from "./beats/welcome-beat";
import { CelebrateBeat } from "./beats/celebrate-beat";
import { ExampleBeat } from "./beats/example-beat";
import { GuidedBeat } from "./beats/guided-beat";
import { CheckBeat } from "./beats/check-beat";

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
  /** Sprint 15 — owning tutor for the lesson's identity treatment
   *  (accent vars, portrait, signature lines). Resolved server-side from
   *  the plan's subject; null renders the neutral pre-15 chrome. */
  tutorSlug?: TutorKey | null;
};

export function LessonPlayer({
  learnerId,
  lessonRunId,
  plan,
  accessibility,
  sensoryModalities = null,
  functioningLevel = "STANDARD",
  initialStatus,
  agent,
  tutorSlug = null,
}: Props) {
  const t = useTranslations("learner.lesson_player");
  const machine = useBeatMachine({
    learnerId,
    lessonRunId,
    plan,
    accessibility,
    initialStatus,
    agent,
  });
  const presentation = deriveStagePresentation(
    accessibility,
    sensoryModalities,
    functioningLevel,
    tutorSlug,
  );
  const { beat, stepIdx, beats, isLastBeat, isInteractive } = machine;

  if (machine.onBreak) {
    return (
      <BreakScreen
        rootClass={presentation.rootClass}
        completing={machine.completing}
        onResume={machine.endBreak}
        onEndLesson={() => machine.complete(true)}
      />
    );
  }

  return (
    <AccessibilityShell
      accessibility={accessibility}
      presentation={presentation}
      tutorSlug={tutorSlug}
      onSurfaceTelemetry={machine.emitSurfaceTelemetry}
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
            <Button variant="ghost" onClick={machine.startBreak}>
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
          message={machine.agentMsg}
          thinking={machine.agentThinking}
          breakOffer={machine.agentBreakOffer}
          onAcceptBreak={machine.acceptAgentBreak}
          onDeclineBreak={machine.declineAgentBreak}
          endEarly={machine.agentEndEarly}
          onFinishEarly={() => machine.complete(false)}
          reducedMotion={accessibility.reducedMotion}
        />
      ) : null}
      <div className="mb-4">
        <Progress
          value={((stepIdx + 1) / beats.length) * 100}
          aria-label={`Step ${stepIdx + 1} of ${beats.length}`}
          indicatorClassName={
            presentation.tutorThemed ? "bg-[color:var(--tutor-accent)]" : undefined
          }
        />
        <p className="mt-1 text-xs text-aivo-ink-soft" aria-live="polite">
          {t("step_of", { current: stepIdx + 1, total: beats.length })}
        </p>
      </div>

      <FocusMode title={beat.kind === "check" ? t("focus_check") : t("focus_lesson")}>
        <Card className={`p-6 ${presentation.transitionClass}`}>
          {/* Each beat sets aria-live so read-aloud announces it. */}
          <div aria-live="polite" className="space-y-4">
            {beat.kind === "welcome" ? (
              <WelcomeBeat
                body={beat.body}
                tutorSlug={tutorSlug}
                motionOff={presentation.motionOff}
              />
            ) : null}

            {beat.kind === "celebrate" ? (
              <CelebrateBeat
                body={beat.body}
                tutorSlug={tutorSlug}
                motionOff={presentation.motionOff}
              />
            ) : null}

            {beat.kind === "goal" ||
            beat.kind === "story" ||
            beat.kind === "micro" ||
            beat.kind === "progress" ||
            beat.kind === "next" ? (
              <StaticBeat body={beat.body} />
            ) : null}

            {beat.kind === "example" && <ExampleBeat beat={beat} />}

            {beat.kind === "guided" && (
              <GuidedBeat
                beat={beat}
                surfaceItem={machine.toSurfaceItem(beat)}
                accessibilitySettings={presentation.effectiveAccessibility}
                feedback={machine.feedback}
                showHint={machine.showHint}
                agentScaffold={machine.agentScaffold}
                onSubmit={machine.submitSurface}
                onSurfaceEvent={machine.emitSurfaceTelemetry}
                onMediaTelemetry={machine.emitMediaTelemetry}
                onRequestHint={machine.requestHint}
                onUseScaffold={machine.useScaffold}
              />
            )}

            {beat.kind === "check" && (
              <CheckBeat
                beat={beat}
                surfaceItem={machine.toSurfaceItem(beat)}
                accessibilitySettings={presentation.effectiveAccessibility}
                feedback={machine.feedback}
                agentScaffold={machine.agentScaffold}
                onSubmit={machine.submitSurface}
                onSurfaceEvent={machine.emitSurfaceTelemetry}
                onMediaTelemetry={machine.emitMediaTelemetry}
              />
            )}
          </div>

          <div className="mt-6 flex justify-between gap-2">
            <Button variant="soft" onClick={machine.back} disabled={stepIdx === 0}>
              {t("back")}
            </Button>
            {!isLastBeat ? (
              <Button
                onClick={machine.advance}
                disabled={isInteractive && machine.feedback === null}
              >
                {t("next")}
              </Button>
            ) : (
              <Button onClick={() => machine.complete(false)} disabled={machine.completing}>
                {machine.completing ? t("saving") : t("done")}
              </Button>
            )}
          </div>
          {machine.completeError ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {machine.completeError}
            </p>
          ) : null}
        </Card>
      </FocusMode>
    </AccessibilityShell>
  );
}
