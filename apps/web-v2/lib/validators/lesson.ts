/**
 * Sprint 10 + 11: Zod schemas for LessonRun inputs and the GeneratedLessonPlan
 * AI output. Every plan goes through `GeneratedLessonPlanSchema.parse` before
 * persistence — invalid plans never reach the store.
 */
import { z } from "zod";

export const LessonRunSourceSchema = z.enum([
  "today_mission",
  "quest",
  "homework",
  "baseline_followup",
  "parent_assigned",
  "teacher_assigned",
  "review",
  "subject_path",
]);

export const LessonRunCreateInput = z
  .object({
    skillId: z.string().min(1),
    subjectId: z.string().min(1),
    source: LessonRunSourceSchema,
    sourceRefId: z.string().min(1).nullable().optional(),
  })
  .strict();
export type LessonRunCreateInput = z.infer<typeof LessonRunCreateInput>;

export const LessonStepKindSchema = z.enum([
  "intro",
  "story_hook",
  "micro_lesson",
  "example",
  "guided_practice",
  "check",
  "check_for_understanding",
  "encouragement",
  "celebrate",
  "progress_update",
  "next_step",
  "answer_submitted",
  "hint_used",
  "scaffold_used",
]);

export const LessonStepInput = z
  .object({
    stepKind: LessonStepKindSchema,
    stepRefId: z.string().min(1).nullable().optional(),
    response: z.string().max(2000).nullable().optional(),
    isCorrect: z.boolean().nullable().optional(),
    skipped: z.boolean().optional(),
  })
  .strict();
export type LessonStepInput = z.infer<typeof LessonStepInput>;

const LessonMediaAssetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["video", "audio", "captions"]),
  src: z.string().min(1),
  alt: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  default: z.boolean().optional(),
});

const LessonMediaPayloadSchema = z
  .object({
    surfaceType: z.enum(["video", "audio"]),
    assets: z.array(LessonMediaAssetSchema).min(2),
  })
  .superRefine((media, ctx) => {
    const hasSurfaceAsset = media.assets.some((asset) => asset.kind === media.surfaceType);
    if (!hasSurfaceAsset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `assets[] must include a ${media.surfaceType} asset`,
      });
    }
    const captions = media.assets.find((asset) => asset.kind === "captions");
    if (!captions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assets[] must include captions",
      });
      return;
    }
    // Mirror the lesson player's contract exactly (see LessonMedia in
    // lesson-player.tsx): captions may be a .vtt URL, a data: URI, or an
    // INLINE WEBVTT payload (the deterministic generator embeds the cue
    // text directly so no asset host is required). A validator stricter
    // than the renderer turned every mock-provider multimedia lesson into
    // `generation_failed` (Wave F journey finding).
    const src = captions.src;
    const isInlineVtt = src.startsWith("WEBVTT") || src.includes("\n");
    const isVttRef = src.endsWith(".vtt") || src.startsWith("data:text/vtt");
    if (!isInlineVtt && !isVttRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "captions src must be a .vtt URL, data:text/vtt URI, or inline WEBVTT text",
      });
    }
  });

/**
 * Remediation Sprint 02 — the validated domain-surface envelope on practice
 * items. `surfaceType` selects which interactive surface the lesson player
 * mounts (the full set `@aivo/learner-surfaces` SurfaceRouter understands,
 * including the authored aliases its surface-type-map normalises). Per-type
 * payloads are validated sub-specs: `number_line` REQUIRES a content-derived
 * `numberLine` range (the player no longer ships a hardcoded 0-10 fixture).
 * Later remediation sprints (03/04) add the remaining sub-specs; until a
 * type's sub-spec lands here, emitting that bare type is for the dev fixture
 * page only — the production generators emit a surface only when they can
 * derive its spec from content.
 */
export const LESSON_SURFACE_TYPES = [
  "choice_grid",
  "math_expression",
  "scratchpad",
  "geometry_workspace",
  "geometry",
  "number_line",
  "graph",
  "drag_manipulative",
  "reading_annotation",
  "science_diagram",
  "voice_response",
  "multi_step_workspace",
  "coding_sandbox",
  "art_canvas",
  "music_sequencer",
  "ink_canvas",
  "multiple_choice",
  "short_response",
  "fill_in_blank",
  "drag_drop",
] as const;

export const NumberLineSpecSchema = z
  .object({
    min: z.number().int().min(-100),
    max: z.number().int().max(100),
    step: z.number().int().positive(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (spec.max <= spec.min) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "max must be greater than min" });
      return;
    }
    // Mirror NumberLineSurface's render cap (50 ticks) so a validated spec
    // can never produce a truncated, unanswerable line.
    if ((spec.max - spec.min) / spec.step + 1 > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "number line would exceed 50 ticks — widen step or narrow the range",
      });
    }
  });

/** Remediation Sprint 03 — reading-annotation passage spec (sage). The
 *  learner answers by selecting evidence spans; the surface submits the
 *  selected span IDs joined with "," (see ReadingAnnotationSurface), so the
 *  item's expectedAnswer must be the evidence span id(s). */
export const ReadingAnnotationSpecSchema = z
  .object({
    passage: z
      .array(
        z
          .object({
            id: z.string().min(1).max(24),
            text: z.string().min(1).max(300),
            selectable: z.boolean().optional(),
            breakAfter: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(12),
    tools: z.array(z.enum(["highlight", "underline"])).min(1).max(2).optional(),
    expectedEvidenceIds: z.array(z.string().min(1)).min(1).max(3).optional(),
    question: z.string().min(1).max(400).optional(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const ids = new Set(spec.passage.map((s) => s.id));
    if (ids.size !== spec.passage.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "passage span ids must be unique" });
    }
    for (const evidence of spec.expectedEvidenceIds ?? []) {
      if (!ids.has(evidence)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `expectedEvidenceIds entry "${evidence}" is not a passage span id`,
        });
      }
    }
  });

/** Remediation Sprint 03 — coordinate-grid spec (spark/nova quantitative).
 *  GraphSurface submits JSON.stringify(points), so a scored item's
 *  expectedAnswer must be that exact serialization. */
export const GraphSpecSchema = z
  .object({
    xMin: z.number().int().min(-20),
    xMax: z.number().int().max(20),
    yMin: z.number().int().min(-20),
    yMax: z.number().int().max(20),
    step: z.number().int().positive().optional(),
    mode: z.enum(["points", "line"]).optional(),
    expectedPoints: z
      .array(z.object({ x: z.number().int(), y: z.number().int() }).strict())
      .min(1)
      .max(3)
      .optional(),
    tolerance: z.number().int().min(0).max(2).optional(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (spec.xMax <= spec.xMin || spec.yMax <= spec.yMin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "graph bounds must be non-empty" });
      return;
    }
    for (const p of spec.expectedPoints ?? []) {
      if (p.x < spec.xMin || p.x > spec.xMax || p.y < spec.yMin || p.y > spec.yMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `expected point (${p.x},${p.y}) is outside the grid bounds`,
        });
      }
    }
  });

/** Deterministic diagram primitives a science-diagram may draw. Mirrors the
 *  GeometryShape union in @aivo/learner-surfaces for the shapes our
 *  generators emit. */
export const GeometryShapeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("circle"),
      cx: z.number(),
      cy: z.number(),
      r: z.number().positive(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("rectangle"),
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("segment"),
      start: z.object({ x: z.number(), y: z.number() }).strict(),
      end: z.object({ x: z.number(), y: z.number() }).strict(),
    })
    .strict(),
]);

export const GeometryDiagramSpecSchema = z
  .object({
    canvasMode: z.enum(["svg", "canvas", "hybrid"]),
    width: z.number().int().positive().max(1200).optional(),
    height: z.number().int().positive().max(1200).optional(),
    shapes: z.array(GeometryShapeSchema).min(1).max(12),
  })
  .strict();

/** Remediation Sprint 03 — science diagram labelling spec (spark / atlas).
 *  ScienceDiagramSurface submits JSON.stringify(placement) where placement =
 *  { targetId: labelId }; a scored item's expectedAnswer is that exact
 *  serialization (single-target items keep it order-stable). */
export const ScienceDiagramSpecSchema = z
  .object({
    width: z.number().int().positive().max(1200).optional(),
    height: z.number().int().positive().max(1200).optional(),
    diagram: GeometryDiagramSpecSchema.optional(),
    targets: z
      .array(
        z
          .object({
            id: z.string().min(1),
            x: z.number(),
            y: z.number(),
            correctLabelId: z.string().min(1).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    labels: z
      .array(z.object({ id: z.string().min(1), text: z.string().min(1).max(80) }).strict())
      .min(2)
      .max(6),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const labelIds = new Set(spec.labels.map((l) => l.id));
    for (const target of spec.targets) {
      if (target.correctLabelId && !labelIds.has(target.correctLabelId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `target "${target.id}" expects unknown label "${target.correctLabelId}"`,
        });
      }
    }
  });

/** Remediation Sprint 04 — coding sandbox spec (pixel). The in-surface test
 *  runner gives real pass/fail feedback; lesson scoring treats the item as
 *  open-ended (the surface submits the code text, not a verdict). */
export const CodingSandboxSpecSchema = z
  .object({
    language: z.enum(["javascript", "typescript", "python"]),
    starterCode: z.string().min(1).max(2000).optional(),
    prelude: z.string().min(1).max(2000).optional(),
    hint: z.string().min(1).max(400).optional(),
    correctness: z
      .object({
        type: z.literal("coding"),
        language: z.enum(["javascript", "typescript", "python"]),
        starterCode: z.string().max(2000),
        tests: z
          .array(
            z
              .object({
                name: z.string().min(1).max(120),
                hidden: z.boolean().optional(),
                kind: z.enum(["stdout", "returns"]),
                input: z.string().max(400).optional(),
                expected: z.string().max(400),
              })
              .strict(),
          )
          .min(1)
          .max(6),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Remediation Sprint 04 — art canvas (muse). Open-ended by design. */
export const ArtCanvasSpecSchema = z
  .object({
    width: z.number().int().positive().max(1200).optional(),
    height: z.number().int().positive().max(1200).optional(),
    palette: z.array(z.string().min(1).max(32)).min(2).max(12).optional(),
    highContrastPalette: z.array(z.string().min(1).max(32)).min(2).max(12).optional(),
    showGuides: z.boolean().optional(),
  })
  .strict();

/** Remediation Sprint 04 — rhythm sequencer (cadence). The surface submits
 *  JSON.stringify(pattern) with pattern[trackIndex] = SORTED active steps,
 *  so a scored item's expectedAnswer is that exact serialization. */
export const MusicSequencerSpecSchema = z
  .object({
    tracks: z.array(z.string().min(1).max(40)).min(1).max(4),
    steps: z.number().int().min(2).max(16).optional(),
    tempo: z.number().int().min(40).max(200).optional(),
    expectedPattern: z.array(z.array(z.number().int().min(0))).optional(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (!spec.expectedPattern) return;
    if (spec.expectedPattern.length !== spec.tracks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expectedPattern must have one row per track",
      });
      return;
    }
    const steps = spec.steps ?? 8;
    for (const row of spec.expectedPattern) {
      if (row.some((s) => s >= steps)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "expectedPattern step index outside the grid",
        });
      }
    }
  });

/** Remediation Sprint 04 — voice response (echo / lingua). Open-scored in
 *  lessons (speech evaluation happens in-surface / via speech services). */
export const VoiceResponseSpecSchema = z
  .object({
    language: z.string().min(2).max(20),
    targetText: z.string().min(1).max(200).optional(),
    maxDurationSeconds: z.number().int().min(3).max(120).optional(),
  })
  .strict();

/** Remediation Sprint 04 — drag-and-place sorting (harmony / vigor / nova
 *  manipulatives). The surface submits JSON.stringify({ itemId: targetId });
 *  single-token items keep that serialization order-stable for scoring. */
export const DragManipulativeSpecSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1).max(60),
            emoji: z.string().max(8).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    targets: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1).max(60),
            capacity: z.number().int().positive().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(4),
    correctPlacement: z.record(z.string(), z.string()).optional(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (!spec.correctPlacement) return;
    const itemIds = new Set(spec.items.map((i) => i.id));
    const targetIds = new Set(spec.targets.map((t) => t.id));
    for (const [itemId, targetId] of Object.entries(spec.correctPlacement)) {
      if (!itemIds.has(itemId) || !targetIds.has(targetId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctPlacement entry ${itemId}→${targetId} references unknown ids`,
        });
      }
    }
  });

/** Remediation Sprint 04 — multi-step workspace (compass / forge). Open-
 *  scored process surface: each step is captured for telemetry. */
export const MultiStepSpecSchema = z
  .object({
    steps: z
      .array(
        z
          .object({
            id: z.string().min(1),
            prompt: z.string().min(1).max(300),
            expectedAnswer: z.string().min(1).max(200).optional(),
            hint: z.string().min(1).max(300).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(5),
  })
  .strict();

/** Which sub-spec key each surfaceType requires. Surfaces not listed here
 *  are payload-free (e.g. choice_grid, scratchpad). */
const SURFACE_SPEC_KEYS = {
  number_line: "numberLine",
  reading_annotation: "readingAnnotation",
  science_diagram: "scienceDiagram",
  graph: "graph",
  coding_sandbox: "codingSandbox",
  art_canvas: "artCanvas",
  music_sequencer: "musicSequencer",
  voice_response: "voiceResponse",
  drag_manipulative: "dragManipulative",
  multi_step_workspace: "multiStep",
  geometry_workspace: "geometryDiagram",
  geometry: "geometryDiagram",
} as const;

export const LessonSurfaceSchema = z
  .object({
    surfaceType: z.enum(LESSON_SURFACE_TYPES),
    numberLine: NumberLineSpecSchema.optional(),
    readingAnnotation: ReadingAnnotationSpecSchema.optional(),
    scienceDiagram: ScienceDiagramSpecSchema.optional(),
    graph: GraphSpecSchema.optional(),
    codingSandbox: CodingSandboxSpecSchema.optional(),
    artCanvas: ArtCanvasSpecSchema.optional(),
    musicSequencer: MusicSequencerSpecSchema.optional(),
    voiceResponse: VoiceResponseSpecSchema.optional(),
    dragManipulative: DragManipulativeSpecSchema.optional(),
    multiStep: MultiStepSpecSchema.optional(),
    geometryDiagram: GeometryDiagramSpecSchema.optional(),
  })
  .strict()
  .superRefine((surface, ctx) => {
    const specKeys = Object.values(SURFACE_SPEC_KEYS) as Array<
      (typeof SURFACE_SPEC_KEYS)[keyof typeof SURFACE_SPEC_KEYS]
    >;
    const required = (SURFACE_SPEC_KEYS as Partial<Record<string, (typeof specKeys)[number]>>)[
      surface.surfaceType
    ];
    const present = specKeys.filter((key) => surface[key] !== undefined);
    if (required && !present.includes(required)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${surface.surfaceType} surfaces require a content-derived ${required} spec`,
      });
    }
    for (const key of present) {
      if (key !== required) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} spec is only valid on its matching surfaceType`,
        });
      }
    }
  });
export type LessonSurface = z.infer<typeof LessonSurfaceSchema>;
export type LessonSurfaceType = (typeof LESSON_SURFACE_TYPES)[number];

/**
 * Strict schema for the AI-generated plan. We require non-empty arrays and
 * stable field names so the player can render every section.
 */
export const GeneratedLessonPlanSchema = z
  .object({
    title: z.string().min(1).max(160),
    objective: z.string().min(1).max(400),
    estimatedMinutes: z.number().int().min(1).max(60),
    tutorPersona: z.string().min(1).max(80),
    tutorGreeting: z.string().min(1).max(400),
    storyHook: z.string().min(1).max(600),
    microLesson: z.string().min(1).max(1500),
    example: z.object({
      prompt: z.string().min(1).max(400),
      explanation: z.string().min(1).max(800),
    }),
    guidedPractice: z
      .array(
        z.object({
          prompt: z.string().min(1).max(400),
          expectedAnswer: z.string().min(1).max(400).optional(),
          choices: z.array(z.string().min(1).max(200)).min(2).max(6).optional(),
          hint: z.string().min(1).max(400),
          scaffold: z.string().min(1).max(400),
          skillId: z.string().min(1),
          surface: LessonSurfaceSchema.optional(),
          media: LessonMediaPayloadSchema.optional(),
        }),
      )
      .min(1)
      .max(8),
    checksForUnderstanding: z
      .array(
        z.object({
          prompt: z.string().min(1).max(400),
          expectedAnswer: z.string().min(1).max(400).optional(),
          choices: z.array(z.string().min(1).max(200)).min(2).max(6).optional(),
          supportIfWrong: z.string().min(1).max(400),
          surface: LessonSurfaceSchema.optional(),
          media: LessonMediaPayloadSchema.optional(),
        }),
      )
      .min(1)
      .max(6),
    accessibilitySupports: z.array(z.string().min(1).max(200)).max(12),
    encouragement: z.string().min(1).max(400),
    parentSummary: z.string().min(1).max(800),
    nextRecommendedStep: z.string().min(1).max(200),
    // Phase 4: tags a break-week lesson as optional holiday-prep enrichment
    // so the learner UI can badge it. Omitted for normal lessons.
    lessonMode: z.enum(["school_sync", "holiday_prep", "summer_bridge"]).optional(),
  })
  .strict();
export type GeneratedLessonPlanInput = z.infer<typeof GeneratedLessonPlanSchema>;
