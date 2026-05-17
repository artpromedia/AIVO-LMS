import { z } from "zod";

export const ageRangeEnum = z.enum([
  "3-5",
  "5-7",
  "7-9",
  "9-11",
  "11-13",
  "13-15",
  "15-18",
]);
export const gradeBandEnum = z.enum([
  "preK",
  "K",
  "1-2",
  "3-5",
  "6-8",
  "9-12",
  "post_secondary",
]);
export const comfortEnum = z.enum(["new", "growing", "confident", "advanced"]);
export const schoolContextEnum = z.enum([
  "in_school",
  "homeschool",
  "hybrid",
  "not_in_school",
]);

export const accessibilityDefaultsSchema = z.object({
  reducedMotion: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  largeText: z.boolean().default(false),
  audioFirst: z.boolean().default(false),
  captionsAlwaysOn: z.boolean().default(false),
});

export const createLearnerSchema = z.object({
  firstName: z.string().min(1).max(80),
  preferredName: z.string().max(80).optional().nullable(),
  birthYear: z
    .number()
    .int()
    .min(1990)
    .max(new Date().getFullYear()),
  pronouns: z.string().max(40).optional().nullable(),
  ageRange: ageRangeEnum.optional().nullable(),
  gradeBand: gradeBandEnum.optional().nullable(),
  schoolContext: schoolContextEnum.optional().nullable(),
  primaryLanguage: z.string().max(60).optional().nullable(),
  readingComfort: comfortEnum.optional().nullable(),
  mathComfort: comfortEnum.optional().nullable(),
  knownStrengths: z.array(z.string().max(200)).max(20).optional(),
  knownChallenges: z.array(z.string().max(200)).max(20).optional(),
  accessibilityDefaults: accessibilityDefaultsSchema.optional(),
});

export type CreateLearnerInput = z.infer<typeof createLearnerSchema>;

export const patchLearnerSchema = createLearnerSchema.partial();
export type PatchLearnerInput = z.infer<typeof patchLearnerSchema>;
