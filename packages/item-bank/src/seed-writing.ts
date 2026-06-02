/**
 * Writing item bank — production seed (Sprint 2).
 *
 * Items reference skillIds whose substring matches `writing` so the
 * coverage scanner attributes every item to the `writing` subject.
 * Writing tasks default to short-text capture; production scoring is
 * rubric-based and lives in tutor-svc / assessment-svc — the items
 * here carry a placeholder rubric body so the surface renders an answer
 * box and the scorer can grade in a later pass.
 */
import type { Item, ItemVariant } from "./types.js";

const PUBLISHED = "2026-05-25T00:00:00Z";

function v(
  itemId: string,
  body: Record<string, unknown>,
  surfaceType: NonNullable<ItemVariant["surfaceType"]>,
): ItemVariant[] {
  return [
    {
      id: `${itemId}@1.0.0`,
      itemId,
      version: "1.0.0",
      status: "active",
      cohortWeight: 1,
      publishedAt: PUBLISHED,
      body,
      defectCount: 0,
      surfaceType,
    },
  ];
}

const DEFAULT_RUBRIC = {
  rubric: [
    { id: "purpose", description: "Addresses the prompt clearly.", weight: 0.4 },
    { id: "organization", description: "Ideas are organised logically.", weight: 0.3 },
    { id: "conventions", description: "Spelling, grammar, and punctuation.", weight: 0.3 },
  ],
};

export const WRITING_PRODUCTION_ITEMS: readonly Item[] = [
  // Kindergarten
  {
    id: "writing.k.w.1.opinion-book",
    skillId: "ccss-writing.K.W.1",
    variants: v(
      "writing.k.w.1.opinion-book",
      { stem: "Draw or write: What is your favourite book and why?", ...DEFAULT_RUBRIC },
      "scratchpad",
    ),
  },
  {
    id: "writing.k.w.3.event-tell",
    skillId: "ccss-writing.K.W.3",
    variants: v(
      "writing.k.w.3.event-tell",
      {
        stem: "Tell about something fun you did. Write or draw what happened first, next, last.",
        ...DEFAULT_RUBRIC,
      },
      "scratchpad",
    ),
  },

  // Grade 1
  {
    id: "writing.1.w.2.info-pet",
    skillId: "ccss-writing.1.W.2",
    variants: v(
      "writing.1.w.2.info-pet",
      {
        stem: "Write a few sentences telling facts about a pet (real or pretend).",
        ...DEFAULT_RUBRIC,
      },
      "math_expression",
    ),
  },
  {
    id: "writing.1.w.5.revise-help",
    skillId: "ccss-writing.1.W.5",
    variants: v(
      "writing.1.w.5.revise-help",
      {
        stem: "Read this sentence: 'I goed to the park.' Rewrite it correctly.",
        correctAnswer: "I went to the park.",
      },
      "math_expression",
    ),
  },

  // Grade 2
  {
    id: "writing.2.w.1.opinion-because",
    skillId: "ccss-writing.2.W.1",
    variants: v(
      "writing.2.w.1.opinion-because",
      {
        stem: "Should kids have homework? Write your opinion and use the word 'because'.",
        ...DEFAULT_RUBRIC,
      },
      "math_expression",
    ),
  },
  {
    id: "writing.2.w.3.narrative-bme",
    skillId: "ccss-writing.2.W.3",
    variants: v(
      "writing.2.w.3.narrative-bme",
      {
        stem: "Write a short story about a lost puppy. Include a beginning, middle, and end.",
        ...DEFAULT_RUBRIC,
      },
      "scratchpad",
    ),
  },

  // Grade 3
  {
    id: "writing.3.w.4.audience-task",
    skillId: "ccss-writing.3.W.4",
    variants: v(
      "writing.3.w.4.audience-task",
      { stem: "Write a thank-you note to a teacher who helped you this year.", ...DEFAULT_RUBRIC },
      "math_expression",
    ),
  },
  {
    id: "writing.3.spelling-friend",
    skillId: "ccss-writing.3.W.4",
    variants: v(
      "writing.3.spelling-friend",
      { stem: "Spell the word: f-r-i-e-n-d. (Type it.)", correctAnswer: "friend" },
      "math_expression",
    ),
  },

  // Grade 4
  {
    id: "writing.4.w.2.info-grouped",
    skillId: "ccss-writing.4.W.2",
    variants: v(
      "writing.4.w.2.info-grouped",
      {
        stem: "Write a short article about a planet. Group your facts (size, distance, atmosphere).",
        ...DEFAULT_RUBRIC,
      },
      "math_expression",
    ),
  },
  {
    id: "writing.4.w.5.revise-edit",
    skillId: "ccss-writing.4.W.5",
    variants: v(
      "writing.4.w.5.revise-edit",
      {
        stem: "Edit this sentence for clarity: 'me and my brother we runned fast and then jumped.'",
        correctAnswer: "My brother and I ran fast and then jumped.",
      },
      "math_expression",
    ),
  },

  // Grade 5
  {
    id: "writing.5.w.1.opinion-grouped",
    skillId: "ccss-writing.5.W.1",
    variants: v(
      "writing.5.w.1.opinion-grouped",
      {
        stem: "Argue for or against year-round school. Give two grouped reasons.",
        ...DEFAULT_RUBRIC,
      },
      "math_expression",
    ),
  },
  {
    id: "writing.5.linking-word",
    skillId: "ccss-writing.5.W.1",
    variants: v(
      "writing.5.linking-word",
      {
        stem: "Pick the best linking word: 'I like soccer; ___, I like reading too.'",
        choices: ["however", "because", "first"],
        correctAnswer: "however",
      },
      "choice_grid",
    ),
  },

  // Grade 6
  {
    id: "writing.6.w.2.informative",
    skillId: "ccss-writing.6.W.2",
    variants: v(
      "writing.6.w.2.informative",
      {
        stem: "Write two paragraphs explaining how a bicycle works. Include at least one fact and one definition.",
        ...DEFAULT_RUBRIC,
      },
      "math_expression",
    ),
  },
  {
    id: "writing.6.w.9.evidence-quote",
    skillId: "ccss-writing.6.W.9",
    variants: v(
      "writing.6.w.9.evidence-quote",
      {
        stem: "From the line 'The forest grew quiet as the storm approached,' which quote best shows tension?",
        choices: ["'The forest grew quiet'", "'as the storm approached'", "Both halves together"],
        correctAnswer: "Both halves together",
      },
      "choice_grid",
    ),
  },

  // Grade 7
  {
    id: "writing.7.w.1.argument-reasons",
    skillId: "ccss-writing.7.W.1",
    variants: v(
      "writing.7.w.1.argument-reasons",
      {
        stem: "Argue whether phones should be allowed in middle school. Give two reasons and address one counter-argument.",
        ...DEFAULT_RUBRIC,
      },
      "math_expression",
    ),
  },
  {
    id: "writing.7.thesis-strength",
    skillId: "ccss-writing.7.W.1",
    variants: v(
      "writing.7.thesis-strength",
      {
        stem: "Which is the strongest thesis statement?",
        choices: [
          "School lunches are okay.",
          "School lunches should include more fresh produce.",
          "School lunches exist.",
        ],
        correctAnswer: "School lunches should include more fresh produce.",
      },
      "choice_grid",
    ),
  },

  // Grade 8
  {
    id: "writing.8.w.4.coherent-style",
    skillId: "ccss-writing.8.W.4",
    variants: v(
      "writing.8.w.4.coherent-style",
      {
        stem: "Rewrite this informal sentence in a formal style: 'It's gonna be huge for the science team.'",
        correctAnswer: "This will be significant for the science team.",
      },
      "math_expression",
    ),
  },
  {
    id: "writing.8.w.5.revision-loop",
    skillId: "ccss-writing.8.W.5",
    variants: v(
      "writing.8.w.5.revision-loop",
      {
        stem: "After a first draft, the BEST next step is to ___.",
        choices: ["Publish it", "Read it aloud to catch unclear parts", "Throw it out"],
        correctAnswer: "Read it aloud to catch unclear parts",
      },
      "choice_grid",
    ),
  },
  {
    id: "writing.8.essay-conclusion",
    skillId: "ccss-writing.8.W.4",
    variants: v(
      "writing.8.essay-conclusion",
      {
        stem: "A strong essay conclusion should ___.",
        choices: [
          "Introduce new evidence",
          "Restate the thesis in a fresh way and close the argument",
          "Apologise for any mistakes",
        ],
        correctAnswer: "Restate the thesis in a fresh way and close the argument",
      },
      "choice_grid",
    ),
  },

  // Cross-grade craft items
  {
    id: "writing.craft.transition-words",
    skillId: "ccss-writing.3.W.4",
    variants: v(
      "writing.craft.transition-words",
      {
        stem: "Which transition word best signals 'in addition'?",
        choices: ["However", "Furthermore", "Although"],
        correctAnswer: "Furthermore",
      },
      "choice_grid",
    ),
  },
  {
    id: "writing.craft.audience-tone",
    skillId: "ccss-writing.5.W.1",
    variants: v(
      "writing.craft.audience-tone",
      {
        stem: "When writing for a kindergarten audience, the tone should be ___.",
        choices: ["Formal and technical", "Simple and friendly", "Sarcastic"],
        correctAnswer: "Simple and friendly",
      },
      "choice_grid",
    ),
  },
];
