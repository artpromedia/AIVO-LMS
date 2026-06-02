/**
 * Baseline fallback bank — Sprint 3.
 *
 * Curated multiple-choice items grouped by the seven required baseline
 * subjects (math, ela, science, speech, sel, life_skills,
 * executive_function). Used by services/assessment-svc when ai-svc
 * cannot generate a baseline (LLM error, network timeout, schema
 * validation failure with < 14 valid items).
 *
 * Exporting this map separately from `production.ts` keeps the
 * existing curriculum-coverage scanner unaffected — the four legacy
 * required subjects (math/ela/science/writing) still resolve through
 * `production.ts`, and the fallback consumer reaches into this map
 * directly.
 */
import type { Item } from "./types.js";
import { MATH_PRODUCTION_ITEMS } from "./seed-math.js";
import { ELA_PRODUCTION_ITEMS } from "./seed-ela.js";
import { SCIENCE_PRODUCTION_ITEMS } from "./seed-science.js";
import { SEL_PRODUCTION_ITEMS } from "./seed-sel.js";
import { LIFE_SKILLS_PRODUCTION_ITEMS } from "./seed-life-skills.js";
import { EXECUTIVE_FUNCTION_PRODUCTION_ITEMS } from "./seed-executive-function.js";
import { SPEECH_PRODUCTION_ITEMS } from "./seed-speech.js";

export type BaselineFallbackSubject =
  | "math"
  | "ela"
  | "science"
  | "speech"
  | "sel"
  | "life_skills"
  | "executive_function";

export const BASELINE_FALLBACK_SUBJECTS: readonly BaselineFallbackSubject[] = [
  "math",
  "ela",
  "science",
  "speech",
  "sel",
  "life_skills",
  "executive_function",
] as const;

export const BASELINE_FALLBACK_BANK: Record<BaselineFallbackSubject, readonly Item[]> = {
  math: MATH_PRODUCTION_ITEMS,
  ela: ELA_PRODUCTION_ITEMS,
  science: SCIENCE_PRODUCTION_ITEMS,
  speech: SPEECH_PRODUCTION_ITEMS,
  sel: SEL_PRODUCTION_ITEMS,
  life_skills: LIFE_SKILLS_PRODUCTION_ITEMS,
  executive_function: EXECUTIVE_FUNCTION_PRODUCTION_ITEMS,
};

/**
 * Pull the grade band out of a skillId. Recognises the patterns used
 * across all seven seed banks:
 *
 *   ccss-math.K.CC.A.1        → "K"
 *   ccss-ela.3.RL.2           → "3"
 *   ccss-math.8.EE.B.5        → "8"
 *   ngss.science.3.LS.1       → "3"
 *   asha.speech.6.figurative  → "6"
 *   life-skills.4.money.1     → "4"
 *
 * Returns `null` when no recognisable grade token is present.
 */
export function gradeBandFromSkillId(skillId: string): string | null {
  if (!skillId) return null;
  const parts = skillId.split(".");
  for (const part of parts) {
    if (part === "K" || part === "PK") return part;
    if (/^\d{1,2}$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= 12) return String(n);
    }
  }
  return null;
}

/** Internal: deterministic value labels (a, b, c, …) for option ids. */
const VALUE_KEYS = ["a", "b", "c", "d", "e", "f"];

export interface BaselineFallbackQuestion {
  id: string;
  subject: BaselineFallbackSubject;
  questionText: string;
  options: { value: string; label: string }[];
  correctAnswer: string;
  difficulty: number;
  skillId: string;
  standardRef: string;
  interactionType: "multiple_choice";
}

/**
 * Convert one item-bank Item into the baseline-question shape ai-svc
 * normally returns. Items without an authored choice list and a usable
 * answer are skipped (caller filters out `null`s).
 *
 * For numeric `math_expression` items we synthesise plausible
 * distractors deterministically so the math bank — the largest in the
 * catalogue but mostly free-response — still contributes to the
 * fallback baseline as multiple-choice questions.
 */
export function itemToBaselineQuestion(
  item: Item,
  subject: BaselineFallbackSubject,
): BaselineFallbackQuestion | null {
  const variant = item.variants?.find((v) => v.status === "active") ?? item.variants?.[0];
  if (!variant) return null;
  const body = (variant.body ?? {}) as {
    stem?: string;
    choices?: string[];
    correctAnswer?: string;
  };
  const stem = (body.stem ?? "").trim();
  const correct = (body.correctAnswer ?? "").trim();
  if (!stem || !correct) return null;

  const authored = Array.isArray(body.choices)
    ? body.choices.filter((c) => typeof c === "string" && c.length > 0)
    : [];

  let choices: string[];
  if (authored.length >= 2) {
    // Authored choices win — reject when the correct answer is not in
    // the authored list (treat as content-authoring error rather than
    // silently rewriting the answer key).
    if (!authored.includes(correct)) return null;
    choices = authored;
  } else {
    // No authored choices: synthesise plausible distractors for numeric
    // / fraction free-response items so the math bank — mostly
    // math_expression — still contributes to the MC fallback.
    const synth = synthesiseChoices(correct, item.id);
    if (!synth || synth.length < 2) return null;
    choices = synth;
  }

  // Cap at 4 options for parity with the AI baseline contract. Preserve
  // the correct answer if it lands beyond index 4.
  const trimmed = choices.slice(0, 4);
  if (!trimmed.includes(correct)) trimmed[trimmed.length - 1] = correct;

  const options = trimmed.map((label, idx) => ({
    value: VALUE_KEYS[idx],
    label,
  }));
  const correctOption = options.find((o) => o.label === correct);
  if (!correctOption) return null;

  return {
    id: item.id,
    subject,
    questionText: stem,
    options,
    correctAnswer: correctOption.value,
    difficulty: 1,
    skillId: item.skillId,
    standardRef: item.skillId,
    interactionType: "multiple_choice",
  };
}

/**
 * Deterministic distractor synthesis for free-response numeric items.
 * Recognises integers ("13", "322"), decimals ("2.50"), and fractions
 * ("5/6"). Returns `null` for non-numeric answers so language items
 * without authored choices are still skipped rather than served with
 * gibberish distractors.
 */
function synthesiseChoices(correct: string, seed: string): string[] | null {
  // Integer ----------------------------------------------------------------
  if (/^-?\d+$/.test(correct)) {
    const n = parseInt(correct, 10);
    const s = hashSeed(seed);
    const deltas = uniqueDeltas(s, 3, Math.max(1, Math.ceil(Math.abs(n) * 0.25) || 1));
    const choices = [n, ...deltas.map((d) => n + d)].slice(0, 4).map(String);
    return shuffleDeterministic(choices, s ^ 0x1234);
  }
  // Decimal ----------------------------------------------------------------
  if (/^-?\d+\.\d+$/.test(correct)) {
    const n = Number(correct);
    const s = hashSeed(seed);
    const step = Math.max(0.01, Math.abs(n) * 0.1);
    const deltas = uniqueDeltas(s, 3, step);
    const formatted = (x: number) => x.toFixed(2);
    const choices = [formatted(n), ...deltas.map((d) => formatted(n + d))];
    return shuffleDeterministic(choices.slice(0, 4), s ^ 0x1234);
  }
  // Fraction --------------------------------------------------------------
  if (/^-?\d+\/\d+$/.test(correct)) {
    const [a, b] = correct.split("/").map((x) => parseInt(x, 10));
    if (!b) return null;
    const s = hashSeed(seed);
    const variants = [
      `${a}/${b}`,
      `${a + 1}/${b}`,
      `${a}/${Math.max(2, b - 1)}`,
      `${Math.max(1, a - 1)}/${b}`,
    ];
    return shuffleDeterministic(variants, s ^ 0x1234);
  }
  return null;
}

function uniqueDeltas(seed: number, count: number, step: number): number[] {
  const out = new Set<number>();
  let s = seed | 0 || 1;
  while (out.size < count) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const sign = s & 1 ? 1 : -1;
    const magnitude = Math.max(1, Math.floor((Math.abs(s) % 5) + 1)) * step;
    const candidate = sign * magnitude;
    if (candidate !== 0) out.add(Math.round(candidate * 100) / 100);
    if (out.size === 0 && s === 0) break;
  }
  return Array.from(out);
}

/**
 * Deterministic-with-jitter shuffler. Uses a 32-bit xorshift seeded by
 * (learnerId hash + subject) so the same learner sees stable items
 * across retries within one session but two learners get different
 * orderings. No external RNG dependency.
 */
function shuffleDeterministic<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  let s = seed | 0 || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const j = Math.abs(s) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function hashSeed(...parts: (string | undefined | null)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    if (!p) continue;
    for (let i = 0; i < p.length; i += 1) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return h | 0;
}

export interface PickFallbackBaselineParams {
  /** Stable learner id for deterministic item selection. */
  learnerId?: string;
  /** Normalised grade band ("K", "3", "8") if known. */
  gradeBand?: string | null;
  /** Items per subject. Default 6 → 42 total (mirrors ai-svc target). */
  countPerSubject?: number;
}

export interface PickFallbackBaselineResult {
  questions: BaselineFallbackQuestion[];
  /** Subjects from BASELINE_FALLBACK_SUBJECTS, useful for callers that
   *  need to render the subject taxonomy alongside the questions. */
  subjects: readonly BaselineFallbackSubject[];
  source: "fallback";
}

/**
 * Pick a 7-subject × 6-item baseline (42 questions total by default)
 * from the curated banks. Prefers items at the learner's grade band,
 * then nearby grades, then any grade — so the fallback never returns
 * fewer than `countPerSubject` items as long as the subject bank has
 * that many usable items.
 */
export function pickFallbackBaseline(
  params: PickFallbackBaselineParams = {},
): PickFallbackBaselineResult {
  const { learnerId, gradeBand, countPerSubject = 6 } = params;

  const questions: BaselineFallbackQuestion[] = [];
  for (const subject of BASELINE_FALLBACK_SUBJECTS) {
    const bank = BASELINE_FALLBACK_BANK[subject];
    const seed = hashSeed(learnerId, subject);

    // Bucket items by grade-band distance from the target.
    const target = gradeBand ?? null;
    const buckets: Item[][] = [[], [], []]; // 0 = exact, 1 = ±1, 2 = anything
    for (const item of bank) {
      const g = gradeBandFromSkillId(item.skillId);
      if (target && g === target) buckets[0].push(item);
      else if (target && g && gradeDistance(g, target) === 1) buckets[1].push(item);
      else buckets[2].push(item);
    }

    const ordered = [
      ...shuffleDeterministic(buckets[0], seed),
      ...shuffleDeterministic(buckets[1], seed ^ 0x9e3779b1),
      ...shuffleDeterministic(buckets[2], seed ^ 0x85ebca77),
    ];

    let taken = 0;
    for (const item of ordered) {
      if (taken >= countPerSubject) break;
      const q = itemToBaselineQuestion(item, subject);
      if (!q) continue;
      questions.push(q);
      taken += 1;
    }
  }

  return {
    questions,
    subjects: BASELINE_FALLBACK_SUBJECTS,
    source: "fallback",
  };
}

function gradeDistance(a: string, b: string): number {
  const an = a === "K" ? 0 : a === "PK" ? -1 : Number(a);
  const bn = b === "K" ? 0 : b === "PK" ? -1 : Number(b);
  if (Number.isNaN(an) || Number.isNaN(bn)) return 99;
  return Math.abs(an - bn);
}
