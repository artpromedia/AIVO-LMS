import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SurfaceRouter } from "../SurfaceRouter.js";
import {
  ITEM_TYPE_TO_RUNTIME,
  SUPPORTED_RUNTIME_TYPES,
  toRuntimeSurfaceType,
  type ItemAuthoredSurfaceType,
  type RouterSurfaceType,
} from "../surface-type-map.js";
import type { SurfaceRouterItem } from "../SurfaceRouter.js";

/**
 * The router must accept every authored item-bank surface type AND the
 * runtime types the lesson player emits, and must produce a non-empty
 * markup string for each. Anything that throws or renders empty breaks
 * lesson delivery, so the table here is the contract.
 */

interface Case {
  surfaceType: RouterSurfaceType;
  expectedMarker: string;
  extra?: Partial<SurfaceRouterItem>;
}

const CASES: Case[] = [
  // Authored item-bank surface types (Sprint 1 expansion).
  {
    surfaceType: "multiple_choice",
    expectedMarker: "choice-grid-surface",
    extra: { choices: ["A", "B"] },
  },
  { surfaceType: "short_response", expectedMarker: "math-expression-surface" },
  { surfaceType: "fill_in_blank", expectedMarker: "math-expression-surface" },
  {
    surfaceType: "drag_drop",
    expectedMarker: "choice-grid-surface",
    extra: { choices: ["A", "B"] },
  },
  {
    surfaceType: "geometry",
    expectedMarker: "geometry-surface",
    extra: {
      diagram: {
        canvasMode: "svg",
        shapes: [{ id: "r", kind: "rectangle", x: 10, y: 10, width: 40, height: 40 }],
      },
    },
  },
  { surfaceType: "math_expression", expectedMarker: "math-expression-surface" },
  {
    surfaceType: "coding_sandbox",
    expectedMarker: "coding-sandbox-surface",
    extra: {
      codingSandbox: { language: "javascript", starterCode: "// solve\n" },
    },
  },
  {
    surfaceType: "art_canvas",
    expectedMarker: "art-canvas-surface",
    extra: {
      artCanvas: { showGuides: true },
    },
  },
  {
    surfaceType: "voice_response",
    expectedMarker: "voice-response-surface",
    extra: {
      voiceResponse: { language: "en-US" },
    },
  },
  {
    surfaceType: "ink_canvas",
    expectedMarker: "scratchpad-surface",
    extra: {
      scratchpad: { enabled: true },
    },
  },
  {
    surfaceType: "scratchpad",
    expectedMarker: "scratchpad-surface",
    extra: {
      scratchpad: { enabled: true },
    },
  },
  // Runtime-internal aliases the lesson player emits.
  {
    surfaceType: "choice_grid",
    expectedMarker: "choice-grid-surface",
    extra: { choices: ["A", "B"] },
  },
  {
    surfaceType: "geometry_workspace",
    expectedMarker: "geometry-surface",
    extra: {
      diagram: {
        canvasMode: "svg",
        shapes: [{ id: "r", kind: "rectangle", x: 10, y: 10, width: 40, height: 40 }],
      },
    },
  },
  {
    surfaceType: "number_line",
    expectedMarker: "number-line-surface",
    extra: {
      numberLine: { min: 0, max: 5, step: 1 },
    },
  },
  // Sprint 4–8 surfaces emitted directly by the lesson player.
  {
    surfaceType: "reading_annotation",
    expectedMarker: "reading-annotation-surface",
    extra: {
      readingAnnotation: {
        passage: [{ id: "s1", text: "A sentence." }],
        expectedEvidenceIds: ["s1"],
      },
    },
  },
  {
    surfaceType: "graph",
    expectedMarker: "graph-surface",
    extra: {
      graph: { xMin: 0, xMax: 5, yMin: 0, yMax: 5, step: 1 },
    },
  },
  {
    surfaceType: "drag_manipulative",
    expectedMarker: "drag-manipulative-surface",
    extra: {
      dragManipulative: {
        items: [{ id: "i1", label: "1" }],
        targets: [{ id: "t1", label: "Box" }],
      },
    },
  },
  {
    surfaceType: "multi_step_workspace",
    expectedMarker: "multi-step-workspace-surface",
    extra: {
      multiStep: { steps: [{ id: "a", prompt: "Step 1" }] },
    },
  },
  {
    surfaceType: "science_diagram",
    expectedMarker: "science-diagram-surface",
    extra: {
      scienceDiagram: {
        width: 100,
        height: 100,
        targets: [{ id: "t1", x: 10, y: 10, correctLabelId: "l1" }],
        labels: [{ id: "l1", text: "Part" }],
      },
    },
  },
  {
    surfaceType: "music_sequencer",
    expectedMarker: "music-sequencer-surface",
    extra: {
      musicSequencer: { tracks: ["Clap"], steps: 8 },
    },
  },
];

describe("SurfaceRouter routing coverage", () => {
  it.each(CASES)(
    "renders the $surfaceType surface ($expectedMarker)",
    ({ surfaceType, expectedMarker, extra }) => {
      const item: SurfaceRouterItem = {
        id: `case-${surfaceType}`,
        surfaceType,
        prompt: `Prompt for ${surfaceType}`,
        ...extra,
      };
      const markup = renderToStaticMarkup(
        <SurfaceRouter item={item} onSubmitAndAdvance={() => {}} />,
      );
      expect(markup, `surface ${surfaceType} produced empty markup`).not.toEqual("");
      expect(markup).toContain(expectedMarker);
    },
  );

  it("covers every authored item-bank surface type from the schema", () => {
    const authoredTypes: ItemAuthoredSurfaceType[] = [
      "multiple_choice",
      "short_response",
      "fill_in_blank",
      "drag_drop",
      "geometry",
      "math_expression",
      "coding_sandbox",
      "art_canvas",
      "voice_response",
      "ink_canvas",
      "scratchpad",
    ];
    for (const t of authoredTypes) {
      expect(ITEM_TYPE_TO_RUNTIME[t], `missing map entry for ${t}`).toBeTruthy();
      expect(SUPPORTED_RUNTIME_TYPES.has(toRuntimeSurfaceType(t))).toBe(true);
    }
  });

  it("emits a surface_started telemetry event on first render", () => {
    const events: string[] = [];
    renderToStaticMarkup(
      <SurfaceRouter
        item={{ id: "ev-1", surfaceType: "math_expression", prompt: "2+2" }}
        onEvent={(e) => events.push(e.type)}
        onSubmitAndAdvance={() => {}}
      />,
    );
    expect(events).toContain("surface_started");
  });
});
