/**
 * ELA / Reading item bank — production seed (Sprint 2).
 *
 * Items reference skillIds whose substring matches `ela|reading`, so the
 * coverage scanner attributes every item to `ela`. Items are direct
 * object literals so the audit's `{ id ... skillId }` regex matches.
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

export const ELA_PRODUCTION_ITEMS: readonly Item[] = [
  // Kindergarten
  {
    id: "ela.k.rf.1.print-direction",
    skillId: "ccss-ela.K.RF.1",
    variants: v(
      "ela.k.rf.1.print-direction",
      {
        stem: "Where do you start reading a page of English?",
        choices: ["Top left", "Top right", "Bottom left", "Bottom right"],
        correctAnswer: "Top left",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.k.rf.3.letter-sound",
    skillId: "ccss-ela.K.RF.3",
    variants: v(
      "ela.k.rf.3.letter-sound",
      {
        stem: "Which letter makes the /m/ sound at the start of 'milk'?",
        choices: ["m", "k", "l", "i"],
        correctAnswer: "m",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.k.rl.1.story-question",
    skillId: "ccss-ela.K.RL.1",
    variants: v(
      "ela.k.rl.1.story-question",
      {
        stem: "Story: 'The cat sat on the mat.' Where did the cat sit?",
        correctAnswer: "On the mat",
      },
      "math_expression",
    ),
  },

  // Grade 1
  {
    id: "ela.1.rf.3.decode-cvc",
    skillId: "ccss-ela.1.RF.3",
    variants: v(
      "ela.1.rf.3.decode-cvc",
      { stem: "Read the word: 'cup'. How many sounds does it have?", correctAnswer: "3" },
      "math_expression",
    ),
  },
  {
    id: "ela.1.rl.2.retell",
    skillId: "ccss-ela.1.RL.2",
    variants: v(
      "ela.1.rl.2.retell",
      {
        stem: "Story: 'A dog chased a ball. The ball rolled away. The dog ran fast and caught it.' What happens first?",
        choices: ["The dog catches the ball", "A dog chases a ball", "The ball rolled away"],
        correctAnswer: "A dog chases a ball",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.1.l.1.complete-sentence",
    skillId: "ccss-ela.1.L.1",
    variants: v(
      "ela.1.l.1.complete-sentence",
      {
        stem: "Which is a complete sentence?",
        choices: ["Running fast.", "She runs fast.", "Fast and tall."],
        correctAnswer: "She runs fast.",
      },
      "choice_grid",
    ),
  },

  // Grade 2
  {
    id: "ela.2.rf.4.fluency",
    skillId: "ccss-ela.2.RF.4",
    variants: v(
      "ela.2.rf.4.fluency",
      {
        stem: "Pick the missing word: 'The sun is ___ in the sky.'",
        choices: ["bright", "hat", "river"],
        correctAnswer: "bright",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.2.ri.2.main-topic",
    skillId: "ccss-ela.2.RI.2",
    variants: v(
      "ela.2.ri.2.main-topic",
      {
        stem: "Text: 'Bees live in hives. They make honey. They help flowers grow.' What is the main topic?",
        choices: ["Hives", "Bees", "Flowers"],
        correctAnswer: "Bees",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.2.l.4.context-clues",
    skillId: "ccss-ela.2.L.4",
    variants: v(
      "ela.2.l.4.context-clues",
      {
        stem: "'The trail was so muddy our boots got dirty.' What does 'muddy' mean?",
        choices: ["Full of wet dirt", "Sunny", "Cold"],
        correctAnswer: "Full of wet dirt",
      },
      "choice_grid",
    ),
  },

  // Grade 3
  {
    id: "ela.3.rl.2.central-message",
    skillId: "ccss-ela.3.RL.2",
    variants: v(
      "ela.3.rl.2.central-message",
      {
        stem: "Fable: 'The tortoise wins the race because he keeps going while the hare naps.' What is the lesson?",
        choices: ["Speed matters most", "Slow and steady wins the race", "Never race"],
        correctAnswer: "Slow and steady wins the race",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.3.ri.7.use-illustrations",
    skillId: "ccss-ela.3.RI.7",
    variants: v(
      "ela.3.ri.7.use-illustrations",
      {
        stem: "A diagram labels a bee's body parts. Where would you look to find the name of the middle section?",
        choices: ["The picture's labels", "The page number", "The cover"],
        correctAnswer: "The picture's labels",
      },
      "choice_grid",
    ),
  },

  // Grade 4
  {
    id: "ela.4.rl.3.character-detail",
    skillId: "ccss-ela.4.RL.3",
    variants: v(
      "ela.4.rl.3.character-detail",
      {
        stem: "From 'Maya stomped into the room and slammed her book down,' which word best describes Maya?",
        choices: ["Calm", "Angry", "Sleepy"],
        correctAnswer: "Angry",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.4.ri.2.main-idea-detail",
    skillId: "ccss-ela.4.RI.2",
    variants: v(
      "ela.4.ri.2.main-idea-detail",
      {
        stem: "An article on coral reefs starts: 'Coral reefs are home to thousands of species.' Which detail best supports the main idea?",
        choices: [
          "Coral reefs cover less than 1% of the ocean floor",
          "Over 4,000 fish species live in reefs",
          "Reefs are found in tropical seas",
        ],
        correctAnswer: "Over 4,000 fish species live in reefs",
      },
      "choice_grid",
    ),
  },

  // Grade 5
  {
    id: "ela.5.rl.6.point-of-view",
    skillId: "ccss-ela.5.RL.6",
    variants: v(
      "ela.5.rl.6.point-of-view",
      {
        stem: "A story uses the word 'I' throughout. The story is told from which point of view?",
        choices: ["First person", "Second person", "Third person"],
        correctAnswer: "First person",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.5.l.5.figurative",
    skillId: "ccss-ela.5.L.5",
    variants: v(
      "ela.5.l.5.figurative",
      {
        stem: "'Her smile was sunshine.' This is an example of a ___.",
        choices: ["Metaphor", "Idiom", "Pun"],
        correctAnswer: "Metaphor",
      },
      "choice_grid",
    ),
  },

  // Grade 6
  {
    id: "ela.6.ri.6.author-purpose",
    skillId: "ccss-ela.6.RI.6",
    variants: v(
      "ela.6.ri.6.author-purpose",
      {
        stem: "An author writes a persuasive article about recycling. Their main purpose is to ___.",
        choices: ["Entertain", "Persuade", "Describe a memory"],
        correctAnswer: "Persuade",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.6.rl.4.word-choice",
    skillId: "ccss-ela.6.RL.4",
    variants: v(
      "ela.6.rl.4.word-choice",
      {
        stem: "Which word choice creates the most tense mood: 'She walked into the ___ house.'",
        choices: ["bright", "cosy", "creaking"],
        correctAnswer: "creaking",
      },
      "choice_grid",
    ),
  },

  // Grade 7
  {
    id: "ela.7.ri.8.evaluate-argument",
    skillId: "ccss-ela.7.RI.8",
    variants: v(
      "ela.7.ri.8.evaluate-argument",
      {
        stem: "Which is the strongest support for 'school lunches should include more vegetables'?",
        choices: [
          "A poll of 12 kids who like vegetables",
          "A nutritionist's research on student energy levels",
          "The author's personal favourite recipes",
        ],
        correctAnswer: "A nutritionist's research on student energy levels",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.7.sl.4.present-claim",
    skillId: "ccss-ela.7.SL.4",
    variants: v(
      "ela.7.sl.4.present-claim",
      {
        stem: "When giving a class presentation, what should you do first?",
        choices: [
          "State the main claim",
          "Tell a long unrelated story",
          "Read every slide word-for-word",
        ],
        correctAnswer: "State the main claim",
      },
      "choice_grid",
    ),
  },

  // Grade 8
  {
    id: "ela.8.rl.5.compare-structure",
    skillId: "ccss-ela.8.RL.5",
    variants: v(
      "ela.8.rl.5.compare-structure",
      {
        stem: "Two stories tell the same event — one in chronological order, one as a flashback. Which structure builds more suspense at the start?",
        choices: ["Chronological", "Flashback"],
        correctAnswer: "Flashback",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.8.ri.9.conflicting-sources",
    skillId: "ccss-ela.8.RI.9",
    variants: v(
      "ela.8.ri.9.conflicting-sources",
      {
        stem: "Two articles disagree about whether a new park should be built. What is the best next step for the reader?",
        choices: [
          "Pick the longer article",
          "Compare the evidence each presents",
          "Believe the first one read",
        ],
        correctAnswer: "Compare the evidence each presents",
      },
      "choice_grid",
    ),
  },
  {
    id: "ela.8.vocab.tenacity",
    skillId: "ccss-ela.8.RL.5",
    variants: v(
      "ela.8.vocab.tenacity",
      {
        stem: "'The athlete's tenacity helped her finish the marathon.' What does 'tenacity' most likely mean?",
        choices: ["Determination", "Speed", "Luck"],
        correctAnswer: "Determination",
      },
      "choice_grid",
    ),
  },
  // ---- Sprint 09: grade 1-2 depth (pack-aligned) ----
  {
    id: "ela.1.rf.3.digraph-chair",
    skillId: "ccss-ela.1.RF.3",
    variants: [
      {
        id: "ela.1.rf.3.digraph-chair@1.0.0",
        itemId: "ela.1.rf.3.digraph-chair",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: 'Which word starts like "chair"?', correctAnswer: "cheese", choices: ["cheese", "car", "shoe"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "ela.1.l.1.verb-agreement",
    skillId: "ccss-ela.1.L.1",
    variants: [
      {
        id: "ela.1.l.1.verb-agreement@1.0.0",
        itemId: "ela.1.l.1.verb-agreement",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Which sentence is correct?", correctAnswer: "The dogs run fast.", choices: ["The dogs run fast.", "The dogs runs fast.", "The dogs running."] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "ela.2.l.4.prefix-rewrite",
    skillId: "ccss-ela.2.L.4",
    variants: [
      {
        id: "ela.2.l.4.prefix-rewrite@1.0.0",
        itemId: "ela.2.l.4.prefix-rewrite",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: 'What does "rewrite" mean?', correctAnswer: "Write again", choices: ["Write again", "Write before", "Never write"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "ela.2.ri.2.bees-main-idea",
    skillId: "ccss-ela.2.RI.2",
    variants: [
      {
        id: "ela.2.ri.2.bees-main-idea@1.0.0",
        itemId: "ela.2.ri.2.bees-main-idea",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Bees carry pollen between flowers, helping plants grow. What is the text mostly about?", correctAnswer: "How bees help plants", choices: ["How bees help plants", "What flowers smell like", "Where bees sleep"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
];
