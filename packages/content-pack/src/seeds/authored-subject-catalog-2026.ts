import type { ContentPack, GradeBand, Subject } from "../types.js";

type PackInput = {
  id: string;
  title: string;
  subject: Subject;
  gradeBand: GradeBand;
  skillGraphRef: string;
  skillIds: [string, string, string];
  prompts: [string, string, string];
};

function authoredPack(input: PackInput): ContentPack {
  const slug = input.id.replace(/-fall-2026$/, "");
  return {
    id: input.id,
    title: input.title,
    version: "1.0.0",
    schemaVersion: 1,
    subject: input.subject,
    gradeBand: input.gradeBand,
    skillGraphRefs: [input.skillGraphRef],
    publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
    license: "CC-BY-4.0",
    publishedAt: "2026-09-01T00:00:00Z",
    assets: [],
    activities: [
      {
        id: `${slug}-notice`,
        title: "Notice and connect",
        skillId: input.skillIds[0],
        type: "narration",
        prompt: input.prompts[0],
        difficulty: "intro",
      },
      {
        id: `${slug}-choose`,
        title: "Choose a strong next step",
        skillId: input.skillIds[1],
        type: "multiple_choice",
        prompt: input.prompts[1],
        choices: [
          { id: "observe", label: "Observe, explain, then choose", correct: true },
          { id: "guess", label: "Guess without checking", correct: false },
          { id: "skip", label: "Skip every step", correct: false },
        ],
        difficulty: "core",
      },
      {
        id: `${slug}-explain`,
        title: "Explain your thinking",
        skillId: input.skillIds[2],
        type: "voice",
        prompt: input.prompts[2],
        expectedAnswer: "",
        difficulty: "stretch",
      },
    ],
    defaultAdaptations: {
      extraThinkingTimeMs: 8000,
      forceSubtitles: true,
      reducedMotion: true,
      functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
    },
  };
}

export const scienceK2Fall2026 = authoredPack({
  id: "science-k2-fall-2026",
  title: "Science - K-2 - Fall 2026",
  subject: "science",
  gradeBand: "K",
  skillGraphRef: "ngss-k2-physical-science",
  skillIds: ["ngss.K-PS2-1", "ngss.K-PS3-1", "ngss.K-PS3-2"],
  prompts: [
    "Notice what changes when you gently push or pull an object.",
    "Which approach helps us learn whether sunlight warms an object?",
    "Describe one observation and one question about light, heat, or motion.",
  ],
});

export const geographyK2Fall2026 = authoredPack({
  id: "geography-k2-fall-2026",
  title: "Geography - K-2 - Fall 2026",
  subject: "geography",
  gradeBand: "K",
  skillGraphRef: "ncge-geography-k2",
  skillIds: ["ncge.k2.S1.1", "ncge.k2.S2.1", "ncge.k2.S3.1"],
  prompts: [
    "Notice landmarks that help you describe a familiar place.",
    "Which approach helps you use a map to find a place?",
    "Describe a route using location words such as near, beside, or across.",
  ],
});

export const history35Fall2026 = authoredPack({
  id: "history-3-5-fall-2026",
  title: "History - Grades 3-5 - Fall 2026",
  subject: "social_studies",
  gradeBand: "3",
  skillGraphRef: "c3-social-studies-3-8",
  skillIds: ["c3.3.D1.Q1", "c3.3.D2.His.1", "c3.3.D2.Civ.6"],
  prompts: [
    "Historians begin with a question and look for evidence from more than one source.",
    "Which approach helps compare two accounts of the same event?",
    "Explain how one source supports or changes your understanding of an event.",
  ],
});

export const lifeSkills6PlusFall2026 = authoredPack({
  id: "life-skills-6-plus-fall-2026",
  title: "Life Skills - Grade 6+ - Fall 2026",
  subject: "life_skills",
  gradeBand: "6",
  skillGraphRef: "cec-life-skills-6-plus",
  skillIds: ["cec.ls.6.ef.plan", "cec.ls.6.daily.routine", "cec.ls.6.advocacy.request"],
  prompts: [
    "A useful plan names the goal, the first step, and the support you can ask for.",
    "Which approach makes a daily routine easier to complete?",
    "Practise a clear, respectful request for help or an accommodation.",
  ],
});

export const creativeArtsK2Fall2026 = authoredPack({
  id: "creative-arts-k2-fall-2026",
  title: "Creative Arts - K-2 - Fall 2026",
  subject: "creative_arts",
  gradeBand: "K",
  skillGraphRef: "ncas-creative-arts-k2",
  skillIds: ["ncas.arts.k2.create.imagine", "ncas.arts.k2.create.draft", "ncas.arts.k2.respond.connect"],
  prompts: [
    "Artists notice colors, shapes, sounds, and movement, then turn an idea into something new.",
    "Which approach helps an artist improve a first draft?",
    "Describe one choice you made and what you want the audience to notice.",
  ],
});

export const selK2Fall2026 = authoredPack({
  id: "sel-k2-fall-2026",
  title: "Social-Emotional Learning - K-2 - Fall 2026",
  subject: "sel",
  gradeBand: "K",
  skillGraphRef: "casel-sel-k2",
  skillIds: ["casel.k2.self_awareness.feelings", "casel.k2.self_management.calm", "casel.k2.relationship.share"],
  prompts: [
    "Notice a feeling and where it shows up in your body.",
    "Which approach can help your body feel ready to learn?",
    "Practise words you can use to share, join, or ask for space.",
  ],
});

export const musicK2Fall2026 = authoredPack({
  id: "music-k2-fall-2026",
  title: "Music - K-2 - Fall 2026",
  subject: "music",
  gradeBand: "K",
  skillGraphRef: "ncas-music-k2",
  skillIds: ["ncas.music.k2.create.idea", "ncas.music.k2.perform.steady_beat", "ncas.music.k2.respond.fast_slow"],
  prompts: [
    "Listen for a steady beat and notice whether the music feels fast or slow.",
    "Which approach helps a group keep the same beat?",
    "Clap or describe a short rhythm, then explain how it changes.",
  ],
});

export const peHealthK2Fall2026 = authoredPack({
  id: "pe-health-k2-fall-2026",
  title: "PE and Health - K-2 - Fall 2026",
  subject: "pe_health",
  gradeBand: "K",
  skillGraphRef: "shape-pe-health-k2",
  skillIds: ["shape.k2.s1.locomotor", "shape.k2.s3.warmup", "shape.k2.health.choose"],
  prompts: [
    "Safe movement starts by noticing your space, your body, and the people nearby.",
    "Which approach prepares your body before active play?",
    "Describe or demonstrate one safe movement and one healthy choice.",
  ],
});

export const speechEarlyFall2026 = authoredPack({
  id: "speech-early-fall-2026",
  title: "Speech and Communication - Early Years - Fall 2026",
  subject: "speech",
  gradeBand: "PRE_K",
  skillGraphRef: "asha-speech-early",
  skillIds: ["asha.early.artic.initial", "asha.early.aac.request", "asha.early.convo.turn"],
  prompts: [
    "Communication can use speech, sounds, signs, gestures, pictures, or AAC.",
    "Which approach helps a communication partner understand your request?",
    "Take a communication turn in the way that works best for you.",
  ],
});

export const stemEngineering35Fall2026 = authoredPack({
  id: "stem-engineering-3-5-fall-2026",
  title: "STEM Engineering - Grades 3-5 - Fall 2026",
  subject: "stem_engineering",
  gradeBand: "3",
  skillGraphRef: "ngss-engineering-design-3-5",
  skillIds: ["ngss.eng.3-5.ETS1-1", "ngss.eng.3-5.ETS1-2", "ngss.eng.3-5.ETS1-3.iterate"],
  prompts: [
    "Engineers define the problem, identify constraints, and test more than one idea.",
    "Which approach produces useful evidence during a design test?",
    "Explain one design change you would make after a test.",
  ],
});

export const worldLanguagesNoviceLowFall2026 = authoredPack({
  id: "world-languages-novice-low-fall-2026",
  title: "World Languages - Novice Low - Fall 2026",
  subject: "world_languages",
  gradeBand: "K",
  skillGraphRef: "actfl-world-languages-novice-low",
  skillIds: ["actfl.nl.com.greet", "actfl.nl.com.ask", "actfl.nl.compare.languages"],
  prompts: [
    "Listen for a greeting, notice the sounds, and respond in a way that fits the context.",
    "Which approach helps when you do not understand a new word?",
    "Practise a greeting or simple question, then compare it with a language you know.",
  ],
});

export const AUTHORED_SUBJECT_PACKS = [
  scienceK2Fall2026,
  geographyK2Fall2026,
  history35Fall2026,
  lifeSkills6PlusFall2026,
  creativeArtsK2Fall2026,
  selK2Fall2026,
  musicK2Fall2026,
  peHealthK2Fall2026,
  speechEarlyFall2026,
  stemEngineering35Fall2026,
  worldLanguagesNoviceLowFall2026,
] as const;
