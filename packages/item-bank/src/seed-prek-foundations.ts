import type { Item, ItemVariant } from "./types.js";

const PUBLISHED = "2026-06-06T00:00:00Z";

const FOUNDATIONS = {
  math: ["prek.math.notice-quantity", "Which group shows one?", ["One star", "Three stars"], "One star"],
  ela: ["prek.ela.listen-respond", "The story says the bear is sleepy. How does the bear feel?", ["Sleepy", "Hungry"], "Sleepy"],
  writing: ["prek.writing.make-a-mark", "Which choice can share an idea?", ["A drawing", "A blank page"], "A drawing"],
  science: ["prek.science.observe", "Which sense helps you notice a flower's color?", ["Sight", "Hearing"], "Sight"],
  sel: ["prek.sel.name-feeling", "Which face looks happy?", ["Smiling face", "Frowning face"], "Smiling face"],
  speech: ["prek.speech.take-turn", "What can you do when it is your communication turn?", ["Use a word, sign, sound, or AAC", "Walk away without responding"], "Use a word, sign, sound, or AAC"],
  executive_function: ["prek.executive-function.follow-routine", "What comes after wash hands?", ["Dry hands", "Put hands in paint"], "Dry hands"],
  life_skills: ["prek.life-skills.make-choice", "Which choice can you make at snack time?", ["Choose apple or banana", "Choose the weather"], "Choose apple or banana"],
  creative_arts: ["prek.creative-arts.explore-material", "Which action explores art materials?", ["Mix two colors", "Hide every crayon"], "Mix two colors"],
  social_studies: ["prek.social-studies.community-role", "Who helps put out fires?", ["Firefighter", "Astronaut"], "Firefighter"],
  world_languages: ["prek.world-languages.greeting", "Which word is a Spanish greeting?", ["hola", "libro"], "hola"],
  coding: ["prek.coding.sequence", "Which comes first when getting ready?", ["Put on socks", "Put shoes over bare feet"], "Put on socks"],
  geography: ["prek.geography.place", "Which place is for books and stories?", ["Library", "Swimming pool"], "Library"],
  music: ["prek.music.keep-beat", "Which action can keep a steady beat?", ["Clap, clap, clap", "Clap, wait, spin randomly"], "Clap, clap, clap"],
  pe_health: ["prek.pe-health.move-safely", "How can you move safely indoors?", ["Watch your space", "Run into people"], "Watch your space"],
  stem_engineering: ["prek.stem-engineering.build-test", "What can you do after building a block tower?", ["Try it and see if it stands", "Never look at it"], "Try it and see if it stands"],
} as const;

export type PreKSubject = keyof typeof FOUNDATIONS;

function makePreKItem(subject: PreKSubject): Item {
  const [skillId, stem, choices, correctAnswer] = FOUNDATIONS[subject];
  const id = `${subject}.PRE_K.foundation.01`;
  const variant: ItemVariant = {
    id: `${id}@1.0.0`,
    itemId: id,
    version: "1.0.0",
    status: "active",
    cohortWeight: 1,
    publishedAt: PUBLISHED,
    body: { stem, choices: [...choices], correctAnswer },
    defectCount: 0,
    surfaceType: "choice_grid",
  };
  return {
    id,
    skillId,
    authoringMeta: {
      source: "AIVO PRE-K domain foundations",
      reviewStatus: "pending-human-review",
    },
    variants: [variant],
  };
}

export const PREK_FOUNDATION_ITEMS: Record<PreKSubject, readonly Item[]> = {
  math: [makePreKItem("math")],
  ela: [makePreKItem("ela")],
  writing: [makePreKItem("writing")],
  science: [makePreKItem("science")],
  sel: [makePreKItem("sel")],
  speech: [makePreKItem("speech")],
  executive_function: [makePreKItem("executive_function")],
  life_skills: [makePreKItem("life_skills")],
  creative_arts: [makePreKItem("creative_arts")],
  social_studies: [makePreKItem("social_studies")],
  world_languages: [makePreKItem("world_languages")],
  coding: [makePreKItem("coding")],
  geography: [makePreKItem("geography")],
  music: [makePreKItem("music")],
  pe_health: [makePreKItem("pe_health")],
  stem_engineering: [makePreKItem("stem_engineering")],
};
