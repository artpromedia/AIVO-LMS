/**
 * Surface-aware baseline scoring (Sprint 03).
 *
 * Each surface kind has its own correctness rule. The legacy MCQ
 * pipeline keeps working unchanged; new surface kinds get focused
 * scoring helpers so a geometry construction or a scratchpad numeric
 * answer can earn credit even when the response shape differs from a
 * plain string choice.
 */

import type {
  LearnerSurfaceKind,
  LearnerSurfaceSpec,
  NormalizedBaselineItem,
} from "./baselineSurfaceNormalizer.js";

export interface BaselineResponse {
  itemId: string;
  surface: LearnerSurfaceSpec;
  /** Raw payload from the runtime. Shape depends on surface kind. */
  response: unknown;
  /** Optional latency, used by future analytics. */
  responseTimeMs?: number;
}

export interface ScoredResponse {
  itemId: string;
  surface: LearnerSurfaceKind;
  outcome: "correct" | "incorrect" | "partial" | "skipped";
  score: number;          // 0..1
  evidence?: string;      // human-readable reason (debug only)
}

function normalise(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function scoreMcq(item: NormalizedBaselineItem, response: unknown): ScoredResponse {
  const expected = normalise(item.correctAnswer);
  const got = normalise(response);
  const correct = expected !== "" && got === expected;
  return {
    itemId: item.id,
    surface: "multiple_choice",
    outcome: !got ? "skipped" : correct ? "correct" : "incorrect",
    score: correct ? 1 : 0,
    evidence: `expected=${expected} got=${got}`,
  };
}

function scoreScratchpad(item: NormalizedBaselineItem, response: unknown): ScoredResponse {
  // response shape: { finalAnswer: string, scratchInk?: ... }
  const raw =
    response && typeof response === "object"
      ? (response as Record<string, unknown>).finalAnswer
      : response;
  const expected = normalise(
    typeof item.expectedAnswer === "string" || typeof item.expectedAnswer === "number"
      ? item.expectedAnswer
      : item.correctAnswer,
  );
  const got = normalise(raw);
  if (!got) {
    return { itemId: item.id, surface: "scratchpad", outcome: "skipped", score: 0 };
  }
  if (expected === "") {
    // No canonical answer — partial credit for engagement.
    return {
      itemId: item.id,
      surface: "scratchpad",
      outcome: "partial",
      score: 0.5,
      evidence: "no expected answer available",
    };
  }
  const correct = got === expected;
  return {
    itemId: item.id,
    surface: "scratchpad",
    outcome: correct ? "correct" : "incorrect",
    score: correct ? 1 : 0,
    evidence: `expected=${expected} got=${got}`,
  };
}

function scoreGeometry(item: NormalizedBaselineItem, response: unknown): ScoredResponse {
  // Geometry tasks declare an `expectedAnswer` object. We do a structural
  // exact-match in this sprint; richer fuzzy scoring lands in Sprint 05.
  const expected = item.expectedAnswer;
  if (expected === undefined || expected === null) {
    return {
      itemId: item.id,
      surface: "geometry_workspace",
      outcome: "partial",
      score: 0.5,
      evidence: "no expected answer; awarding partial credit for engagement",
    };
  }
  if (response === undefined || response === null) {
    return { itemId: item.id, surface: "geometry_workspace", outcome: "skipped", score: 0 };
  }
  const a = JSON.stringify(expected);
  const b = JSON.stringify(response);
  const correct = a === b;
  return {
    itemId: item.id,
    surface: "geometry_workspace",
    outcome: correct ? "correct" : "incorrect",
    score: correct ? 1 : 0,
  };
}

function scoreTextResponse(item: NormalizedBaselineItem, response: unknown): ScoredResponse {
  const got = typeof response === "string" ? response.trim() : "";
  if (!got) {
    return { itemId: item.id, surface: "text_response", outcome: "skipped", score: 0 };
  }
  // Free text is hand-graded; auto-score as partial so it surfaces in the
  // reviewer queue but doesn't tank the mastery percentage.
  return {
    itemId: item.id,
    surface: "text_response",
    outcome: "partial",
    score: 0.5,
    evidence: "queued for human review",
  };
}

function scoreObservation(item: NormalizedBaselineItem): ScoredResponse {
  return {
    itemId: item.id,
    surface: "observation",
    outcome: "partial",
    score: 0.5,
    evidence: "observational item; caregiver-recorded",
  };
}

const SCORERS: Partial<
  Record<LearnerSurfaceKind, (item: NormalizedBaselineItem, response: unknown) => ScoredResponse>
> = {
  multiple_choice: scoreMcq,
  tap_image: scoreMcq,
  drag_sort: scoreMcq,
  sequence: scoreMcq,
  pattern_fill: scoreMcq,
  scratchpad: scoreScratchpad,
  geometry_workspace: scoreGeometry,
  text_response: scoreTextResponse,
  observation: (item) => scoreObservation(item),
};

/**
 * Score one response against its item using the surface-specific rule.
 */
export function scoreResponse(
  item: NormalizedBaselineItem,
  resp: BaselineResponse,
): ScoredResponse {
  const fn = SCORERS[item.surface.kind] ?? scoreMcq;
  return fn(item, resp.response);
}

/**
 * Score a batch and roll up a per-domain mastery summary.
 */
export function scoreBatch(
  items: NormalizedBaselineItem[],
  responses: BaselineResponse[],
): {
  scored: ScoredResponse[];
  totals: { correct: number; partial: number; incorrect: number; skipped: number };
  domainScores: Record<string, number>;
} {
  const byId = new Map(items.map((i) => [i.id, i]));
  const scored: ScoredResponse[] = [];
  const totals = { correct: 0, partial: 0, incorrect: 0, skipped: 0 };

  for (const r of responses) {
    const item = byId.get(r.itemId);
    if (!item) continue;
    const s = scoreResponse(item, r);
    scored.push(s);
    totals[s.outcome] += 1;
  }

  const perDomain: Record<string, { sum: number; n: number }> = {};
  for (const s of scored) {
    const item = byId.get(s.itemId);
    const domain = (item?.domain as string) || "general";
    const bucket = perDomain[domain] ?? (perDomain[domain] = { sum: 0, n: 0 });
    bucket.sum += s.score;
    bucket.n += 1;
  }

  const domainScores: Record<string, number> = {};
  for (const [domain, { sum, n }] of Object.entries(perDomain)) {
    domainScores[domain] = n > 0 ? Math.round((sum / n) * 100) : 0;
  }

  return { scored, totals, domainScores };
}
