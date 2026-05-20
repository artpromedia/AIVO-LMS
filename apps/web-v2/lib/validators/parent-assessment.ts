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
export const WIZARD_STEPS: {
  id: number;
  /** Short label for the step (used in legacy stepper). */
  label: string;
  /** Long, friendly label used in the calm soft-glass screen header. */
  longLabel: string;
  /** Sentence shown under the title to frame the question. */
  helper?: string;
  sections: AssessmentSectionId[];
}[] = [
  {
    id: 1,
    label: "Background",
    longLabel: "Tell us about your child",
    helper:
      "A few quick details so AIVO can speak about your learner the way you do. None of this is shown to your child.",
    sections: ["basics", "background"],
  },
  {
    id: 2,
    label: "Strengths",
    longLabel: "What does your child love and do well?",
    helper:
      "Strengths help AIVO weave familiar topics into early lessons. There's no wrong answer here.",
    sections: ["strengths"],
  },
  {
    id: 3,
    label: "Challenges",
    longLabel: "What gets in the way of learning?",
    helper:
      "Tell us about frustration triggers and what helps your child reset. AIVO uses this to avoid stuck-points.",
    sections: ["frustration"],
  },
  {
    id: 4,
    label: "Subjects",
    longLabel: "Grade level and subject focus",
    helper:
      "Pick the grade band your child is working in, plus the subjects you'd like AIVO to focus on first.",
    sections: ["grade_subject"],
  },
  {
    id: 5,
    label: "Attention & pacing",
    longLabel: "How does your child focus and pace?",
    helper:
      "Short focus windows and frequent breaks are common and fine. AIVO will plan sessions around what works.",
    sections: ["attention", "pace"],
  },
  {
    id: 6,
    label: "Communication",
    longLabel: "How does your child communicate?",
    helper:
      "Spoken, written, visual, mixed, AAC — every learner is different. AIVO honours whatever you select.",
    sections: ["communication", "learning_profile"],
  },
  {
    id: 7,
    label: "Reading",
    longLabel: "Reading comfort",
    helper:
      "Pick the level that matches today, not the long-term goal. AIVO will adjust automatically as your child grows.",
    sections: ["reading"],
  },
  {
    id: 8,
    label: "Math",
    longLabel: "Math confidence",
    helper:
      "How does math feel for your child right now? AIVO will start at a comfortable place and build from there.",
    sections: ["math"],
  },
  {
    id: 9,
    label: "Sensory & support",
    longLabel: "Sensory needs and known supports",
    helper:
      "Tell AIVO about sensitivities and any accommodations that already help. These shape the calm-mode defaults.",
    sections: ["sensory", "accommodations"],
  },
  {
    id: 10,
    label: "Routine & goals",
    longLabel: "When does learning fit best, and what's the goal?",
    helper:
      "Best time of day, typical session length, what you'd like AIVO to help with, and what motivates your learner.",
    sections: ["homework", "goals", "motivation"],
  },
  {
    id: 11,
    label: "Concerns",
    longLabel: "Anything else AIVO should know?",
    helper:
      "Tell us what's on your mind. There's no right or wrong here — this goes straight to the personalization layer.",
    sections: ["concerns"],
  },
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
