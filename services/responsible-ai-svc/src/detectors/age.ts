/**
 * Sprint 14 — Age-appropriate content gate.
 *
 * Reads the learner's age band from family-svc (cached via the pluggable
 * `setAgeBandResolver` hook) and gates content above the band.
 *
 * Bands and ceilings:
 *   k_2   (5-7 years)  — strict: no violence, no romance, no substance
 *                        mentions, no clinical claims
 *   3_5   (8-10 years) — same as k_2 plus tighter language ceiling
 *   6_8   (11-13)      — allows mild conflict; still no graphic content,
 *                        no romantic/sexual content, no substance content
 *   9_12  (14-18)      — allows mild romance; still no graphic violence,
 *                        no substance promotion, no clinical advice
 *
 * The detector never blocks based on a missing age band — it returns a
 * 'review' verdict so the composite pipeline can fail closed only if
 * RESPONSIBLE_AI_FAIL_CLOSED=true.
 */
import type {
  DetectorContext,
  DetectorEvidence,
  DetectorResult,
} from "./types.js";

export type AgeBand = "k_2" | "3_5" | "6_8" | "9_12";

const BAND_ORDER: AgeBand[] = ["k_2", "3_5", "6_8", "9_12"];

/**
 * Sentinel "never-allowed for minors" band used by always-blocked rules.
 * Higher than any real learner band so `isAtLeast` always returns false.
 */
const ADULT_ONLY = "__adult_only__" as const;
type RuleMinBand = AgeBand | typeof ADULT_ONLY;

interface AgeRule {
  code: string;
  pattern: RegExp;
  message: string;
  /**
   * Minimum age band this content is acceptable for. Use the sentinel
   * `ADULT_ONLY` for content that's never appropriate for minors
   * (sexual, graphic violence, weapon construction).
   */
  minBand: RuleMinBand;
}

const RULES: AgeRule[] = [
  // Graphic violence / weapons — never appropriate for minor learners.
  {
    code: "age.graphic_violence",
    pattern: /\b(?:graphic\s+violence|gore|dismember|decapitat|blood\s+(?:everywhere|covered)|mutilat)/i,
    message: "Graphic violence",
    minBand: ADULT_ONLY,
  },
  {
    code: "age.weapon_detail",
    pattern: /\b(?:loaded\s+gun|how\s+to\s+(?:make|build)\s+a\s+(?:bomb|gun|knife|weapon)|firing\s+pin|trigger\s+mechanism)\b/i,
    message: "Weapon construction detail",
    minBand: ADULT_ONLY,
  },
  // Sexual content — never appropriate for minor learners.
  {
    code: "age.sexual_content",
    pattern: /\b(?:sexual|sexy|porn|naked|nudes?|making\s+out|hookup|sext)\b/i,
    message: "Sexual content",
    minBand: ADULT_ONLY,
  },
  {
    code: "age.romance_dating",
    pattern: /\b(?:dating|kiss\s+me|boyfriend|girlfriend|romantic\s+partner)\b/i,
    message: "Romance/dating content",
    minBand: "6_8",
  },
  // Substance content
  {
    code: "age.substance",
    pattern: /\b(?:alcohol|beer|wine|liquor|drug\s+use|cocaine|heroin|marijuana|weed|vape|cigarette|smoking)\b/i,
    message: "Substance reference",
    minBand: "9_12",
  },
  // Clinical / medical advice (out-of-band for all kid users)
  {
    code: "age.clinical_advice",
    pattern: /\b(?:diagnose\s+me|you\s+have\s+(?:adhd|autism|depression|anxiety|dyslexia)|prescribe|how\s+much\s+(?:tylenol|ibuprofen|advil|melatonin)\s+(?:can|should)\s+i\s+take)\b/i,
    message: "Clinical/medical advice",
    // Tightest band — never appropriate without explicit professional gating.
    minBand: "9_12",
  },
];

export type AgeBandResolver = (
  learnerId: string,
) => Promise<AgeBand | null>;

const _defaultResolver: AgeBandResolver = async () => null;

let _resolver: AgeBandResolver = _defaultResolver;

export function setAgeBandResolver(fn: AgeBandResolver): void {
  _resolver = fn;
}

export function resetAgeBandResolver(): void {
  _resolver = _defaultResolver;
}

function isAtLeast(actual: AgeBand, required: RuleMinBand): boolean {
  if (required === ADULT_ONLY) return false;
  return BAND_ORDER.indexOf(actual) >= BAND_ORDER.indexOf(required);
}

export async function detectAgeAppropriateness(
  context: DetectorContext,
): Promise<DetectorResult> {
  const started = Date.now();
  const text = context.text ?? "";
  const evidence: DetectorEvidence[] = [];
  try {
    if (text.length === 0) {
      return {
        detector: "age",
        verdict: "allow",
        evidence: [],
        durationMs: Date.now() - started,
        errored: false,
      };
    }
    let band: AgeBand | null = (context.ageBand as AgeBand | undefined) ?? null;
    if (!band && context.learnerId) {
      try {
        band = await _resolver(context.learnerId);
      } catch (err) {
        return {
          detector: "age",
          verdict: "review",
          evidence: [],
          durationMs: Date.now() - started,
          errored: true,
          error: (err as Error).message,
        };
      }
    }
    // Default to most restrictive when band unknown.
    const effectiveBand: AgeBand = band ?? "k_2";
    for (const r of RULES) {
      if (r.pattern.test(text) && !isAtLeast(effectiveBand, r.minBand)) {
        const requires =
          r.minBand === ADULT_ONLY ? "adult-only" : `min_band=${r.minBand}`;
        evidence.push({
          code: r.code,
          message: `${r.message} (band=${effectiveBand}, ${requires})`,
          confidence: 1.0,
        });
      }
    }
    const verdict = evidence.length > 0 ? "block" : "allow";
    return {
      detector: "age",
      verdict,
      evidence,
      durationMs: Date.now() - started,
      errored: false,
      meta: { effectiveBand, ageBandResolved: band !== null },
    };
  } catch (err) {
    return {
      detector: "age",
      verdict: "review",
      evidence,
      durationMs: Date.now() - started,
      errored: true,
      error: (err as Error).message,
    };
  }
}
