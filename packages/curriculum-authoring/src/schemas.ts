import { z } from "zod";

export const SUBJECTS = ["math", "ela", "science", "writing"] as const;
export const GRADE_BANDS = ["K", "1", "2", "3", "4", "5", "6", "7", "8"] as const;
export const REVIEW_STATUSES = ["draft", "sme_review_required", "sme_approved", "rejected"] as const;
export const REVIEWER_ROLES = [
  "math_curriculum_designer",
  "ela_curriculum_designer",
  "science_curriculum_designer",
  "writing_curriculum_designer",
  "sped_specialist",
  "assessment_specialist",
  "district_reviewer",
] as const;

export const SubjectSchema = z.enum(SUBJECTS);
export const GradeBandSchema = z.enum(GRADE_BANDS);
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);
export const ReviewerRoleSchema = z.enum(REVIEWER_ROLES);

export const CognitiveLevelSchema = z.enum([
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);

export const ItemQuestionTypeSchema = z.enum([
  "multiple-choice",
  "multiple-select",
  "short-answer",
  "matching",
  "ordering",
  "fill-blank",
  "true-false",
  "constructed-response",
]);

export const ExpertReviewSchema = z
  .object({
    status: ReviewStatusSchema,
    reviewerRole: ReviewerRoleSchema.optional(),
    reviewedBy: z.string().trim().min(2).optional(),
    reviewedAt: z.string().datetime().optional(),
    notes: z.string().trim().max(2_000).optional(),
  })
  .superRefine((review, ctx) => {
    if (review.status !== "sme_approved") return;
    for (const key of ["reviewerRole", "reviewedBy", "reviewedAt"] as const) {
      if (!review[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `sme_approved review requires ${key}.`,
        });
      }
    }
  });

export const AccessibilitySupportSchema = z.object({
  category: z.enum([
    "presentation",
    "response",
    "setting",
    "timing",
    "language",
    "executive_function",
    "sensory",
  ]),
  support: z.string().trim().min(3).max(500),
  preservesConstruct: z.boolean().default(true),
});

export const StandardReferenceSchema = z.object({
  code: z.string().trim().min(2),
  framework: z.string().trim().min(2),
  jurisdiction: z.string().trim().min(2).optional(),
  description: z.string().trim().min(10).max(2_000),
  strand: z.string().trim().min(2).optional(),
});

export const MasteryCriteriaSchema = z.object({
  minAccuracy: z.number().min(0).max(1).default(0.8),
  minOpportunities: z.number().int().min(1).max(50).default(5),
  retentionWindowDays: z.number().int().min(0).max(180).default(14),
});

export const SkillNodeSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9_.-]+$/, "Use stable lowercase ids such as ccss.math.k.cc.a.1."),
  subject: SubjectSchema,
  gradeBand: GradeBandSchema,
  domain: z.string().trim().min(2).max(120),
  strand: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(1_000),
  standardCodes: z.array(z.string().trim().min(2)).min(1),
  prerequisiteSkillIds: z.array(z.string().trim()).default([]),
  masteryCriteria: MasteryCriteriaSchema.default({
    minAccuracy: 0.8,
    minOpportunities: 5,
    retentionWindowDays: 14,
  }),
  accessibilitySupports: z.array(AccessibilitySupportSchema).default([]),
  review: ExpertReviewSchema,
});

export const LessonTopicSchema = z.object({
  title: z.string().trim().min(4).max(180),
  objectives: z.array(z.string().trim().min(8).max(500)).min(1),
  durationMin: z.number().int().min(5).max(240),
  lessonType: z.string().trim().min(3).max(80),
  materials: z.array(z.string().trim().min(1)).default([]),
  skillIds: z.array(z.string().trim()).min(1),
  standardCodes: z.array(z.string().trim().min(2)).min(1),
  accessibilitySupports: z.array(AccessibilitySupportSchema).default([]),
  review: ExpertReviewSchema,
});

export const UnitBlueprintSchema = z.object({
  title: z.string().trim().min(4).max(180),
  description: z.string().trim().min(20).max(2_000),
  essentialQuestions: z.array(z.string().trim().min(8).max(500)).min(1),
  bigIdeas: z.array(z.string().trim().min(8).max(500)).min(1),
  durationDays: z.number().int().min(1).max(90),
  skillIds: z.array(z.string().trim()).min(1),
  standardCodes: z.array(z.string().trim().min(2)).min(1),
  lessonTopics: z.array(LessonTopicSchema).min(1),
  review: ExpertReviewSchema,
});

export const CurriculumTemplateBlueprintSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9_.-]+$/),
  name: z.string().trim().min(6).max(180),
  description: z.string().trim().min(20).max(2_000),
  subject: SubjectSchema,
  gradeBand: GradeBandSchema,
  baseStandards: z.array(z.string().trim().min(2)).min(1),
  tags: z.array(z.string().trim().min(2).max(60)).default([]),
  unitBlueprints: z.array(UnitBlueprintSchema).min(1),
  review: ExpertReviewSchema,
});

export const ItemBankItemSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9_.-]+$/),
    skillId: z.string().trim().min(2),
    subject: SubjectSchema,
    gradeBand: GradeBandSchema,
    standardCodes: z.array(z.string().trim().min(2)).min(1),
    questionType: ItemQuestionTypeSchema,
    prompt: z.string().trim().min(10).max(5_000),
    choices: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(8),
          text: z.string().trim().min(1).max(1_000),
          isCorrect: z.boolean().default(false),
        }),
      )
      .optional(),
    correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
    scoringRubric: z.string().trim().max(5_000).optional(),
    cognitiveLevel: CognitiveLevelSchema,
    difficulty: z.number().min(0).max(1),
    accessibilitySupports: z.array(AccessibilitySupportSchema).default([]),
    review: ExpertReviewSchema,
  })
  .superRefine((item, ctx) => {
    const selectedResponse = ["multiple-choice", "multiple-select", "true-false"].includes(item.questionType);
    if (selectedResponse) {
      if (!item.choices || item.choices.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["choices"], message: "Selected-response items require at least two choices." });
      }
      if (item.choices && !item.choices.some((choice) => choice.isCorrect)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["choices"], message: "Selected-response items require at least one correct choice." });
      }
    }
    if (["short-answer", "constructed-response"].includes(item.questionType) && !item.scoringRubric) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scoringRubric"], message: "Open-response items require a scoring rubric." });
    }
  });

export const K8CurriculumPackSchema = z.object({
  schemaVersion: z.literal("2026-05-18.k8-authoring.v1"),
  metadata: z.object({
    name: z.string().trim().min(6).max(180),
    version: z.string().trim().min(1).max(40),
    academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/, "Use academicYear format YYYY-YYYY."),
    publisher: z.string().trim().min(2).max(180),
    sourceNotes: z.string().trim().max(2_000).optional(),
    expertReviews: z.array(ExpertReviewSchema).default([]),
  }),
  standards: z.array(StandardReferenceSchema).min(1),
  skills: z.array(SkillNodeSchema).min(1),
  templates: z.array(CurriculumTemplateBlueprintSchema).min(1),
  itemBankItems: z.array(ItemBankItemSchema).default([]),
});

export type ExpertReview = z.infer<typeof ExpertReviewSchema>;
export type SkillNode = z.infer<typeof SkillNodeSchema>;
export type ItemBankItem = z.infer<typeof ItemBankItemSchema>;
export type CurriculumTemplateBlueprint = z.infer<typeof CurriculumTemplateBlueprintSchema>;
export type K8CurriculumPack = z.infer<typeof K8CurriculumPackSchema>;
