/**
 * Speech & Language item bank — baseline fallback seed (Sprint 3).
 *
 * Items target phonological awareness, vocabulary, grammar, pragmatic
 * language, and comprehension. Skill IDs use the `speech|asha` prefix
 * so the coverage scanner attributes every item to speech.
 *
 * Items are multiple choice (no audio playback required) so they work
 * in the baseline fallback path without an audio asset pipeline.
 */
import type { Item, ItemVariant } from "./types.js";

const PUBLISHED = "2026-05-25T00:00:00Z";

function v(
  itemId: string,
  body: Record<string, unknown>,
  surfaceType: NonNullable<ItemVariant["surfaceType"]> = "choice_grid",
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

export const SPEECH_PRODUCTION_ITEMS: readonly Item[] = [
  // K-2 — phonological awareness, basic vocab + grammar
  {
    id: "speech.k.pa.1.first-sound",
    skillId: "asha.speech.K.phonological-awareness.1",
    variants: v("speech.k.pa.1.first-sound", {
      stem: "Which word starts with the same sound as 'cat'?",
      choices: ["car", "ball", "fish"],
      correctAnswer: "car",
    }),
  },
  {
    id: "speech.k.pa.2.rhyme",
    skillId: "asha.speech.K.phonological-awareness.2",
    variants: v("speech.k.pa.2.rhyme", {
      stem: "Which word rhymes with 'cat'?",
      choices: ["hat", "dog", "shoe"],
      correctAnswer: "hat",
    }),
  },
  {
    id: "speech.k.voc.1.animal",
    skillId: "asha.speech.K.vocabulary.1",
    variants: v("speech.k.voc.1.animal", {
      stem: "Which one is a kind of animal?",
      choices: ["Dog", "Chair", "Cup"],
      correctAnswer: "Dog",
    }),
  },
  {
    id: "speech.1.gram.1.plural",
    skillId: "asha.speech.1.grammar.1",
    variants: v("speech.1.gram.1.plural", {
      stem: "More than one 'cat' is:",
      choices: ["cats", "cat", "cates"],
      correctAnswer: "cats",
    }),
  },
  {
    id: "speech.1.pa.1.syllables",
    skillId: "asha.speech.1.phonological-awareness.1",
    variants: v("speech.1.pa.1.syllables", {
      stem: "How many syllables are in the word 'butterfly'?",
      choices: ["3", "1", "2"],
      correctAnswer: "3",
    }),
  },
  {
    id: "speech.2.voc.1.opposite",
    skillId: "asha.speech.2.vocabulary.1",
    variants: v("speech.2.voc.1.opposite", {
      stem: "Which word is the opposite of 'hot'?",
      choices: ["cold", "warm", "wet"],
      correctAnswer: "cold",
    }),
  },
  {
    id: "speech.2.prag.1.greet",
    skillId: "asha.speech.2.pragmatics.1",
    variants: v("speech.2.prag.1.greet", {
      stem: "Which is the right thing to say when a friend arrives at your house?",
      choices: ["'Hi! Come in.'", "'Go away.'", "Nothing — turn around"],
      correctAnswer: "'Hi! Come in.'",
    }),
  },

  // 3-5 — comprehension, multi-meaning words, pragmatic inference
  {
    id: "speech.3.voc.1.multi-meaning",
    skillId: "asha.speech.3.vocabulary.1",
    variants: v("speech.3.voc.1.multi-meaning", {
      stem: "In 'She had to bat the fly away,' what does 'bat' mean?",
      choices: ["Swing at", "Sleep", "An animal"],
      correctAnswer: "Swing at",
    }),
  },
  {
    id: "speech.3.gram.1.verb-tense",
    skillId: "asha.speech.3.grammar.1",
    variants: v("speech.3.gram.1.verb-tense", {
      stem: "Pick the correct past tense: 'Yesterday I ___ to the park.'",
      choices: ["went", "go", "going"],
      correctAnswer: "went",
    }),
  },
  {
    id: "speech.3.comp.1.main-idea",
    skillId: "asha.speech.3.comprehension.1",
    variants: v("speech.3.comp.1.main-idea", {
      stem: "Story: 'Lina lost her dog, looked all night, and found him asleep under her porch.' What is the main idea?",
      choices: ["Lina finds her lost dog", "Lina hates her porch", "Dogs are good"],
      correctAnswer: "Lina finds her lost dog",
    }),
  },
  {
    id: "speech.4.prag.1.tone",
    skillId: "asha.speech.4.pragmatics.1",
    variants: v("speech.4.prag.1.tone", {
      stem: "A friend says 'Nice job…' very slowly with a frown. They probably:",
      choices: ["Mean the opposite (sarcasm)", "Are really proud", "Didn't see your work"],
      correctAnswer: "Mean the opposite (sarcasm)",
    }),
  },
  {
    id: "speech.4.voc.1.context",
    skillId: "asha.speech.4.vocabulary.1",
    variants: v("speech.4.voc.1.context", {
      stem: "'The trail was treacherous after the storm.' What does 'treacherous' mean?",
      choices: ["Dangerous", "Beautiful", "Boring"],
      correctAnswer: "Dangerous",
    }),
  },
  {
    id: "speech.5.gram.1.subject-verb",
    skillId: "asha.speech.5.grammar.1",
    variants: v("speech.5.gram.1.subject-verb", {
      stem: "Pick the correct sentence:",
      choices: ["The dogs run fast.", "The dogs runs fast.", "The dog run fast."],
      correctAnswer: "The dogs run fast.",
    }),
  },
  {
    id: "speech.5.comp.1.infer",
    skillId: "asha.speech.5.comprehension.1",
    variants: v("speech.5.comp.1.infer", {
      stem: "Story: 'Sam's hair was dripping. He set down a wet umbrella.' What can we infer?",
      choices: ["It was raining", "Sam took a shower", "Sam went swimming"],
      correctAnswer: "It was raining",
    }),
  },

  // 6-8 — figurative language, advanced pragmatics, syntax
  {
    id: "speech.6.fig.1.idiom",
    skillId: "asha.speech.6.figurative-language.1",
    variants: v("speech.6.fig.1.idiom", {
      stem: "What does 'It's raining cats and dogs' mean?",
      choices: ["It's raining very hard", "Animals fall from the sky", "It's a sunny day"],
      correctAnswer: "It's raining very hard",
    }),
  },
  {
    id: "speech.6.prag.1.repair",
    skillId: "asha.speech.6.pragmatics.1",
    variants: v("speech.6.prag.1.repair", {
      stem: "You said something that hurt a friend's feelings. The best repair is:",
      choices: ["A sincere apology", "Pretend it didn't happen", "Blame them for being sensitive"],
      correctAnswer: "A sincere apology",
    }),
  },
  {
    id: "speech.7.fig.1.metaphor",
    skillId: "asha.speech.7.figurative-language.1",
    variants: v("speech.7.fig.1.metaphor", {
      stem: "'Her voice was music.' This is an example of:",
      choices: ["A metaphor", "A literal description", "A question"],
      correctAnswer: "A metaphor",
    }),
  },
  {
    id: "speech.7.voc.1.root",
    skillId: "asha.speech.7.vocabulary.1",
    variants: v("speech.7.voc.1.root", {
      stem: "The root 'bio' means:",
      choices: ["life", "earth", "water"],
      correctAnswer: "life",
    }),
  },
  {
    id: "speech.7.gram.1.complex",
    skillId: "asha.speech.7.grammar.1",
    variants: v("speech.7.gram.1.complex", {
      stem: "Which is a complex sentence (one independent + one dependent clause)?",
      choices: ["Although it was late, she kept reading.", "She kept reading.", "Late and tired."],
      correctAnswer: "Although it was late, she kept reading.",
    }),
  },
  {
    id: "speech.8.prag.1.audience",
    skillId: "asha.speech.8.pragmatics.1",
    variants: v("speech.8.prag.1.audience", {
      stem: "How you speak to a principal is usually DIFFERENT from how you speak to a friend because:",
      choices: [
        "Audience and setting change tone",
        "Principals don't understand kids",
        "Friends never listen",
      ],
      correctAnswer: "Audience and setting change tone",
    }),
  },
  {
    id: "speech.8.fig.1.simile",
    skillId: "asha.speech.8.figurative-language.1",
    variants: v("speech.8.fig.1.simile", {
      stem: "'He runs like the wind.' This figure of speech is a:",
      choices: ["Simile", "Metaphor", "Idiom"],
      correctAnswer: "Simile",
    }),
  },
  // ---- Echo K-12 (owner directive): per-band depth through grade 12 ----
  {
    id: "speech.1.blends.initial",
    skillId: "asha.speech.1.blends.1",
    variants: [
      {
        id: "speech.1.blends.initial@1.0.0",
        itemId: "speech.1.blends.initial",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Which word starts with the \"st\" blend?", correctAnswer: "stop", choices: ["stop", "sock", "top"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.2.multisyllable.clap",
    skillId: "asha.speech.2.syllables.1",
    variants: [
      {
        id: "speech.2.multisyllable.clap@1.0.0",
        itemId: "speech.2.multisyllable.clap",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "How many syllables are in \"umbrella\"?", correctAnswer: "3", choices: ["2", "3", "4"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.4.idiom.cold-feet",
    skillId: "asha.speech.4.figurative.1",
    variants: [
      {
        id: "speech.4.idiom.cold-feet@1.0.0",
        itemId: "speech.4.idiom.cold-feet",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "\"Getting cold feet\" before a recital means\u2026", correctAnswer: "Feeling nervous about performing", choices: ["Feeling nervous about performing", "Having frozen toes", "Wearing no shoes"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.5.inference.tone",
    skillId: "asha.speech.5.pragmatics.1",
    variants: [
      {
        id: "speech.5.inference.tone@1.0.0",
        itemId: "speech.5.inference.tone",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Your friend says \"GREAT.\" with a flat voice and a sigh. They probably feel\u2026", correctAnswer: "Unenthusiastic", choices: ["Unenthusiastic", "Thrilled", "Confused about the word"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.6.shades.intensity",
    skillId: "asha.speech.6.vocabulary.1",
    variants: [
      {
        id: "speech.6.shades.intensity@1.0.0",
        itemId: "speech.6.shades.intensity",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Order matters: which word is STRONGEST?", correctAnswer: "furious", choices: ["annoyed", "angry", "furious"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.8.persuasion.appeal",
    skillId: "asha.speech.8.discourse.1",
    variants: [
      {
        id: "speech.8.persuasion.appeal@1.0.0",
        itemId: "speech.8.persuasion.appeal",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "A persuasive speech is strongest when it pairs a claim with\u2026", correctAnswer: "Evidence the audience cares about", choices: ["Evidence the audience cares about", "A louder voice only", "More slides"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.9.audience.register",
    skillId: "asha.speech.9.audience.1",
    variants: [
      {
        id: "speech.9.audience.register@1.0.0",
        itemId: "speech.9.audience.register",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Presenting to the school board, the right register is\u2026", correctAnswer: "Formal and concise", choices: ["Formal and concise", "Slang-heavy", "Whispered"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.9.audience.opening",
    skillId: "asha.speech.9.audience.2",
    variants: [
      {
        id: "speech.9.audience.opening@1.0.0",
        itemId: "speech.9.audience.opening",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "The strongest OPENING for a persuasive talk is\u2026", correctAnswer: "A hook that connects the topic to the audience", choices: ["A hook that connects the topic to the audience", "An apology", "Reading the title slide"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.9.discourse.transitions",
    skillId: "asha.speech.9.discourse.3",
    variants: [
      {
        id: "speech.9.discourse.transitions@1.0.0",
        itemId: "speech.9.discourse.transitions",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Which transition signals a CONTRAST?", correctAnswer: "However", choices: ["However", "Furthermore", "For example"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.10.discourse.structure",
    skillId: "asha.speech.10.discourse.1",
    variants: [
      {
        id: "speech.10.discourse.structure@1.0.0",
        itemId: "speech.10.discourse.structure",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "In an argument speech, a counterclaim belongs\u2026", correctAnswer: "Acknowledged and answered before the conclusion", choices: ["Acknowledged and answered before the conclusion", "Hidden", "After the applause"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.10.discourse.cohesion",
    skillId: "asha.speech.10.cohesion.2",
    variants: [
      {
        id: "speech.10.discourse.cohesion@1.0.0",
        itemId: "speech.10.discourse.cohesion",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Repeating a key phrase across sections of a speech builds\u2026", correctAnswer: "Cohesion", choices: ["Cohesion", "Confusion", "Volume"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.10.pragmatics.feedback",
    skillId: "asha.speech.10.pragmatics.3",
    variants: [
      {
        id: "speech.10.pragmatics.feedback@1.0.0",
        itemId: "speech.10.pragmatics.feedback",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Your practice audience looks lost mid-talk. The skilled move is\u2026", correctAnswer: "Pause and restate the main point simply", choices: ["Pause and restate the main point simply", "Speed up", "Skip to the end"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.11.self-advocacy.accommodation",
    skillId: "asha.speech.11.advocacy.1",
    variants: [
      {
        id: "speech.11.self-advocacy.accommodation@1.0.0",
        itemId: "speech.11.self-advocacy.accommodation",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "You process spoken directions slowly. An effective self-advocacy request is\u2026", correctAnswer: "Could you give the directions in writing as well?", choices: ["Could you give the directions in writing as well?", "Say nothing", "Leave the room"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.11.self-advocacy.clarify",
    skillId: "asha.speech.11.advocacy.2",
    variants: [
      {
        id: "speech.11.self-advocacy.clarify@1.0.0",
        itemId: "speech.11.self-advocacy.clarify",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "In a fast group discussion, a strong clarifying move is\u2026", correctAnswer: "Can we pause \u2014 I want to make sure I understood the last point", choices: ["Can we pause \u2014 I want to make sure I understood the last point", "Pretend to follow", "Change topic"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.11.discourse.evidence",
    skillId: "asha.speech.11.discourse.3",
    variants: [
      {
        id: "speech.11.discourse.evidence@1.0.0",
        itemId: "speech.11.discourse.evidence",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Citing WHERE your facts come from makes a speech more\u2026", correctAnswer: "Credible", choices: ["Credible", "Longer", "Quieter"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.12.professional.interview",
    skillId: "asha.speech.12.professional.1",
    variants: [
      {
        id: "speech.12.professional.interview@1.0.0",
        itemId: "speech.12.professional.interview",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "A strong answer to \"tell me about yourself\" in an interview\u2026", correctAnswer: "Connects your experience to the role in under a minute", choices: ["Connects your experience to the role in under a minute", "Recites your life story", "Is one word"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.12.professional.email-vs-talk",
    skillId: "asha.speech.12.professional.2",
    variants: [
      {
        id: "speech.12.professional.email-vs-talk@1.0.0",
        itemId: "speech.12.professional.email-vs-talk",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Complex, sensitive feedback for a teammate is best delivered\u2026", correctAnswer: "In a private conversation", choices: ["In a private conversation", "In a group chat", "On a poster"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "speech.12.professional.presentation",
    skillId: "asha.speech.12.professional.3",
    variants: [
      {
        id: "speech.12.professional.presentation@1.0.0",
        itemId: "speech.12.professional.presentation",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Closing a professional presentation, you should\u2026", correctAnswer: "Summarise the key takeaway and the next step", choices: ["Summarise the key takeaway and the next step", "Introduce five new topics", "Walk out silently"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
];
