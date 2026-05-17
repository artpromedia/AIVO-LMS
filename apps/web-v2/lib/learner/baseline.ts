/**
 * Deterministic baseline question generator. Picks questions from a per-skill
 * bank, honors grade band + brain-profile signals (reading/math comfort,
 * accommodations), and tags each item with difficulty + accommodation hints.
 *
 * The generator is deterministic given the same inputs so two parents seeing
 * the same learner get the same baseline, but two different learners get
 * meaningfully different baselines (different skills, difficulties, supports).
 */
import type {
  BaselineDifficulty,
  BaselineQuestion,
  LearnerBrainProfile,
  LearnerProfile,
  Skill,
  Subject,
} from "@/lib/db/types";
import { newId } from "@/lib/db/store";

type BankItem = {
  skillSlug: string;
  difficulty: BaselineDifficulty;
  prompt: string;
  choices: string[];
  expectedAnswer: string;
  hint: string;
  readAloudText: string;
};

const BANK: BankItem[] = [
  // Reading — CVC
  {
    skillSlug: "phonics-cvc",
    difficulty: "foundational",
    prompt: "Which word matches the picture of a cat?",
    choices: ["cat", "dog", "car"],
    expectedAnswer: "cat",
    hint: "Listen to the first sound: /k/.",
    readAloudText: "Which word matches the picture of a cat? Choose one.",
  },
  {
    skillSlug: "phonics-cvc",
    difficulty: "approaching",
    prompt: "Pick the word that rhymes with 'hat'.",
    choices: ["mat", "hot", "him"],
    expectedAnswer: "mat",
    hint: "Listen for the same ending sound: -at.",
    readAloudText: "Pick the word that rhymes with hat.",
  },
  // Reading — sight words
  {
    skillSlug: "sight-words-50",
    difficulty: "foundational",
    prompt: "Which word is 'the'?",
    choices: ["the", "and", "you"],
    expectedAnswer: "the",
    hint: "It starts with the letter t.",
    readAloudText: "Which word is the? Choose one.",
  },
  // Reading — story sequence
  {
    skillSlug: "story-sequence",
    difficulty: "grade_level",
    prompt: "In a story, what usually happens first?",
    choices: ["The ending", "The beginning", "The middle"],
    expectedAnswer: "The beginning",
    hint: "Think of a story as start, middle, end.",
    readAloudText: "In a story, what usually happens first?",
  },
  // Reading — main idea
  {
    skillSlug: "main-idea",
    difficulty: "stretch",
    prompt: "What is the main idea of a story about a fox who learns to share?",
    choices: ["Foxes are fast", "Sharing helps friends", "It was raining"],
    expectedAnswer: "Sharing helps friends",
    hint: "What lesson did the fox learn?",
    readAloudText: "What is the main idea of a story about a fox who learns to share?",
  },
  // Math — count to 20
  {
    skillSlug: "count-to-20",
    difficulty: "foundational",
    prompt: "What number comes after 7?",
    choices: ["6", "8", "9"],
    expectedAnswer: "8",
    hint: "Count up: 7, then...",
    readAloudText: "What number comes after seven?",
  },
  {
    skillSlug: "count-to-20",
    difficulty: "approaching",
    prompt: "What number comes after 14?",
    choices: ["13", "15", "16"],
    expectedAnswer: "15",
    hint: "Count up: 14, then...",
    readAloudText: "What number comes after fourteen?",
  },
  // Math — add within 10
  {
    skillSlug: "add-within-10",
    difficulty: "grade_level",
    prompt: "3 + 4 = ?",
    choices: ["6", "7", "8"],
    expectedAnswer: "7",
    hint: "Count up from 3: 4, 5, 6, 7.",
    readAloudText: "Three plus four equals what?",
  },
  // Math — place value
  {
    skillSlug: "place-value-10s",
    difficulty: "stretch",
    prompt: "In the number 23, the 2 means how many?",
    choices: ["2", "20", "200"],
    expectedAnswer: "20",
    hint: "The 2 is in the tens place.",
    readAloudText: "In the number twenty-three, the two means how many?",
  },
  // Math — subtract within 20
  {
    skillSlug: "subtract-within-20",
    difficulty: "grade_level",
    prompt: "12 - 5 = ?",
    choices: ["5", "6", "7"],
    expectedAnswer: "7",
    hint: "Start at 12 and count back 5.",
    readAloudText: "Twelve minus five equals what?",
  },
  // Writing
  {
    skillSlug: "trace-letters",
    difficulty: "foundational",
    prompt: "Which letter is the first letter of 'sun'?",
    choices: ["s", "u", "n"],
    expectedAnswer: "s",
    hint: "Say sun out loud.",
    readAloudText: "Which letter is the first letter of sun?",
  },
  {
    skillSlug: "simple-sentence",
    difficulty: "grade_level",
    prompt: "Which is a complete sentence?",
    choices: ["The dog.", "The dog runs.", "Runs fast."],
    expectedAnswer: "The dog runs.",
    hint: "A sentence needs a who and a what they do.",
    readAloudText: "Which is a complete sentence?",
  },
  // Science
  {
    skillSlug: "five-senses",
    difficulty: "foundational",
    prompt: "Which sense do you use to know if ice is cold?",
    choices: ["Sight", "Touch", "Smell"],
    expectedAnswer: "Touch",
    hint: "You feel cold with your skin.",
    readAloudText: "Which sense do you use to know if ice is cold?",
  },
  {
    skillSlug: "weather",
    difficulty: "approaching",
    prompt: "Which one is usually warm?",
    choices: ["Winter", "Summer", "Night"],
    expectedAnswer: "Summer",
    hint: "Think of the hottest season.",
    readAloudText: "Which one is usually warm?",
  },
  // Social
  {
    skillSlug: "name-feelings",
    difficulty: "foundational",
    prompt: "What feeling does someone have when they smile and laugh?",
    choices: ["Sad", "Happy", "Angry"],
    expectedAnswer: "Happy",
    hint: "Smiles usually mean a good feeling.",
    readAloudText: "What feeling does someone have when they smile and laugh?",
  },
  {
    skillSlug: "taking-turns",
    difficulty: "approaching",
    prompt: "Two kids both want the swing. What is fair?",
    choices: ["Grab it first", "Take turns", "Walk away mad"],
    expectedAnswer: "Take turns",
    hint: "Sharing means each gets a turn.",
    readAloudText: "Two kids both want the swing. What is fair?",
  },
  // Life skills
  {
    skillSlug: "morning-routine",
    difficulty: "foundational",
    prompt: "What do you do right after you wake up?",
    choices: ["Eat dinner", "Get out of bed", "Go to sleep"],
    expectedAnswer: "Get out of bed",
    hint: "Think about the very first thing.",
    readAloudText: "What do you do right after you wake up?",
  },
  // Art
  {
    skillSlug: "primary-colors",
    difficulty: "foundational",
    prompt: "Which one is a primary color?",
    choices: ["Green", "Red", "Purple"],
    expectedAnswer: "Red",
    hint: "Primary colors mix to make others.",
    readAloudText: "Which one is a primary color?",
  },
  // Social-emotional (Harmony's Feelings Treehouse)
  {
    skillSlug: "empathy-basics",
    difficulty: "grade_level",
    prompt: "Your friend dropped their ice cream and looks sad. What is kind to do?",
    choices: ["Laugh at them", "Offer to share yours", "Walk away"],
    expectedAnswer: "Offer to share yours",
    hint: "Think about what would make them feel better.",
    readAloudText:
      "Your friend dropped their ice cream and looks sad. What is kind to do?",
  },
  {
    skillSlug: "name-feelings",
    difficulty: "approaching",
    prompt: "Someone is crossing their arms and frowning. They probably feel…",
    choices: ["Excited", "Upset", "Tired"],
    expectedAnswer: "Upset",
    hint: "Crossed arms and a frown usually mean a hard feeling.",
    readAloudText:
      "Someone is crossing their arms and frowning. They probably feel what?",
  },
  // Speech & Language (Echo's Sound Studio)
  {
    skillSlug: "rhyming-words",
    difficulty: "foundational",
    prompt: "Which word rhymes with 'moon'?",
    choices: ["Spoon", "Star", "Bird"],
    expectedAnswer: "Spoon",
    hint: "Listen for the same ending sound: -oon.",
    readAloudText: "Which word rhymes with moon?",
  },
  {
    skillSlug: "syllable-count",
    difficulty: "approaching",
    prompt: "How many syllables are in 'butterfly'?",
    choices: ["2", "3", "4"],
    expectedAnswer: "3",
    hint: "Clap it out: but-ter-fly.",
    readAloudText: "How many syllables are in butterfly?",
  },
  {
    skillSlug: "synonyms-basics",
    difficulty: "grade_level",
    prompt: "Which word means almost the same as 'happy'?",
    choices: ["Glad", "Angry", "Tired"],
    expectedAnswer: "Glad",
    hint: "Look for a word with a similar feeling.",
    readAloudText: "Which word means almost the same as happy?",
  },
  // Executive Function (Pixel's Puzzle Palace)
  {
    skillSlug: "pattern-complete",
    difficulty: "foundational",
    prompt: "What comes next in the pattern: red, blue, red, blue, ___?",
    choices: ["Red", "Green", "Yellow"],
    expectedAnswer: "Red",
    hint: "The pattern goes red then blue, over and over.",
    readAloudText:
      "What comes next in the pattern: red, blue, red, blue, blank?",
  },
  {
    skillSlug: "memory-sequence",
    difficulty: "approaching",
    prompt:
      "I show you: cat, hat, bat. Which word was in the middle?",
    choices: ["Cat", "Hat", "Bat"],
    expectedAnswer: "Hat",
    hint: "First, middle, last — the middle one.",
    readAloudText: "I show you cat, hat, bat. Which word was in the middle?",
  },
  {
    skillSlug: "multi-step-plan",
    difficulty: "stretch",
    prompt:
      "You have 30 minutes to get ready, eat, and walk to the bus. What do you do first?",
    choices: ["Walk to the bus", "Get ready", "Take a nap"],
    expectedAnswer: "Get ready",
    hint: "Think about what has to happen before everything else.",
    readAloudText:
      "You have thirty minutes to get ready, eat, and walk to the bus. What do you do first?",
  },
];

const DIFFICULTY_ORDER: BaselineDifficulty[] = [
  "foundational",
  "approaching",
  "grade_level",
  "stretch",
];

function comfortToBias(comfort: LearnerProfile["readingComfort"]): number {
  switch (comfort) {
    case "advanced":
      return 1;
    case "confident":
      return 0;
    case "growing":
      return -1;
    case "new":
      return -2;
    default:
      return 0;
  }
}

function pickDifficulties(bias: number): BaselineDifficulty[] {
  // bias -2..+1 → window of 2 levels we'll prefer
  const start = Math.max(0, Math.min(2, 1 + bias));
  return [DIFFICULTY_ORDER[start]!, DIFFICULTY_ORDER[start + 1]!].filter(Boolean);
}

function accommodationTagsFor(brainProfile: LearnerBrainProfile | null): string[] {
  if (!brainProfile) return [];
  const tags = new Set<string>();
  const s = brainProfile.state;
  if (s.accessibilityPreferences?.largeText) tags.add("large_text");
  if (s.accessibilityPreferences?.audioFirst) tags.add("read_aloud");
  if (s.accessibilityPreferences?.reducedMotion) tags.add("reduced_motion");
  if (s.accessibilityPreferences?.highContrast) tags.add("high_contrast");
  if (s.accessibilityPreferences?.captionsAlwaysOn) tags.add("captions");
  const summary = s.accommodationSummary ?? "";
  if (/extended.time/i.test(summary) || s.supportDefaults?.extendedTime) {
    tags.add("extended_time");
  }
  if (/break/i.test(summary) || s.supportDefaults?.sensoryBreaks) {
    tags.add("break_offered");
  }
  return Array.from(tags);
}

export type GenerateBaselineInput = {
  baselineId: string;
  learner: LearnerProfile;
  brainProfile: LearnerBrainProfile | null;
  subjects: Subject[];
  skills: Skill[];
};

/**
 * Produce a baseline question set for the supplied subjects (reading + math by
 * default). Returns 2–3 questions per subject, ordered foundational → harder,
 * keeping the total tight enough for low-friction onboarding.
 */
export function generateBaselineQuestions(
  input: GenerateBaselineInput,
): BaselineQuestion[] {
  const { baselineId, learner, brainProfile, subjects, skills } = input;
  const accTags = accommodationTagsFor(brainProfile);
  const readingBias = comfortToBias(learner.readingComfort);
  const mathBias = comfortToBias(learner.mathComfort);

  const skillsBySubject = new Map<string, Skill[]>();
  for (const s of skills) {
    const list = skillsBySubject.get(s.subjectId) ?? [];
    list.push(s);
    skillsBySubject.set(s.subjectId, list);
  }

  const questions: BaselineQuestion[] = [];
  let order = 0;
  for (const subject of subjects) {
    const subjSkills = skillsBySubject.get(subject.id) ?? [];
    if (subjSkills.length === 0) continue;
    const bias =
      subject.slug === "reading" ||
      subject.slug === "writing" ||
      subject.slug === "speech"
        ? readingBias
        : subject.slug === "math" ||
            subject.slug === "executive-function"
          ? mathBias
          : 0;
    const wantedDiffs = pickDifficulties(bias);

    // Collect candidate bank items for this subject.
    const subjSkillsBySlug = new Map(subjSkills.map((s) => [s.slug, s]));
    const candidates = BANK.filter((b) => subjSkillsBySlug.has(b.skillSlug));
    if (candidates.length === 0) continue;

    // Pick one per wanted difficulty, fall back to anything matching.
    const picked: BankItem[] = [];
    for (const diff of wantedDiffs) {
      const match =
        candidates.find(
          (c) => c.difficulty === diff && !picked.includes(c),
        ) ?? candidates.find((c) => !picked.includes(c));
      if (match) picked.push(match);
    }
    if (picked.length === 0) picked.push(candidates[0]!);

    for (const item of picked) {
      const skill = subjSkillsBySlug.get(item.skillSlug);
      if (!skill) continue;
      order += 1;
      questions.push({
        id: newId("bq"),
        baselineId,
        subjectId: subject.id,
        skillId: skill.id,
        order,
        prompt: item.prompt,
        choices: item.choices,
        expectedAnswer: item.expectedAnswer,
        hint: item.hint,
        readAloudText: item.readAloudText,
        difficulty: item.difficulty,
        accommodationTags: accTags,
      });
    }
  }
  return questions;
}

/** Default subjects covered by an onboarding baseline. Six Discovery
 *  Adventure domains, mirroring the legacy chapter set. */
export function defaultBaselineSubjectSlugs(): string[] {
  return [
    "reading",
    "math",
    "science",
    "social",
    "speech",
    "executive-function",
  ];
}
