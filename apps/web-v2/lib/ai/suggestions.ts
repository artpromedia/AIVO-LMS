/**
 * AI-style suggestion engine for free-text learner / assessment fields.
 *
 * This is a server-side module that returns:
 *   - a list of short "chip" suggestions a parent can click to insert
 *   - an optional inline `completion` for the last partial token the
 *     parent has typed (used for ghost-text autocomplete)
 *
 * The engine is deliberately template-driven rather than calling an
 * external LLM: it runs offline, has zero per-request cost, and the
 * shape of the response (`{ suggestions, completion }`) is identical to
 * what a real Claude-backed implementation would return, so swapping in
 * a live model later is a one-file change. The pools below were
 * authored to mirror the empathetic, low-stigma language the rest of
 * the parent-facing copy uses.
 */

export type FieldType =
  | "learner_strengths"
  | "learner_challenges"
  | "learner_loves"
  | "learner_motivates"
  | "good_at"
  | "frustration_triggers"
  | "calming_strategies"
  | "rewards_that_help"
  | "avoidance_factors"
  | "concerns"
  | "accommodations"
  | "reading_notes"
  | "math_notes"
  | "communication_notes"
  | "goals";

export type AgeBand =
  | "preK"
  | "K"
  | "early_elementary"
  | "upper_elementary"
  | "middle"
  | "high"
  | "post_secondary";

export type SuggestionContext = {
  ageRange?: string | null;
  gradeBand?: string | null;
  existingItems?: string[];
};

export type SuggestionResult = {
  suggestions: string[];
  completion: string | null;
};

const POOLS: Record<FieldType, string[]> = {
  learner_strengths: [
    "Loves animals",
    "Great at puzzles",
    "Remembers song lyrics",
    "Curious about how things work",
    "Tells imaginative stories",
    "Pays close attention to detail",
    "Kind to younger kids",
    "Sticks with hard problems",
    "Builds elaborate LEGO creations",
    "Picks up new vocabulary fast",
    "Strong visual memory",
    "Loves drawing and doodling",
    "Notices patterns others miss",
    "Asks thoughtful questions",
    "Comfortable performing for family",
    "Naturally helpful in group work",
    "Fluent in two languages",
    "Counts and sorts confidently",
    "Quick mental math",
    "Empathetic listener",
  ],
  learner_challenges: [
    "Easily distracted by sound",
    "Reluctant to write by hand",
    "Loses focus after 10 minutes",
    "Gets anxious about mistakes",
    "Struggles to start tasks",
    "Reads slowly out loud",
    "Avoids math word problems",
    "Big feelings around transitions",
    "Finds group work tiring",
    "Hard to sit still for long",
    "Forgets multi-step directions",
    "Sensitive to bright screens",
    "Spelling feels frustrating",
    "Slow handwriting",
    "Overwhelmed by busy pages",
    "Shuts down when timed",
    "Reluctant to ask for help",
    "Skips steps when rushing",
  ],
  learner_loves: [
    "Dinosaurs and prehistoric animals",
    "Building with LEGO",
    "Cooking with grandma",
    "Drawing comics",
    "Minecraft and creative worlds",
    "Soccer and being outdoors",
    "Space and the planets",
    "Music — listening and making",
    "Reading graphic novels",
    "Trains, planes, and big machines",
    "Caring for pets",
    "Making YouTube-style videos",
    "Playing chess",
    "Crafting and friendship bracelets",
    "Dancing to favourite songs",
  ],
  learner_motivates: [
    "Beating their own time",
    "Showing a parent what they made",
    "Earning extra outdoor time",
    "Cool space or animal facts",
    "Working toward a small reward",
    "Helping a sibling or friend",
    "Finishing before a favourite show",
    "Sticker charts and streaks",
    "A high five from their tutor",
    "Telling a funny joke after",
  ],
  good_at: [
    "Memorising lyrics",
    "Building",
    "Drawing",
    "Kindness",
    "Spotting patterns",
    "Telling stories",
    "Mental math",
    "Reading aloud",
    "Sorting and organising",
    "Sports",
    "Singing",
    "Helping others",
  ],
  frustration_triggers: [
    "Long reading passages",
    "Timers and countdowns",
    "Loud or busy rooms",
    "Being asked to redo work",
    "Surprise changes in plans",
    "Writing by hand for a long time",
    "Tests with strict time limits",
    "Crowded worksheets",
    "Being put on the spot",
    "Background music while reading",
    "Too many instructions at once",
    "Bright screens at night",
  ],
  calming_strategies: [
    "A short walk",
    "Water and 2 minutes off screen",
    "Noise-cancelling headphones",
    "Deep breaths together",
    "A snack break",
    "Stretching or jumping jacks",
    "Soft music",
    "Holding a favourite fidget",
    "A hug and a reset",
    "Drawing for five minutes",
    "Counting backward from ten",
    "Cold water on the face",
  ],
  rewards_that_help: [
    "Extra outdoor time",
    "Choosing the next activity",
    "A small treat after homework",
    "Screen time with a sibling",
    "A sticker on the chart",
    "Reading a chapter together",
    "Picking the dinner playlist",
    "Calling a grandparent",
  ],
  avoidance_factors: [
    "Worksheets that look long",
    "Spelling tests",
    "Reading out loud in a group",
    "Anything timed",
    "Group presentations",
    "Cursive handwriting",
    "Surprise pop quizzes",
    "Long math word problems",
  ],
  concerns: [
    "Falling behind in reading",
    "Hard to keep up with homework",
    "Friendship struggles at school",
    "Anxiety before tests",
    "Trouble sleeping on school nights",
    "Avoiding writing tasks",
    "Confidence dipping this term",
    "Feels different from classmates",
  ],
  accommodations: [
    "Extended time on tests",
    "Read-aloud support",
    "Speech-to-text for writing",
    "Quiet testing room",
    "Frequent movement breaks",
    "Printed copies of slides",
    "Preferential seating",
    "Use of fidget tools",
    "Reduced number of problems",
    "Visual schedule",
  ],
  reading_notes: [
    "Loves being read to, less keen to read alone",
    "Decodes well but struggles with comprehension",
    "Skips small words when tired",
    "Strong vocabulary from audiobooks",
    "Prefers graphic novels over chapter books",
    "Reads confidently in their first language",
  ],
  math_notes: [
    "Strong with numbers, slower with word problems",
    "Loves puzzles, avoids long equations",
    "Mental math is faster than written",
    "Anxious about times tables",
    "Enjoys hands-on geometry",
    "Estimates well, struggles with precision",
  ],
  communication_notes: [
    "Talks easily with adults, shyer with peers",
    "Prefers writing over speaking in class",
    "Uses gestures to fill in words",
    "More fluent in their home language",
    "Needs extra time to organise an answer",
    "Comfortable with short conversations",
  ],
  goals: [
    "Read with more confidence",
    "Finish homework without melting down",
    "Catch up to grade level in math",
    "Build daily learning habits",
    "Feel proud of school again",
    "Prepare for the next grade",
    "Develop independent study skills",
    "Strengthen writing fluency",
  ],
};

const AGE_BIAS: Partial<Record<FieldType, Partial<Record<AgeBand, string[]>>>> = {
  learner_loves: {
    preK: ["Trains, planes, and big machines", "Caring for pets", "Dancing to favourite songs"],
    K: ["Drawing comics", "Caring for pets", "Building with LEGO"],
    early_elementary: ["Minecraft and creative worlds", "Building with LEGO", "Soccer and being outdoors"],
    upper_elementary: ["Minecraft and creative worlds", "Reading graphic novels", "Playing chess"],
    middle: ["Making YouTube-style videos", "Music — listening and making", "Crafting and friendship bracelets"],
    high: ["Music — listening and making", "Making YouTube-style videos"],
  },
  learner_strengths: {
    preK: ["Tells imaginative stories", "Curious about how things work", "Kind to younger kids"],
    K: ["Counts and sorts confidently", "Loves drawing and doodling"],
    high: ["Picks up new vocabulary fast", "Sticks with hard problems"],
  },
};

function mapAgeToBand(age?: string | null, grade?: string | null): AgeBand | null {
  if (grade) {
    if (grade === "preK") return "preK";
    if (grade === "K") return "K";
    if (grade === "1-2" || grade === "3-5") return grade === "1-2" ? "early_elementary" : "upper_elementary";
    if (grade === "6-8") return "middle";
    if (grade === "9-12") return "high";
    if (grade === "post_secondary") return "post_secondary";
  }
  if (!age) return null;
  if (age === "3-5") return "preK";
  if (age === "5-7") return "K";
  if (age === "7-9") return "early_elementary";
  if (age === "9-11") return "upper_elementary";
  if (age === "11-13") return "middle";
  if (age === "13-15" || age === "15-18") return "high";
  return null;
}

const SEPARATOR_RE = /[\n,·•]/;

function normaliseToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function alreadyMentioned(item: string, currentText: string, existingItems: string[]): boolean {
  const needle = normaliseToken(item);
  if (!needle) return false;
  for (const entry of existingItems) {
    if (normaliseToken(entry) === needle) return true;
  }
  const haystack = currentText
    .split(SEPARATOR_RE)
    .map(normaliseToken)
    .filter(Boolean);
  return haystack.includes(needle);
}

function pickCompletion(pool: string[], currentText: string): string | null {
  if (!currentText) return null;
  // Take the last fragment (after the last separator) and treat it as a
  // partial. Only complete if it looks like a real prefix — at least 2
  // characters and not already ending in a separator.
  const parts = currentText.split(SEPARATOR_RE);
  const last = parts[parts.length - 1] ?? "";
  const fragment = last.trim();
  if (fragment.length < 2) return null;
  const lower = fragment.toLowerCase();
  for (const item of pool) {
    if (item.toLowerCase().startsWith(lower) && item.length > fragment.length) {
      return item.slice(fragment.length);
    }
  }
  return null;
}

function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function generateSuggestions(
  fieldType: FieldType,
  currentText: string,
  context: SuggestionContext = {},
  limit = 6,
): SuggestionResult {
  const pool = POOLS[fieldType];
  if (!pool) {
    return { suggestions: [], completion: null };
  }

  const band = mapAgeToBand(context.ageRange ?? null, context.gradeBand ?? null);
  const biased = band ? AGE_BIAS[fieldType]?.[band] ?? [] : [];
  const existing = context.existingItems ?? [];

  const accept = (item: string, seen: Set<string>): boolean => {
    if (seen.has(item)) return false;
    if (alreadyMentioned(item, currentText, existing)) return false;
    seen.add(item);
    return true;
  };

  // Age-biased picks come first and stay in order so they reliably
  // surface for the relevant age band. The remainder of the pool is
  // lightly shuffled so repeated "Suggest" clicks don't always show
  // the same items.
  const seen = new Set<string>();
  const head: string[] = [];
  for (const item of biased) {
    if (accept(item, seen)) head.push(item);
  }
  const rest: string[] = [];
  for (const item of pool) {
    if (accept(item, seen)) rest.push(item);
  }
  const shuffledRest = shuffleSeeded(rest, currentText.length + fieldType.length);
  const suggestions = [...head, ...shuffledRest].slice(0, limit);

  return {
    suggestions,
    completion: pickCompletion(pool, currentText),
  };
}

const ALLOWED: ReadonlySet<FieldType> = new Set([
  "learner_strengths",
  "learner_challenges",
  "learner_loves",
  "learner_motivates",
  "good_at",
  "frustration_triggers",
  "calming_strategies",
  "rewards_that_help",
  "avoidance_factors",
  "concerns",
  "accommodations",
  "reading_notes",
  "math_notes",
  "communication_notes",
  "goals",
]);

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === "string" && ALLOWED.has(value as FieldType);
}
