/**
 * Sprint 12 — interactive beat → SurfaceRouterItem mapping.
 *
 * Pure function extracted from the original lesson-player.tsx (the former
 * closure over `t` and the agent surface override is parameterized here).
 * Remediation Sprints 02-04: every surface spec comes from the plan's
 * VALIDATED `surface` envelope riding on the beat — the hardcoded fixture
 * defaults are gone. Surfaces without an authored spec don't mount.
 */
import type { SurfaceRouterItem } from "@aivo/learner-surfaces";
import { PRESENTABLE_SURFACES } from "@/lib/learner/agent-directives";
import { deriveNumberLineSpec } from "@/lib/learner/surface-selection";
import type { InteractiveBeat } from "./beats";

export interface SurfaceItemLabels {
  instructionsGuided: string;
  instructionsCheck: string;
  answerLabel: string;
  answerPlaceholder: string;
}

export function toSurfaceItem(
  sourceBeat: InteractiveBeat,
  agentSurfaceOverride: string | null,
  labels: SurfaceItemLabels,
): SurfaceRouterItem {
  // Wave E (S9): an accepted agent `present_surface` re-presents the
  // CURRENT item on a different (allow-listed) surface; cleared on
  // advance. Without an override this is exactly the source beat.
  // Remediation Sprint 02: a number_line override additionally requires a
  // range derivable from the item's own answer space — there is no
  // hardcoded 0-10 fixture to fall back on, and a line that cannot carry
  // the expected answer would be unanswerable. Underivable overrides keep
  // the source surface.
  const overrideNumberLine =
    agentSurfaceOverride === "number_line"
      ? (sourceBeat.numberLine ??
        deriveNumberLineSpec({
          prompt: sourceBeat.prompt,
          expectedAnswer: sourceBeat.expectedAnswer,
          choices: sourceBeat.choices,
        }) ??
        undefined)
      : undefined;
  const overrideApplies =
    agentSurfaceOverride !== null &&
    PRESENTABLE_SURFACES.has(agentSurfaceOverride) &&
    (agentSurfaceOverride !== "number_line" || overrideNumberLine !== undefined) &&
    // Sprint 04: drag has no fixture default either — the override only
    // applies when the item itself authored a drag spec.
    (agentSurfaceOverride !== "drag_manipulative" ||
      sourceBeat.dragManipulative !== undefined);
  const currentBeat = overrideApplies
    ? {
        ...sourceBeat,
        surfaceType: agentSurfaceOverride as SurfaceRouterItem["surfaceType"],
        numberLine: overrideNumberLine ?? sourceBeat.numberLine,
      }
    : sourceBeat;
  return {
    id: currentBeat.kind === "guided" ? currentBeat.gpId : currentBeat.checkId,
    surfaceType: currentBeat.surfaceType,
    prompt: currentBeat.prompt,
    choices: currentBeat.choices,
    expectedAnswer: currentBeat.expectedAnswer,
    instructions:
      currentBeat.kind === "guided" ? labels.instructionsGuided : labels.instructionsCheck,
    answerInput: {
      type: "text",
      label: labels.answerLabel,
      placeholder: labels.answerPlaceholder,
    },
    scratchpad:
      currentBeat.surfaceType === "scratchpad" || currentBeat.surfaceType === "ink_canvas"
        ? { enabled: true, width: 520, height: 300 }
        : undefined,
    // Remediation Sprint 04: every remaining surface spec comes from the
    // validated `surface` envelope — the geometry rectangle, "// write your
    // solution" sandbox, en-US voice, odd/even drag bins, and 3-step
    // multi-step fixture defaults are gone.
    diagram:
      currentBeat.surfaceType === "geometry_workspace" || currentBeat.surfaceType === "geometry"
        ? currentBeat.geometryDiagram
        : undefined,
    // Remediation Sprint 02: the range is the plan's validated,
    // content-derived spec (or freshly derived for an agent override) —
    // never a hardcoded fixture.
    numberLine: currentBeat.surfaceType === "number_line" ? currentBeat.numberLine : undefined,
    codingSandbox:
      currentBeat.surfaceType === "coding_sandbox" ? currentBeat.codingSandbox : undefined,
    artCanvas: currentBeat.surfaceType === "art_canvas" ? currentBeat.artCanvas : undefined,
    voiceResponse:
      currentBeat.surfaceType === "voice_response" ? currentBeat.voiceResponse : undefined,
    // Remediation Sprint 03: reading/graph/science specs are the plan's
    // validated, content-derived payloads (LessonSurfaceSchema guarantees
    // a spec rides with its surfaceType). The fox/stream and 0-10-grid
    // fixture defaults are gone — these surfaces only mount with real
    // authored content.
    readingAnnotation:
      currentBeat.surfaceType === "reading_annotation"
        ? currentBeat.readingAnnotation
        : undefined,
    graph: currentBeat.surfaceType === "graph" ? currentBeat.graph : undefined,
    dragManipulative:
      currentBeat.surfaceType === "drag_manipulative" ? currentBeat.dragManipulative : undefined,
    multiStep:
      currentBeat.surfaceType === "multi_step_workspace" ? currentBeat.multiStep : undefined,
    scienceDiagram:
      currentBeat.surfaceType === "science_diagram" ? currentBeat.scienceDiagram : undefined,
    musicSequencer:
      currentBeat.surfaceType === "music_sequencer" ? currentBeat.musicSequencer : undefined,
  };
}
