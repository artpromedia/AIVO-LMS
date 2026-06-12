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

export const LessonSurfaceSchema = z
  .object({
    surfaceType: z.enum(LESSON_SURFACE_TYPES),
    numberLine: NumberLineSpecSchema.optional(),
  })
  .strict()
  .superRefine((surface, ctx) => {
    if (surface.surfaceType === "number_line" && !surface.numberLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "number_line surfaces require a content-derived numberLine spec",
      });
    }
    if (surface.surfaceType !== "number_line" && surface.numberLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "numberLine spec is only valid on number_line surfaces",
      });
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
