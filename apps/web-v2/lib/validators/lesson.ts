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
    if (!captions.src.endsWith(".vtt")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "captions src must end with .vtt",
      });
    }
  });

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
          media: LessonMediaPayloadSchema.optional(),
        }),
      )
      .min(1)
      .max(6),
    accessibilitySupports: z.array(z.string().min(1).max(200)).max(12),
    encouragement: z.string().min(1).max(400),
    parentSummary: z.string().min(1).max(800),
    nextRecommendedStep: z.string().min(1).max(200),
  })
  .strict();
export type GeneratedLessonPlanInput = z.infer<typeof GeneratedLessonPlanSchema>;
