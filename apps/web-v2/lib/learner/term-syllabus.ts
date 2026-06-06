/**
 * Whole-term syllabus client helpers (Sprint 6, G7).
 *
 * Calls ai-svc `POST /api/ai/curriculum/parse-term` to turn an uploaded
 * full-term document into an ordered scope-&-sequence, and provides pure
 * helpers to flatten that into persistable units, summarise it for preview,
 * and validate it. The pure helpers are unit-tested with no network.
 */
import { serverEnv } from "@/lib/env";

/** Shape returned by ai-svc /parse-term. */
export interface TermParseUnit {
  title: string;
  duration_weeks: number;
  topics: string[];
  learning_objectives: string[];
  standards_addressed: string[];
  key_vocabulary: string[];
}

export interface TermParseBlock {
  term_number: number;
  title?: string | null;
  units: TermParseUnit[];
}

export interface TermParseResult {
  subject: string | null;
  source: string;
  total_terms: number;
  unit_count: number;
  terms: TermParseBlock[];
}

/** A unit flattened into the persistence shape (`term_syllabus_units`). */
export interface FlattenedTermUnit {
  termNumber: number;
  orderIndex: number;
  title: string;
  durationWeeks: number;
  topics: string[];
  objectives: string[];
  standards: string[];
  vocabulary: string[];
}

/** Flatten a parse result into ordered, persistable units. */
export function flattenToUnits(result: TermParseResult): FlattenedTermUnit[] {
  const out: FlattenedTermUnit[] = [];
  let order = 0;
  for (const term of result.terms ?? []) {
    for (const unit of term.units ?? []) {
      out.push({
        termNumber: term.term_number,
        orderIndex: order++,
        title: unit.title,
        durationWeeks: Math.max(1, Math.trunc(unit.duration_weeks ?? 1)),
        topics: unit.topics ?? [],
        objectives: unit.learning_objectives ?? [],
        standards: unit.standards_addressed ?? [],
        vocabulary: unit.key_vocabulary ?? [],
      });
    }
  }
  return out;
}

export interface TermSummary {
  unitCount: number;
  totalWeeks: number;
  termCount: number;
  standardsCount: number;
}

/** A preview summary (how many dated weeks the upload will produce). */
export function summarizeTerm(result: TermParseResult): TermSummary {
  const units = flattenToUnits(result);
  const standards = new Set<string>();
  let totalWeeks = 0;
  for (const u of units) {
    totalWeeks += u.durationWeeks;
    for (const s of u.standards) standards.add(s);
  }
  return {
    unitCount: units.length,
    totalWeeks,
    termCount: result.total_terms ?? result.terms?.length ?? 0,
    standardsCount: standards.size,
  };
}

/** Validate a parse result before save. Returns an array of error strings. */
export function validateTermParse(result: TermParseResult | null | undefined): string[] {
  const errors: string[] = [];
  if (!result) {
    errors.push("No parse result.");
    return errors;
  }
  const units = flattenToUnits(result);
  if (units.length === 0) {
    errors.push("The document produced no week/unit content.");
  }
  if (units.some((u) => !u.title.trim())) {
    errors.push("Every unit must have a title.");
  }
  return errors;
}

/**
 * Request a term parse from ai-svc. Falls back to throwing a typed error if
 * the service is unreachable; the BFF surfaces that to the caller. The
 * heuristic fallback lives in ai-svc so even an LLM-less parse succeeds.
 */
export async function requestTermParse(input: {
  text: string;
  subject?: string;
  termCount?: number;
}): Promise<TermParseResult> {
  const aiUrl = serverEnv.AI_SVC_URL;
  const token = serverEnv.INTERNAL_AI_TOKEN;
  const res = await fetch(`${aiUrl}/api/ai/curriculum/parse-term`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "X-Internal-Auth": token } : {}),
    },
    body: JSON.stringify({
      text: input.text,
      subject: input.subject ?? null,
      term_count: input.termCount ?? 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`ai-svc parse-term failed: ${res.status}`);
  }
  return (await res.json()) as TermParseResult;
}
