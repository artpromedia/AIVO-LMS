import { z } from "zod";

export const ageRangeEnum = z.enum(["3-5", "5-7", "7-9", "9-11", "11-13", "13-15", "15-18"]);
export const gradeBandEnum = z.enum(["preK", "K", "1-2", "3-5", "6-8", "9-12", "post_secondary"]);
export const comfortEnum = z.enum(["new", "growing", "confident", "advanced"]);
export const schoolContextEnum = z.enum(["in_school", "homeschool", "hybrid", "not_in_school"]);

export const accessibilityDefaultsSchema = z.object({
  reducedMotion: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  largeText: z.boolean().default(false),
  audioFirst: z.boolean().default(false),
  captionsAlwaysOn: z.boolean().default(false),
});

const zipCodeSchema = z
  .string()
  .regex(/^\d{5}$/, "Zip code must be 5 digits")
  .optional()
  .nullable();

const learnerShape = {
  firstName: z.string().min(1).max(80),
  preferredName: z.string().max(80).optional().nullable(),
  birthYear: z.number().int().min(1990).max(new Date().getFullYear()),
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
  // Sprint A: zip + resolved district. All three are optional, but if
  // a parent provides a zip the resolver populates the hidden district
  // fields; the server cross-checks rather than re-resolving.
  zipCode: zipCodeSchema,
  districtId: z.string().max(64).optional().nullable(),
  districtName: z.string().max(255).optional().nullable(),
} as const;

const baseLearnerSchema = z.object(learnerShape);

export const createLearnerSchema = baseLearnerSchema.superRefine((value, ctx) => {
  // If a district was claimed, require a zip — protects against the
  // hidden inputs being submitted without the visible zip field.
  if (value.districtId && !value.zipCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["zipCode"],
      message: "Zip code is required when a district is selected.",
    });
  }
});

export type CreateLearnerInput = z.infer<typeof createLearnerSchema>;

export const patchLearnerSchema = baseLearnerSchema.partial();
export type PatchLearnerInput = z.infer<typeof patchLearnerSchema>;
