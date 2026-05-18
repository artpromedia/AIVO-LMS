import { z } from "zod";
import { comfortEnum } from "@/lib/validators/learner";

/** One Zod schema per assessment section. The wizard PATCHes a single section
 *  per step; the submit endpoint validates that every required section is
 *  present. */
export const assessmentSectionSchemas = {
  goals: z.object({
    goals: z.array(z.string().max(200)).min(1).max(8),
    timeline: z.enum(["weeks", "this_term", "this_year", "long_term"]).optional(),
  }),
  grade_subject: z.object({
    gradeBand: z.enum(["preK", "K", "1-2", "3-5", "6-8", "9-12", "post_secondary"]),
    focusSubjects: z.array(z.string().max(40)).min(1).max(7),
  }),
  reading: z.object({
    comfort: comfortEnum,
    notes: z.string().max(500).optional(),
  }),
  math: z.object({
    comfort: comfortEnum,
    notes: z.string().max(500).optional(),
  }),
  attention: z.object({
    focusWindowMinutes: z.number().int().min(1).max(120),
    breakStyle: z.enum(["frequent_short", "occasional", "long_uninterrupted"]),
    movementHelps: z.boolean().optional(),
  }),
  communication: z.object({
    style: z.enum(["spoken", "written", "visual", "mixed"]),
    aacUsed: z.boolean().optional(),
    notes: z.string().max(500).optional(),
  }),
  sensory: z.object({
    sensitivities: z.array(z.enum(["sound", "light", "touch", "movement", "smell", "taste"])),
    seekingOrAvoiding: z.enum(["seeking", "avoiding", "mixed", "neutral"]).optional(),
  }),
  homework: z.object({
    needsCoaching: z.boolean(),
    bestTimeOfDay: z.enum(["morning", "afternoon", "evening", "varies"]),
    typicalSessionMinutes: z.number().int().min(1).max(180).optional(),
  }),
  frustration: z.object({
    triggers: z.array(z.string().max(120)).max(10),
    calmingStrategies: z.array(z.string().max(120)).max(10),
  }),
  motivation: z.object({
    rewardsThatHelp: z.array(z.string().max(120)).max(10),
    avoidanceFactors: z.array(z.string().max(120)).max(10).optional(),
  }),
  accommodations: z.object({
    known: z.array(z.string().max(200)).max(20),
    extendedTime: z.boolean().optional(),
    readAloud: z.boolean().optional(),
    speechToText: z.boolean().optional(),
  }),
  pace: z.object({
    preferred: z.enum(["slow", "steady", "fast"]),
  }),
  concerns: z.object({
    concerns: z.string().max(2000),
  }),
  // ===== Sprint 14: legacy brain-clone parity sections =====
  basics: z.object({
    /** Optional date of birth (ISO yyyy-mm-dd). Used for grade alignment. */
    dob: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    pronouns: z.string().max(40).optional(),
    languages: z.array(z.string().max(40)).max(5).optional(),
  }),
  strengths: z.object({
    loves: z.string().max(500).optional(),
    goodAt: z.array(z.string().max(60)).max(10).optional(),
    motivates: z.string().max(500).optional(),
  }),
  background: z.object({
    /** Common diagnosis labels. Free-form additions allowed via "other:…" entries. */
    diagnoses: z.array(z.string().max(80)).max(15).optional(),
    /** Current support services the child receives (speech, OT, PT, ABA, counseling, etc.). */
    services: z.array(z.string().max(80)).max(15).optional(),
  }),
  learning_profile: z.object({
    communicationMode: z.enum(["verbal", "sign", "aac", "non_verbal"]).optional(),
    deviceInteraction: z.enum(["independent", "with_prompts", "hand_over_hand"]).optional(),
    responseMethod: z.enum(["touch", "voice", "switch", "eye_gaze"]).optional(),
    attentionSpanBucket: z.enum(["under_5", "5_10", "10_20", "20_plus"]).optional(),
    bestModes: z
      .array(z.enum(["visual", "auditory", "kinesthetic", "reading_writing"]))
      .max(4)
      .optional(),
  }),
} as const;

export type AssessmentSectionId = keyof typeof assessmentSectionSchemas;

export const ASSESSMENT_SECTION_ORDER: AssessmentSectionId[] = [
  "basics",
  "goals",
  "background",
  "strengths",
  "grade_subject",
  "reading",
  "math",
  "attention",
  "communication",
  "learning_profile",
  "sensory",
  "homework",
  "frustration",
  "motivation",
  "accommodations",
  "pace",
  "concerns",
];

export const ASSESSMENT_SECTION_LABEL: Record<AssessmentSectionId, string> = {
  basics: "About your child",
  goals: "Learning goals",
  background: "Background & support",
  strengths: "Strengths",
  grade_subject: "Grade & subjects",
  reading: "Reading confidence",
  math: "Math confidence",
  attention: "Attention & focus",
  communication: "Communication style",
  learning_profile: "Learning profile",
  sensory: "Sensory preferences",
  homework: "Homework habits",
  frustration: "Frustration triggers",
  motivation: "Motivation",
  accommodations: "Known accommodations",
  pace: "Preferred pace",
  concerns: "Your concerns",
};

/** Group the 17 sections into 8 wizard steps for a calmer flow. The first
 *  step (Basics) and the new Background/Strengths/Learning-profile sections
 *  feed the legacy brain-clone signals (functioning level, diagnoses,
 *  communication mode) — see `lib/learner/brain-profile.ts`. */
export const WIZARD_STEPS: { id: number; label: string; sections: AssessmentSectionId[] }[] = [
  { id: 1, label: "Basics", sections: ["basics"] },
  { id: 2, label: "Goals", sections: ["goals"] },
  { id: 3, label: "Background", sections: ["background", "strengths"] },
  { id: 4, label: "Confidence", sections: ["grade_subject", "reading", "math"] },
  {
    id: 5,
    label: "Focus & style",
    sections: ["attention", "communication", "learning_profile"],
  },
  { id: 6, label: "Sensory & routine", sections: ["sensory", "homework"] },
  { id: 7, label: "Triggers & motivation", sections: ["frustration", "motivation"] },
  { id: 8, label: "Supports & pace", sections: ["accommodations", "pace", "concerns"] },
];

export function validateSection(
  section: AssessmentSectionId,
  data: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  const schema = assessmentSectionSchemas[section];
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}
