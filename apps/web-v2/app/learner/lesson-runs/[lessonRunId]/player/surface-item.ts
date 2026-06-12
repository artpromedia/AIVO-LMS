/**
 * Sprint 12 — interactive beat → SurfaceRouterItem mapping.
 *
 * Pure function extracted from the original lesson-player.tsx (the former
 * closure over `t` and the agent surface override is parameterized here).
 * Authored specs ride on the beat when the curriculum/item-bank provides
 * them; otherwise a coherent default fixture keeps the activity playable
 * (and serves as the authoring template) instead of rendering blank.
 */
import type { SurfaceRouterItem } from "@aivo/learner-surfaces";
import { PRESENTABLE_SURFACES } from "@/lib/learner/agent-directives";
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
