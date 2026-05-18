/**
 * Parent Assessment — question bank
 * ─────────────────────────────────────────────────────────────────────────────
 * Models the 8-section framework documented in
 * `attached_assets/Pasted--Aivo-Parent-Assessment-Design-Framework-...txt`.
 *
 * Design principles encoded here:
 *  • Strengths-first: Section 2 (Strengths/Interests/Motivations) appears
 *    before Section 3 (Diagnoses/Medical) and the 4-x sub-modules.
 *  • Observable behaviour only — no clinical jargon. Frequency Likerts use
 *    Never/Rarely/Sometimes/Often/Always plus a mandatory "Not sure" escape.
 *  • Almost everything is soft-required ("I'd rather not say" implicitly via
 *    the `required: false` default). Only DOB and consent are hard-required.
 *  • The MVP cut from framework §9 is shipped here: Sections 0/1/2 in full,
 *    3-lite, 4a/4b/4g, 5 + access mini-block, 6, 7. Sensory/Motor/Adaptive/
 *    Behavior-Regulation sub-modules (4c-4f) are deferred to v2.
 *
 * The legacy heuristic in `services/assessment-svc/src/services/level-router.ts`
 * still keys off five compat IDs (communicationMode, deviceInteraction,
 * responseMethod, attentionSpan, diagnoses) — those question IDs are kept
 * stable below and re-mapped to their new section homes (see COMPAT_IDS).
 */

export type QuestionType =
  /** Never / Rarely / Sometimes / Often / Always + "Not sure / Haven't observed" */
  | "likert5_with_unsure"
  /** Single radio choice */
  | "single_select"
  /** Multi-checkbox; set `allowOther: true` to render an inline "Other" text input */
  | "multi_select"
  /** Single-line text */
  | "open_short"
  /** Multi-line text (textarea) */
  | "open_long"
  /** Drag-and-drop ranking of a fixed option list (parent picks top 3) */
  | "rank_top_three"
  /** Single hard-required consent checkbox */
  | "consent_checkbox"
  /** ISO date input (used for DOB) */
  | "date"
  /** Yes / No / Prefer not to say */
  | "yes_no";

/** Age bands per framework §7. Used for question gating. */
export type AgeBand = "2-4" | "5-8" | "9-12" | "13+";

export interface AssessmentQuestion {
  id: string;
  sectionKey: string;
  text: string;
  type: QuestionType;
  options?: string[];
  /** When true, renders an inline "Other (please specify)" text field. */
  allowOther?: boolean;
  /** Soft-required by default; only DOB and consent are truly required. */
  required?: boolean;
  helpText?: string;
  /** Omit = applies to all bands. */
  ageBands?: AgeBand[];
  /** Likert items framed around a concern (high score = worse). Reverse-coded
   *  by downstream scoring — the parent sees the same Never→Always scale. */
  reverseScored?: boolean;
  /** Self-harm / aggression items flagged for human-review queue. */
  isSafetyFlag?: boolean;
  /** Simple show-if branching. */
  conditionalOn?: { questionId: string; values: string[] };
}

export interface AssessmentSection {
  key: string;
  /** 0-7 per framework. */
  number: number;
  label: string;
  shortLabel: string;
  icon: string;
  /** One-line "why this section exists" shown above the questions —
   *  framework §1 principle 7: "Explain the why". */
  rationale: string;
  estimatedMinutes: number;
  /** When true, a "Skip this section" button appears. */
  optional?: boolean;
  /** Section 0 (welcome) and 7 (wrap-up) render their own custom screens
   *  rather than a list of questions. */
  isSpecial?: boolean;
  questions: AssessmentQuestion[];
}

/** Likert anchor labels — same across every frequency item. */
export const LIKERT5_LABELS = ["Never", "Rarely", "Sometimes", "Often", "Always"] as const;
/** The escape hatch — never include this in scoring composites. */
export const NOT_SURE_VALUE = "not_sure";
export const NOT_SURE_LABEL = "Not sure / Haven't observed";

/** Question IDs whose answers feed the legacy `level-router` heuristic.
 *  Keep these stable — backend depends on them. */
export const COMPAT_IDS = {
  /** Single-select: child's primary communication mode */
  communicationMode: "cn-1",
  /** Single-select: how child interacts with screens */
  deviceInteraction: "im-1",
  /** Single-select: how child responds to questions */
  responseMethod: "fl-4",
  /** Single-select: attention span for non-preferred tasks (range buckets) */
  attentionSpan: "ls-3",
  /** Multi-select: diagnoses */
  diagnoses: "ch-2",
} as const;

export const PARENT_ASSESSMENT_SECTIONS: AssessmentSection[] = [
  // ───── Section 0 — Welcome & Consent ─────────────────────────────────
  {
    key: "welcome",
    number: 0,
    label: "Welcome",
    shortLabel: "Start",
    icon: "👋",
    rationale:
      "Hi — thanks for being here. The next 12 minutes help us meet your child where they are. Save anytime; come back when you can.",
    estimatedMinutes: 1,
    isSpecial: true,
    questions: [
      {
        id: "consent-1",
        sectionKey: "welcome",
        text: "I understand my answers will be used to personalize learning for my child. I can edit, export, or delete this anytime.",
        type: "consent_checkbox",
        required: true,
      },
    ],
  },

  // ───── Section 1 — Child Basics & Family Context ─────────────────────
  {
    key: "basics",
    number: 1,
    label: "About your child",
    shortLabel: "Basics",
    icon: "🌱",
    rationale: "Quick context so we can age-appropriate everything. Most fields are optional.",
    estimatedMinutes: 2,
    questions: [
      {
        id: "ba-nickname",
        sectionKey: "basics",
        text: "What does your child like to be called?",
        type: "open_short",
        helpText: "First name or nickname — whatever they prefer.",
      },
      {
        id: "ba-dob",
        sectionKey: "basics",
        text: "Date of birth",
        type: "date",
        required: true,
        helpText: "Used to choose age-appropriate questions and content.",
      },
      {
        id: "ba-pronouns",
        sectionKey: "basics",
        text: "Pronouns (optional)",
        type: "single_select",
        options: ["she/her", "he/him", "they/them", "Prefer not to say", "Other"],
        allowOther: true,
      },
      {
        id: "ba-completer",
        sectionKey: "basics",
        text: "Who's filling this out?",
        type: "single_select",
        options: ["Parent", "Grandparent", "Foster parent", "Guardian", "Other caregiver"],
        allowOther: true,
      },
      {
        id: "ba-languages",
        sectionKey: "basics",
        text: "Languages spoken in your home",
        type: "multi_select",
        options: [
          "English",
          "Spanish",
          "Mandarin",
          "French",
          "Arabic",
          "Hindi",
          "Tagalog",
          "Vietnamese",
          "Korean",
        ],
        allowOther: true,
      },
      {
        id: "ba-siblings",
        sectionKey: "basics",
        text: "Any siblings? (optional)",
        type: "open_short",
        helpText: "Names and ages, or just ages — whatever feels comfortable.",
      },
    ],
  },

  // ───── Section 2 — Strengths, Interests & Motivations (the fun bit) ──
  {
    key: "strengths",
    number: 2,
    label: "What lights them up",
    shortLabel: "Strengths",
    icon: "✨",
    rationale:
      "This is our favourite section. What you share here directly shapes the kind of stories, examples, and rewards your child sees.",
    estimatedMinutes: 4,
    questions: [
      {
        id: "st-loves",
        sectionKey: "strengths",
        text: "What are 3 things your child loves to do?",
        type: "open_long",
        helpText: "However small. Watching trains, feeding the cat, anything.",
      },
      {
        id: "st-endless",
        sectionKey: "strengths",
        text: "What topics, characters, or activities can they talk about endlessly?",
        type: "open_short",
      },
      {
        id: "st-laugh",
        sectionKey: "strengths",
        text: "What makes your child laugh?",
        type: "open_short",
      },
      {
        id: "st-good-at",
        sectionKey: "strengths",
        text: "What are they naturally good at?",
        type: "multi_select",
        options: [
          "Art & drawing",
          "Music",
          "Memory",
          "Puzzles",
          "Sports",
          "Numbers",
          "Storytelling",
          "Building",
          "Caring for others",
          "Animals",
          "Noticing details",
          "Comforting others",
          "Negotiating",
          "Inventing games",
        ],
        allowOther: true,
      },
      {
        id: "st-praise",
        sectionKey: "strengths",
        text: "How does your child best receive praise?",
        type: "single_select",
        options: [
          "Words",
          "Hugs / physical",
          "Treats",
          "Alone time",
          "Shared activity",
          "Earned privilege",
        ],
      },
      {
        id: "st-motivates",
        sectionKey: "strengths",
        text: "What usually motivates them to try something hard?",
        type: "multi_select",
        options: [
          "Earning something they want",
          "Beating their own time / score",
          "Helping someone else",
          "Surprise / mystery",
          "Story or character",
          "Being the expert",
          "Doing it with a parent",
          "Just figuring it out themselves",
        ],
        allowOther: true,
      },
    ],
  },

  // ───── Section 3 — Developmental & Medical (lite) ────────────────────
  {
    key: "history",
    number: 3,
    label: "Background",
    shortLabel: "History",
    icon: "🩺",
    rationale:
      "We only ask what we'll actually use. Skip anything you'd rather not share — your tutor experience won't suffer for it.",
    estimatedMinutes: 3,
    optional: true,
    questions: [
      {
        // NOTE: must remain id "ch-2" — feeds level-router compat (COMPAT_IDS.diagnoses).
        id: "ch-2",
        sectionKey: "history",
        text: "Any diagnoses or learning differences? (optional)",
        type: "multi_select",
        options: [
          "None / not applicable",
          "ADHD / ADD",
          "Autism spectrum",
          "Dyslexia / reading difference",
          "Dyscalculia / math difference",
          "Speech / language",
          "Hearing",
          "Vision",
          "Anxiety",
          "Depression",
          "Chronic medical",
          "Currently being evaluated",
          "Prefer not to say",
        ],
        allowOther: true,
        helpText: "Confidential and only used to personalize.",
      },
      {
        id: "hi-services",
        sectionKey: "history",
        text: "Any current therapies or services?",
        type: "multi_select",
        options: [
          "None",
          "Occupational therapy",
          "Physical therapy",
          "Speech therapy",
          "ABA",
          "Counseling / mental health",
          "Tutoring",
          "IEP / 504",
        ],
        allowOther: true,
      },
      {
        id: "hi-meds",
        sectionKey: "history",
        text: "Any medications that affect attention, mood, or learning?",
        type: "yes_no",
        helpText: "Just yes/no — we won't ask names.",
      },
      {
        id: "hi-sleep",
        sectionKey: "history",
        text: "Roughly how many hours does your child sleep per night?",
        type: "single_select",
        options: ["Under 6", "6–8", "8–10", "10–12", "Over 12", "Varies a lot"],
      },
    ],
  },

  // ───── Section 4a — Communication & Language ─────────────────────────
  {
    key: "communication",
    number: 4,
    label: "How they communicate",
    shortLabel: "Communication",
    icon: "💬",
    rationale:
      "These help us match content to your child's language level — what they receive, what they express, and how they prefer to do it.",
    estimatedMinutes: 3,
    questions: [
      {
        // Compat: COMPAT_IDS.communicationMode (cn-1)
        id: "cn-1",
        sectionKey: "communication",
        text: "How does your child mainly communicate?",
        type: "single_select",
        options: [
          "Verbal speech (speaks clearly)",
          "Verbal speech (limited vocabulary or clarity)",
          "Sign language",
          "Picture symbols (PECS, Boardmaker, etc.)",
          "Communication device / app (AAC)",
          "Gestures and pointing",
          "Combination of methods",
          "Non-verbal / Pre-verbal",
        ],
      },
      {
        id: "co-simple-instructions",
        sectionKey: "communication",
        text: 'Follows simple instructions (e.g. "please put your shoes on").',
        type: "likert5_with_unsure",
      },
      {
        id: "co-multi-step",
        sectionKey: "communication",
        text: 'Follows multi-step instructions (e.g. "brush your teeth then bring me your bag").',
        type: "likert5_with_unsure",
      },
      {
        id: "co-tells-story",
        sectionKey: "communication",
        text: "Tells you about something that happened earlier in the day.",
        type: "likert5_with_unsure",
      },
      {
        id: "co-back-and-forth",
        sectionKey: "communication",
        text: "Has back-and-forth conversations with at least 3 turns.",
        type: "likert5_with_unsure",
      },
      {
        id: "co-asks-questions",
        sectionKey: "communication",
        text: "Asks questions to learn new things.",
        type: "likert5_with_unsure",
      },
      {
        id: "co-jokes",
        sectionKey: "communication",
        text: "Understands jokes, sarcasm, or figures of speech.",
        type: "likert5_with_unsure",
        ageBands: ["9-12", "13+"],
      },
      {
        id: "co-open",
        sectionKey: "communication",
        text: "Anything specific about how your child communicates we should know? (optional)",
        type: "open_long",
      },
    ],
  },

  // ───── Section 4b — Social-Emotional ─────────────────────────────────
  {
    key: "social_emotional",
    number: 4,
    label: "Friendships & feelings",
    shortLabel: "Social-Emotional",
    icon: "💛",
    rationale:
      "How your child connects with others and rides emotional waves — both shape what kinds of stories and rewards land for them.",
    estimatedMinutes: 3,
    questions: [
      {
        id: "se-cooperative",
        sectionKey: "social_emotional",
        text: "Plays cooperatively with other children (takes turns, shares).",
        type: "likert5_with_unsure",
      },
      {
        id: "se-friendships",
        sectionKey: "social_emotional",
        text: "Has one or more close friendships.",
        type: "likert5_with_unsure",
      },
      {
        id: "se-names-feelings",
        sectionKey: "social_emotional",
        text: "Can name what they're feeling.",
        type: "likert5_with_unsure",
      },
      {
        id: "se-empathy",
        sectionKey: "social_emotional",
        text: "Shows empathy when someone else is upset.",
        type: "likert5_with_unsure",
      },
      {
        id: "se-transitions",
        sectionKey: "social_emotional",
        text: "Handles transitions between activities.",
        type: "likert5_with_unsure",
      },
      {
        id: "se-loses-game",
        sectionKey: "social_emotional",
        text: 'Copes with losing a game or being told "no".',
        type: "likert5_with_unsure",
      },
      {
        id: "se-open",
        sectionKey: "social_emotional",
        text: "What are your biggest social or emotional concerns right now, if any? (optional)",
        type: "open_long",
      },
    ],
  },

  // ───── Section 4g — Cognitive / How they think ───────────────────────
  {
    key: "cognitive",
    number: 4,
    label: "How they think",
    shortLabel: "Cognitive",
    icon: "🧩",
    rationale:
      "Less about grade-level performance, more about the texture of their thinking — curiosity, memory, persistence.",
    estimatedMinutes: 3,
    questions: [
      {
        id: "cg-curious",
        sectionKey: "cognitive",
        text: "Curious — asks lots of questions.",
        type: "likert5_with_unsure",
      },
      {
        id: "cg-remembers",
        sectionKey: "cognitive",
        text: "Remembers things from a long time ago.",
        type: "likert5_with_unsure",
      },
      {
        id: "cg-patterns",
        sectionKey: "cognitive",
        text: "Notices patterns.",
        type: "likert5_with_unsure",
      },
      {
        id: "cg-problem-solves",
        sectionKey: "cognitive",
        text: "Problem-solves when things don't go as planned.",
        type: "likert5_with_unsure",
      },
      {
        id: "cg-sticks-with",
        sectionKey: "cognitive",
        text: "Sticks with tasks that are hard.",
        type: "likert5_with_unsure",
      },
      {
        id: "cg-imagines",
        sectionKey: "cognitive",
        text: "Pretends, imagines, or tells stories.",
        type: "likert5_with_unsure",
      },
      {
        id: "cg-cause-effect",
        sectionKey: "cognitive",
        text: "Understands cause and effect.",
        type: "likert5_with_unsure",
      },
      {
        id: "cg-surprised",
        sectionKey: "cognitive",
        text: "When has your child surprised you with how smart they are? (optional)",
        type: "open_long",
      },
    ],
  },

  // ───── Section 5 — Learning Style, School & Device Access ────────────
  {
    key: "learning",
    number: 5,
    label: "How they learn best",
    shortLabel: "Learning",
    icon: "🎒",
    rationale:
      "How and where your child learns now — and how they actually use a device — so we can shape the experience around them.",
    estimatedMinutes: 3,
    questions: [
      {
        id: "lr-school",
        sectionKey: "learning",
        text: "Current school setting",
        type: "single_select",
        options: [
          "Public school",
          "Private school",
          "Homeschool",
          "Microschool",
          "Not in school",
          "Other",
        ],
        allowOther: true,
      },
      {
        id: "lr-grade",
        sectionKey: "learning",
        text: "Grade level",
        type: "single_select",
        options: [
          "Pre-K",
          "K",
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "Post-12 / Other",
        ],
      },
      {
        id: "lr-iep",
        sectionKey: "learning",
        text: "Currently has an IEP, 504, or ILP?",
        type: "single_select",
        options: [
          "No",
          "Yes — IEP",
          "Yes — 504",
          "Yes — ILP",
          "Currently being evaluated",
          "Not sure",
        ],
      },
      {
        id: "lr-best-modes",
        sectionKey: "learning",
        text: "How does your child learn best?",
        type: "multi_select",
        options: [
          "Watching",
          "Doing / hands-on",
          "Reading",
          "Listening",
          "Talking it through",
          "Teaching someone else",
          "Moving while learning",
          "Working alone",
          "Working with others",
        ],
      },
      {
        // Compat: COMPAT_IDS.attentionSpan (ls-3) — bucketed minutes.
        id: "ls-3",
        sectionKey: "learning",
        text: "Roughly how long can your child focus on something they don't love?",
        type: "single_select",
        options: [
          "Under 5 minutes",
          "5–10 minutes",
          "10–20 minutes",
          "20–30 minutes",
          "30+ minutes",
          "Varies a lot day-to-day",
        ],
      },
      {
        id: "lr-sharpest",
        sectionKey: "learning",
        text: "When are they sharpest?",
        type: "single_select",
        options: [
          "Early morning",
          "Late morning",
          "Early afternoon",
          "Late afternoon",
          "Evening",
          "Varies",
        ],
      },
      {
        id: "lr-breakdown",
        sectionKey: "learning",
        text: "Where does learning tend to break down for them? (optional)",
        type: "open_long",
      },
      // ─── Device-access mini-block (feeds compat fields) ───
      {
        // Compat: COMPAT_IDS.deviceInteraction (im-1)
        id: "im-1",
        sectionKey: "learning",
        text: "How does your child use a tablet, phone, or computer?",
        type: "single_select",
        options: [
          "Standard touch / mouse — no adaptations",
          "Needs larger touch targets / buttons",
          "With occasional guidance from an adult",
          "Switch access (single switch)",
          "Switch access (two switches)",
          "Eye gaze / eye tracking",
          "Head tracking",
          "Voice control",
          "An adult operates the device based on their cues",
        ],
      },
      {
        // Compat: COMPAT_IDS.responseMethod (fl-4)
        id: "fl-4",
        sectionKey: "learning",
        text: "How does your child usually answer questions or make choices?",
        type: "single_select",
        options: [
          "Speaks the answer clearly",
          "Uses short words or phrases",
          "Points to or touches choices",
          "Uses a communication device or pictures",
          "Looks toward / gazes at choices",
          "An adult interprets their response",
          "Doesn't consistently respond yet",
        ],
      },
    ],
  },

  // ───── Section 6 — Parent Priorities & Goals ─────────────────────────
  {
    key: "priorities",
    number: 6,
    label: "What matters most",
    shortLabel: "Priorities",
    icon: "🧭",
    rationale:
      "After 20 minutes of reflecting on your child, this hits different. Tell us what you actually want from us — we'll prioritize accordingly.",
    estimatedMinutes: 3,
    questions: [
      {
        id: "pr-one-thing",
        sectionKey: "priorities",
        text: "If aivo could help with ONE thing in the next 3 months, what would it be?",
        type: "open_long",
      },
      {
        id: "pr-rank",
        sectionKey: "priorities",
        text: "Pick your top 3 priorities (drag to reorder)",
        type: "rank_top_three",
        options: [
          "Academic skills",
          "Confidence",
          "Social skills",
          "Independence",
          "Emotional regulation",
          "Communication",
          "Motor skills",
          "Focus / attention",
          "Creativity",
          "Specific interest exploration",
          "Family harmony",
        ],
      },
      {
        id: "pr-success",
        sectionKey: "priorities",
        text: "What does success look like for your child a year from now? (optional)",
        type: "open_long",
      },
      {
        id: "pr-worry",
        sectionKey: "priorities",
        text: "What do you worry about? (optional)",
        type: "open_long",
      },
      {
        id: "pr-hopeful",
        sectionKey: "priorities",
        text: "What are you hopeful about? (optional)",
        type: "open_long",
      },
    ],
  },

  // ───── Section 7 — Wrap-up & Next Steps ──────────────────────────────
  {
    key: "wrap_up",
    number: 7,
    label: "Last thoughts",
    shortLabel: "Wrap-up",
    icon: "🎁",
    rationale:
      "We'll turn your answers into a baseline profile you can review and edit anytime. One last open question — most parents put their best insight here.",
    estimatedMinutes: 1,
    isSpecial: true,
    questions: [
      {
        id: "wu-anything-missed",
        sectionKey: "wrap_up",
        text: "Anything we should know that we didn't ask about?",
        type: "open_long",
        helpText:
          "This box consistently surfaces the most useful insights — even one sentence helps.",
      },
      {
        id: "wu-coparent",
        sectionKey: "wrap_up",
        text: "Invite a co-parent or teacher to add their perspective?",
        type: "single_select",
        options: ["Yes — send me a link", "Maybe later", "No, just me"],
      },
    ],
  },
];

/** Real (non-special) sections — the ones whose questions count toward
 *  progress. Section 0 (welcome consent) and Section 7 (wrap-up) render as
 *  their own bespoke screens and are excluded from the denominator. */
export const REAL_SECTIONS = PARENT_ASSESSMENT_SECTIONS.filter((s) => !s.isSpecial);

/** Total questions across all real (non-special) sections — used as the
 *  denominator for the overall progress meter. Stays in sync with the
 *  numerator computed in the page (which also iterates REAL_SECTIONS only). */
export const TOTAL_QUESTIONS = REAL_SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);

// ─── Age-band derivation ───────────────────────────────────────────────────
/** Map a child's age in years to the framework's 4 age bands (§7).
 *  Returns null when DOB is unknown — callers should fall back to "show all". */
export function ageToBand(ageYears: number): AgeBand | null {
  if (!Number.isFinite(ageYears) || ageYears < 0) return null;
  if (ageYears < 5) return "2-4";
  if (ageYears < 9) return "5-8";
  if (ageYears < 13) return "9-12";
  return "13+";
}

/** Compute current age band from an ISO date string (YYYY-MM-DD). */
export function bandFromDob(dobIso: string | null | undefined): AgeBand | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years -= 1;
  return ageToBand(years);
}

/** True when a question should be visible for the given band. When the band
 *  is unknown (parent hasn't entered DOB yet) we show all questions — the
 *  framework's "don't hide things from someone who hasn't told us their age yet"
 *  default. */
export function isQuestionVisible(q: AssessmentQuestion, band: AgeBand | null): boolean {
  if (!q.ageBands || q.ageBands.length === 0) return true;
  if (band === null) return true;
  return q.ageBands.includes(band);
}

// ─── Backwards-compat alias (other code may still import the old name) ──
export const PARENT_ASSESSMENT_CATEGORIES = PARENT_ASSESSMENT_SECTIONS;
