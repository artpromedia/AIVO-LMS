/**
 * Pre-generated baseline question bank (the "instant baseline" path).
 *
 * Problem this solves: generating a baseline by calling the LLM on the
 * request path is slow (~130s for 42 questions) and fragile (a single
 * blocking SSR call that times out at the ingress and shows the parent an
 * error page). Instead we generate questions OFFLINE with the LLM across the
 * full matrix of (grade band × functioning level × subject), keep them in a
 * committed bank, and SELECT from that bank at baseline-creation time. That
 * turns a 130s blocking call into a sub-millisecond in-memory pick.
 *
 * The bank itself is produced by `scripts/generate-baseline-bank.mjs`, which
 * calls ai-svc and writes `baseline-bank.generated.json`. This module loads
 * that file and exposes a DYNAMIC selector: for a learner's grade band +
 * functioning level it samples a difficulty-spread set per subject, randomised
 * so two learners (or two runs) get meaningfully different baselines.
 *
 * Selection never throws: if the bank has no usable coverage for the learner's
 * cell it returns an empty array and `createBaseline` falls through to the
 * existing LLM → BANK ladder.
 */
import type {
  BaselineBankFunctioningLevel,
  BaselineBankItem,
  BaselineBankSubjectKey,
  BaselineDifficulty,
  BaselineQuestion,
  GradeBand,
  Skill,
  Subject,
} from "@/lib/db/types";
import { newId } from "@/lib/db/store";
import { LLM_TO_WEB_V2_SUBJECT_SLUG } from "@/lib/learner/baseline-llm";
import bankData from "@/lib/learner/baseline-bank.generated.json";

/** ai-svc subject taxonomy key (re-exported from db/types for callers). */
export type BankSubjectKey = BaselineBankSubjectKey;

/** Functioning level as carried on the brain profile state (uppercase enum). */
export type BankFunctioningLevel = BaselineBankFunctioningLevel;

/** Grade band, mirroring `GradeBand` in db/types. */
export type BankGradeBand = GradeBand;

export type { BaselineBankItem };

export type BaselineBankFile = {
  /** Schema/version marker so the generator can evolve the shape safely. */
  version: number;
  /** Model that produced the bank (provenance for the "Personalized by AI" badge). */
  model: string;
  generatedAt: string;
  items: BaselineBankItem[];
};

const BANK_FILE = bankData as unknown as BaselineBankFile;

// Ordered so "nearest cell" fallback can walk outward when an exact
// (gradeBand, functioningLevel) cell is sparse or empty.
const GRADE_ORDER: BankGradeBand[] = [
  "preK",
  "K",
  "1-2",
  "3-5",
  "6-8",
  "9-12",
  "post_secondary",
];

// Functioning levels from most to least scaffolded. Fallback always walks
// toward STANDARD (a learner who needs more support should never be served a
// LESS-supported item; we only borrow from adjacent levels when a cell is thin).
const LEVEL_ORDER: BankFunctioningLevel[] = [
  "STANDARD",
  "SUPPORTED",
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
];

const DIFFICULTY_ORDER: BaselineDifficulty[] = [
  "foundational",
  "approaching",
  "grade_level",
  "stretch",
];

const WEB_V2_TO_BANK_SUBJECT: Record<string, BankSubjectKey> = Object.entries(
  LLM_TO_WEB_V2_SUBJECT_SLUG,
).reduce(
  (acc, [llmKey, webSlug]) => {
    acc[webSlug] = llmKey as BankSubjectKey;
    return acc;
  },
  {} as Record<string, BankSubjectKey>,
);

/** Default questions per subject in a baseline (mirrors ai-svc's 6/subject). */
export const DEFAULT_BANK_PER_SUBJECT = 6;

/** Mulberry32 — tiny deterministic PRNG so tests can pin the shuffle. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function normalizeGradeBand(input: string | null | undefined): BankGradeBand {
  if (input && (GRADE_ORDER as string[]).includes(input)) {
    return input as BankGradeBand;
  }
  // Sensible default for an unknown/missing band: the middle of the range.
  return "3-5";
}

function normalizeFunctioningLevel(
  input: string | null | undefined,
): BankFunctioningLevel {
  const up = (input ?? "").toUpperCase();
  if ((LEVEL_ORDER as string[]).includes(up)) return up as BankFunctioningLevel;
  // db/types `FunctioningLevel` uses "alternative" for the brain-state
  // "LOW_VERBAL" tier; map it so either spelling resolves.
  if (up === "ALTERNATIVE") return "LOW_VERBAL";
  return "STANDARD";
}

/**
 * Gather candidate bank items for a subject, walking outward from the exact
 * (gradeBand, functioningLevel) cell when it's thin. Returns items annotated
 * with a `distance` (lower = closer to the requested cell) so the selector can
 * prefer exact-cell matches but still fill from neighbours rather than fail.
 */
function candidatesForSubject(
  items: BaselineBankItem[],
  subject: BankSubjectKey,
  gradeBand: BankGradeBand,
  level: BankFunctioningLevel,
): BaselineBankItem[] {
  const gi = GRADE_ORDER.indexOf(gradeBand);
  const li = LEVEL_ORDER.indexOf(level);
  const scored: { item: BaselineBankItem; distance: number }[] = [];
  for (const item of items) {
    if (item.subject !== subject) continue;
    const dg = Math.abs(GRADE_ORDER.indexOf(item.gradeBand) - gi);
    const dl = Math.abs(LEVEL_ORDER.indexOf(item.functioningLevel) - li);
    // Weight grade distance higher than level distance: a same-grade item at a
    // neighbouring support level is usually a better fit than a far-grade item
    // at the exact level.
    scored.push({ item, distance: dg * 2 + dl });
  }
  scored.sort((a, b) => a.distance - b.distance);
  return scored.map((s) => s.item);
}

export type SelectBaselineFromBankInput = {
  baselineId: string;
  gradeBand: string | null;
  functioningLevel: string | null;
  /** Resolved web-v2 subjects for this baseline. */
  subjects: Subject[];
  /** Resolved skills for those subjects (first skill per subject anchors the question). */
  skills: Skill[];
  accommodationTags: string[];
  perSubject?: number;
  /** Inject a deterministic RNG in tests; defaults to a baselineId-seeded PRNG. */
  rng?: () => number;
  /** Override the bank items entirely (tests); defaults to the committed file. */
  bankItems?: BaselineBankItem[];
  /**
   * Additional bank items merged with the committed seed file — this is how
   * the daily-grown DB bank (web_baseline_bank) is folded in without a
   * rebuild. Ignored when `bankItems` is provided (full override).
   */
  extraBankItems?: BaselineBankItem[];
};

/** True when the bank has at least one usable item (cheap guard for callers). */
export function bankHasItems(): boolean {
  return BANK_FILE.items.length > 0;
}

/** Provenance string for `generationMetadata.model` on bank-sourced baselines. */
export function bankModel(): string {
  return `bank/${BANK_FILE.model}`;
}

/**
 * Select a difficulty-spread, randomised set of questions per subject from the
 * pre-generated bank. Returns `[]` when no subject has any coverage, signalling
 * the caller to fall through to the live LLM / hardcoded BANK ladder.
 */
export function selectBaselineFromBank(
  input: SelectBaselineFromBankInput,
): BaselineQuestion[] {
  const perSubject = input.perSubject ?? DEFAULT_BANK_PER_SUBJECT;
  const gradeBand = normalizeGradeBand(input.gradeBand);
  const level = normalizeFunctioningLevel(input.functioningLevel);
  const rng = input.rng ?? mulberry32(hashString(input.baselineId));
  const items =
    input.bankItems ??
    (input.extraBankItems && input.extraBankItems.length > 0
      ? [...BANK_FILE.items, ...input.extraBankItems]
      : BANK_FILE.items);

  const firstSkillBySubjectId = new Map<string, Skill>();
  for (const sk of input.skills) {
    if (!firstSkillBySubjectId.has(sk.subjectId)) {
      firstSkillBySubjectId.set(sk.subjectId, sk);
    }
  }

  const out: BaselineQuestion[] = [];
  let order = 0;

  for (const subject of input.subjects) {
    const bankSubject = WEB_V2_TO_BANK_SUBJECT[subject.slug];
    if (!bankSubject) continue;
    const skill = firstSkillBySubjectId.get(subject.id);
    if (!skill) continue;

    const candidates = candidatesForSubject(items, bankSubject, gradeBand, level);
    if (candidates.length === 0) continue;

    const picked = pickDifficultySpread(candidates, perSubject, rng);
    for (const item of picked) {
      order += 1;
      const choiceEmojis =
        item.choiceEmojis && item.choiceEmojis.some((e) => e.length > 0)
          ? item.choiceEmojis
          : undefined;
      out.push({
        id: newId("bq"),
        baselineId: input.baselineId,
        subjectId: subject.id,
        skillId: skill.id,
        order,
        prompt: item.prompt,
        choices: item.choices,
        choiceEmojis,
        sceneEmoji: item.sceneEmoji,
        expectedAnswer: item.expectedAnswer,
        hint: item.hint,
        readAloudText: item.readAloudText,
        difficulty: item.difficulty,
        accommodationTags: input.accommodationTags,
      });
    }
  }

  return out;
}

/**
 * Pick up to `count` items spread across difficulty bands (easy → hard) for a
 * calm ramp, then top up with the remaining best-fit candidates. Within each
 * band the choice is randomised so repeated baselines vary ("dynamic
 * behaviour"). Candidates are pre-sorted by cell distance, so de-duping by
 * prompt keeps the closest-cell phrasing first.
 */
function pickDifficultySpread(
  candidates: BaselineBankItem[],
  count: number,
  rng: () => number,
): BaselineBankItem[] {
  const byDifficulty = new Map<BaselineDifficulty, BaselineBankItem[]>();
  const seenPrompts = new Set<string>();
  for (const item of candidates) {
    const key = item.prompt.trim().toLowerCase();
    if (seenPrompts.has(key)) continue;
    seenPrompts.add(key);
    const list = byDifficulty.get(item.difficulty) ?? [];
    list.push(item);
    byDifficulty.set(item.difficulty, list);
  }
  for (const list of byDifficulty.values()) shuffleInPlace(list, rng);

  const picked: BaselineBankItem[] = [];
  // One pass per difficulty band (foundational → stretch) for a ramp.
  for (const diff of DIFFICULTY_ORDER) {
    if (picked.length >= count) break;
    const list = byDifficulty.get(diff);
    if (list && list.length > 0) picked.push(list.shift()!);
  }
  // Top up from whatever remains, easiest-first, until we hit the target.
  for (const diff of DIFFICULTY_ORDER) {
    if (picked.length >= count) break;
    const list = byDifficulty.get(diff) ?? [];
    while (list.length > 0 && picked.length < count) picked.push(list.shift()!);
  }
  return picked;
}
