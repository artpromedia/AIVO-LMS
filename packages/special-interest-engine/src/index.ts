import type {
  InterestSlug,
  InterestTheme,
  LearnerInterestProfile,
  LearnerInterestSignal,
} from "./types.js";
import { SEED_THEMES } from "./seeds/themes.js";

export type {
  InterestSlug,
  InterestTheme,
  LearnerInterestProfile,
  LearnerInterestSignal,
} from "./types.js";
export { SEED_THEMES } from "./seeds/themes.js";

/** Source-of-evidence weight applied when scoring an interest. Caregiver
 * intake is the most authoritative; passive engagement signal is weakest. */
const SOURCE_WEIGHT: Record<LearnerInterestSignal["source"], number> = {
  caregiver_intake: 1.0,
  iep_signal: 0.9,
  self_report: 0.8,
  engagement: 0.5,
  system: 0.3,
};

/**
 * Half-life for an interest signal in days. Older signals decay so the
 * engine prefers recently-confirmed interests. Set to 180d so a one-year-
 * old caregiver intake is worth ~25% of a fresh one.
 */
const HALFLIFE_DAYS = 180;

export interface ScoredInterest {
  slug: InterestSlug;
  /** 0…1 — composite score after weighting and decay. */
  score: number;
  /** True if any signal had polarity = -1 (avoid). */
  blocked: boolean;
  signalCount: number;
}

/**
 * Score every interest the learner has any signal for. Blocked interests
 * are returned with `blocked: true` and a score of 0; the runtime should
 * never theme content with a blocked interest even if score > 0.
 */
export function scoreInterests(
  profile: LearnerInterestProfile,
  now: Date = new Date(),
): ScoredInterest[] {
  const bySlug = new Map<InterestSlug, LearnerInterestSignal[]>();
  for (const sig of profile.signals) {
    if (!bySlug.has(sig.slug)) bySlug.set(sig.slug, []);
    bySlug.get(sig.slug)!.push(sig);
  }

  const out: ScoredInterest[] = [];
  for (const [slug, signals] of bySlug) {
    const blocked = signals.some((s) => s.polarity === -1);
    if (blocked) {
      out.push({ slug, score: 0, blocked: true, signalCount: signals.length });
      continue;
    }
    let score = 0;
    for (const s of signals) {
      const ageDays = Math.max(0, (now.getTime() - new Date(s.observedAt).getTime()) / 86_400_000);
      const decay = Math.pow(0.5, ageDays / HALFLIFE_DAYS);
      score += s.polarity * s.confidence * (SOURCE_WEIGHT[s.source] ?? 0.5) * decay;
    }
    // Normalize: a learner with two strong (polarity=1, confidence=1, source=intake)
    // signals scores ~2.0 before clamp, which clamps to 1.0.
    score = Math.max(0, Math.min(1, score));
    out.push({ slug, score, blocked: false, signalCount: signals.length });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export interface PickThemeOptions {
  /** Limit themes to those appropriate for this age band. */
  ageBand?: InterestTheme["ageBands"][number];
  /** Pool of themes to consider. Defaults to `SEED_THEMES`. */
  themes?: readonly InterestTheme[];
  /** Drop themes that carry these sensory cautions. */
  excludeCautions?: readonly NonNullable<InterestTheme["sensoryCautions"]>[number][];
  /** Minimum score to consider a theme; below this, return null. */
  minScore?: number;
}

/**
 * Pick the highest-scoring theme that is (a) safe (not blocked, no
 * disallowed sensory caution), (b) age-appropriate, and (c) actually has
 * a registered theme entry. Returns `null` when nothing qualifies — the
 * runtime should fall back to neutral content.
 */
export function pickTheme(
  profile: LearnerInterestProfile,
  opts: PickThemeOptions = {},
  now: Date = new Date(),
): InterestTheme | null {
  const themes = opts.themes ?? SEED_THEMES;
  const minScore = opts.minScore ?? 0.1;
  const excludeCautions = new Set(opts.excludeCautions ?? []);
  const blocked = new Set<InterestSlug>();
  for (const s of profile.signals) {
    if (s.polarity === -1) blocked.add(s.slug);
  }
  const scored = scoreInterests(profile, now);
  for (const sc of scored) {
    if (sc.blocked) continue;
    if (blocked.has(sc.slug)) continue;
    if (sc.score < minScore) continue;
    const theme = themes.find((t) => t.slug === sc.slug);
    if (!theme) continue;
    if (opts.ageBand && !theme.ageBands.includes(opts.ageBand)) continue;
    if (theme.sensoryCautions?.some((c) => excludeCautions.has(c))) continue;
    return theme;
  }
  return null;
}

/**
 * Apply a theme to a prompt template. The template uses `{{noun}}` and
 * `{{verb}}` placeholders. With multiple `{{noun}}` placeholders the
 * engine fills each with a *different* noun (sampled deterministically by
 * the supplied `rng` so tests are reproducible).
 */
export function applyTheme(
  template: string,
  theme: InterestTheme,
  rng: () => number = Math.random,
): string {
  if (!theme.nouns.length) return template;
  const usedNouns = new Set<string>();
  let result = template;

  result = result.replace(/\{\{noun\}\}/g, () => {
    const candidates = theme.nouns.filter((n) => !usedNouns.has(n));
    const pool = candidates.length > 0 ? candidates : theme.nouns;
    const pick = pool[Math.floor(rng() * pool.length)];
    usedNouns.add(pick);
    return pick;
  });
  result = result.replace(/\{\{verb\}\}/g, () => {
    if (!theme.verbs.length) return "";
    return theme.verbs[Math.floor(rng() * theme.verbs.length)];
  });
  return result;
}

/**
 * Resolve a generic asset role (e.g. `"character-1"`) into a themed asset
 * id (e.g. `"dinos/character-1"`). The caller resolves the returned id
 * against the content pack's `assets[]`.
 */
export function resolveThemedAssetId(role: string, theme: InterestTheme): string | null {
  if (theme.assetNamespaces.length === 0) return null;
  return `${theme.assetNamespaces[0]}/${role}`;
}
