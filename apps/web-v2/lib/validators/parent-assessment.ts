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

/** Group the 17 sections into 12 wizard steps for a calmer flow — one thought
 *  at a time, never more than ~4 inputs per screen. The first step (Basics)
 *  and the Background/Strengths/Learning-profile sections feed the legacy
 *  brain-clone signals (functioning level, diagnoses, communication mode) —
 *  see `lib/learner/brain-profile.ts`.
 *
 *  Sprint C-11 split the old overloaded step 10 (homework + goals + motivation,
 *  ~7 inputs) into two calmer screens: step 10 "Routine" (homework) and step 11
 *  "Goals & motivation". Section ids are unchanged — only their grouping moved —
 *  so in-progress drafts keyed by section id resume correctly under the new
 *  mapping (a pre-split draft's `goals`/`motivation` answers simply surface on
 *  the new step 11). */
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
    label: "Routine",
    longLabel: "When does learning fit best?",
    helper:
      "Best time of day and a rough session length. AIVO plans around the rhythm that already works for your family.",
    sections: ["homework"],
  },
  {
    id: 11,
    label: "Goals & motivation",
    longLabel: "What's the goal, and what keeps your learner going?",
    helper:
      "What you'd like AIVO to help with, and the rewards or motivators that help. There's no wrong answer here.",
    sections: ["goals", "motivation"],
  },
  {
    id: 12,
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

/**
 * Draft-lenient section validator for FIELD-LEVEL AUTOSAVE (Sprint C-11).
 *
 * Submit validation (`validateSection`) is strict: every required field must be
 * present and well-formed before the assessment can be submitted. Autosave is
 * different — a parent typing one field mid-screen must have that field saved
 * without first satisfying the whole section's required shape (draft ≠ submit).
 *
 * This makes every field optional (so a half-filled section persists) while
 * still enforcing each field's *type* and bounds (string length, enum values,
 * array caps, numeric ranges) so the draft store can never accept garbage.
 * Unknown keys are stripped. Empty objects are allowed (nothing to save yet).
 *
 * Implementation: Zod's `.partial()` relaxes required → optional; for sections
 * whose fields are themselves arrays/strings we keep the element constraints.
 * The strict submit gate still runs on Next/Submit, which remains the
 * authoritative write — autosave only ever advances the draft, never the
 * submitted state.
 */
export function draftValidateSection(
  section: AssessmentSectionId,
  data: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  const schema = assessmentSectionSchemas[section];
  // `.partial()` turns every top-level key optional but preserves each field's
  // own validators (enum membership, max-length, numeric range). `.strip()` is
  // Zod's default object behaviour, so unknown keys are dropped silently.
  const draftSchema = schema.partial();
  const parsed = draftSchema.safeParse(data ?? {});
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message };
  }
  // Drop keys whose value resolved to `undefined` so the stored draft stays
  // clean (a cleared field shouldn't persist an explicit `undefined`).
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
  }
  return { ok: true, data: out };
}

/**
 * Resume-progress derivation (Sprint C-11).
 *
 * Powers the welcoming resume card ("You're 7 of 12 screens in — about 2
 * minutes left. Your answers are saved.") on the intro and the learner detail
 * page, and the intro's "Continue where I left off" target.
 *
 * A wizard STEP counts as DONE when every section it groups has been answered
 * (has at least one stored value) AND passes strict submit validation — so an
 * untouched optional step (e.g. Strengths left blank) never inflates "7 of 12"
 * and an invalid step never counts. `nextStep` is the first step the parent has
 * not finished — the first step with an unanswered or invalid section — exactly
 * the "first incomplete step" the intro has always resumed to; it is `null`
 * only when every step is done.
 *
 * The minute estimate mirrors the per-step wizard hint logic
 * (`About {remaining} minutes left`, ~1 screen/minute) so the intro card, the
 * learner detail card, and the in-wizard progress hint all tell the same story.
 */
export interface AssessmentProgressSummary {
  total: number;
  /** Number of fully-complete wizard steps. */
  done: number;
  /** First incomplete step id (the Continue target), or null if all done. */
  nextStep: number | null;
  /** Honest minutes-left estimate (≥ 0). */
  minutesLeft: number;
  /** True once at least one section has been answered (resume affordance). */
  started: boolean;
}

export function deriveAssessmentProgress(
  answers: Partial<Record<AssessmentSectionId, Record<string, unknown> | undefined>>,
): AssessmentProgressSummary {
  const total = WIZARD_STEPS.length;
  let firstIncomplete: number | null = null;
  let done = 0;
  let answeredAny = false;

  for (const step of WIZARD_STEPS) {
    // A step is DONE when EVERY section it groups has been answered (non-empty)
    // and passes strict validation. An all-optional step left blank is NOT done
    // — it stays the resume target until the parent visits it, matching the
    // intro's long-standing "first step with an unanswered section" behaviour.
    const stepDone = step.sections.every((sec) => {
      const sectionAnswers = answers[sec];
      const answered = !!sectionAnswers && Object.keys(sectionAnswers).length > 0;
      if (answered) answeredAny = true;
      return answered && validateSection(sec, sectionAnswers ?? {}).ok;
    });
    if (stepDone) {
      done += 1;
    } else if (firstIncomplete === null) {
      firstIncomplete = step.id;
    }
  }

  return {
    total,
    done,
    nextStep: firstIncomplete,
    // One calm screen ≈ one minute; never below zero, never below 1 while work
    // remains so the card never reads "0 minutes left" with steps outstanding.
    minutesLeft: firstIncomplete === null ? 0 : Math.max(1, total - done),
    started: answeredAny,
  };
}
