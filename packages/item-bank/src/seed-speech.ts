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
];
