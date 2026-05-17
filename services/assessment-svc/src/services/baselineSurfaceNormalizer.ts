/**
 * Baseline surface normalizer (Sprint 03).
 *
 * Coerces incoming baseline items (from ai-svc generation, from cached
 * payloads, from older clients) into the surface-aware shape the rest of
 * the assessment runtime expects. Items missing a `surface` field are
 * defaulted to `multiple_choice`. Items with an unknown kind are
 * rejected.
 *
 * Mirrors services/ai-svc/src/ai_svc/services/baseline_surface_contract.py.
 */

export type LearnerSurfaceKind =
  | "multiple_choice"
  | "tap_image"
  | "drag_sort"
  | "sequence"
  | "pattern_fill"
  | "scratchpad"
  | "geometry_workspace"
  | "text_response"
  | "observation";

export const ALL_SURFACE_KINDS: readonly LearnerSurfaceKind[] = [
  "multiple_choice",
  "tap_image",
  "drag_sort",
  "sequence",
  "pattern_fill",
  "scratchpad",
  "geometry_workspace",
  "text_response",
  "observation",
];

export interface LearnerSurfaceSpec {
  kind: LearnerSurfaceKind;
  config?: Record<string, unknown>;
}

export interface NormalizedBaselineItem {
  id: string;
  domain?: string;
  skill?: string;
  question?: string;
  options?: Array<{ label: string; value: string; emoji?: string; isCorrect?: boolean }>;
  correctAnswer?: string;
  difficulty?: number | string;
  surface: LearnerSurfaceSpec;
  expectedAnswer?: unknown;
  brainMeasures?: string[];
  [extra: string]: unknown;
}

export interface NormalizationIssue {
  itemId: string;
  rule: string;
  message: string;
  severity: "error" | "warning";
}

export interface NormalizationResult {
  items: NormalizedBaselineItem[];
  issues: NormalizationIssue[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceSurface(raw: unknown): LearnerSurfaceSpec | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string") {
    return (ALL_SURFACE_KINDS as readonly string[]).includes(raw)
      ? { kind: raw as LearnerSurfaceKind }
      : null;
  }
  if (!isObject(raw)) return null;
  const kind = raw.kind;
  if (typeof kind !== "string" || !(ALL_SURFACE_KINDS as readonly string[]).includes(kind)) {
    return null;
  }
  const spec: LearnerSurfaceSpec = { kind: kind as LearnerSurfaceKind };
  if (isObject(raw.config)) spec.config = raw.config;
  return spec;
}

/**
 * Normalise a list of raw baseline items.
 *
 * Items with no surface are coerced to `multiple_choice` and a warning is
 * recorded. Items with an unknown surface kind are dropped with an error.
 */
export function normalizeBaselineItems(raw: unknown[]): NormalizationResult {
  const items: NormalizedBaselineItem[] = [];
  const issues: NormalizationIssue[] = [];

  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const itemId = typeof entry.id === "string" ? entry.id : "<no-id>";

    let spec = coerceSurface(entry.surface);
    if (spec === null) {
      if (entry.surface === undefined || entry.surface === null) {
        issues.push({
          itemId,
          rule: "surface.missing",
          message: "item omitted `surface`; defaulting to multiple_choice",
          severity: "warning",
        });
        spec = { kind: "multiple_choice" };
      } else {
        issues.push({
          itemId,
          rule: "surface.unknown_kind",
          message: `unknown surface kind: ${JSON.stringify(entry.surface)}`,
          severity: "error",
        });
        continue;
      }
    }

    const normalized: NormalizedBaselineItem = {
      ...(entry as Record<string, unknown>),
      id: itemId,
      surface: spec,
    } as NormalizedBaselineItem;

    // MCQ-specific safety: when the item carries the legacy
    // `{options:[{value,isCorrect}]}` shape, ensure correctAnswer is
    // populated. Discovery chapter activities use a richer
    // `{choices, scoring}` shape and are passed through untouched.
    if (
      spec.kind === "multiple_choice" &&
      !normalized.correctAnswer &&
      Array.isArray(normalized.options) &&
      normalized.options.length > 0
    ) {
      const opts = normalized.options;
      const correct = opts.find((o) => o && (o as any).isCorrect);
      if (correct && typeof (correct as any).value === "string") {
        normalized.correctAnswer = (correct as any).value;
      } else {
        issues.push({
          itemId,
          rule: "mcq.correct_answer",
          message: "multiple_choice item missing correctAnswer",
          severity: "error",
        });
        continue;
      }
    }

    items.push(normalized);
  }

  return { items, issues };
}

export function isSurfaceKind(value: unknown): value is LearnerSurfaceKind {
  return typeof value === "string" && (ALL_SURFACE_KINDS as readonly string[]).includes(value);
}
