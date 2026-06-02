/**
 * Phase 1 (weekly curriculum sync): server-side helper that turns a pasted /
 * uploaded school syllabus into a structured `CurriculumFocus`.
 *
 * Primary path: calls `ai-svc /api/ai/curriculum/parse` (the same endpoint
 * tutor-svc uses) with the internal trust token. When ai-svc is not configured
 * or the call fails, it degrades to a deterministic local heuristic so the
 * parent/teacher upload flow always works — they can then edit the result
 * before saving.
 *
 * Browser code MUST NOT import this module (it references the internal token).
 * Always go through a `/api/bff/.../curriculum/...` route handler.
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import type { CurriculumFocus } from "@/lib/db/types";

const VALID_SUBJECTS = new Set([
  "math",
  "ela",
  "reading",
  "writing",
  "science",
  "history",
  "social",
  "coding",
  "speech",
  "sel",
  "art",
  "life",
  "other",
]);

export function normalizeSubject(s: unknown): string {
  const v = String(s ?? "other")
    .toLowerCase()
    .trim();
  return VALID_SUBJECTS.has(v) ? v : "other";
}

function strList(v: unknown, limit: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0)
    .slice(0, limit);
}

function isoDateOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export type ParseInput = {
  text?: string;
  /** base64-encoded image/pdf (no data: prefix). */
  imageBase64?: string;
  mimeType?: string;
  hintedSubject?: string;
  hintedWeekStart?: string;
  hintedWeekEnd?: string;
};

export type ParseResult = { focus: CurriculumFocus; rawText: string; usedFallback: boolean };

const MAX_TEXT_LEN = 32000;

/**
 * Local, dependency-free extraction used when ai-svc is unavailable. Splits the
 * text into candidate topic lines and pulls likely standard codes. Intentionally
 * conservative — the human reviews/edits before saving.
 */
function heuristicParse(input: ParseInput): ParseResult {
  const text = (input.text ?? "").slice(0, MAX_TEXT_LEN);
  const lines = text
    .split(/\r?\n|•|•|;/)
    .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((l) => l.length >= 3 && l.length <= 120);
  const topics = Array.from(new Set(lines)).slice(0, 10);
  const standards = Array.from(new Set(text.match(/\b[A-Z]{2,}[.-][A-Z0-9.-]{2,}\b/g) ?? [])).slice(
    0,
    20,
  );
  const subject = normalizeSubject(input.hintedSubject);
  const summary =
    topics.length > 0
      ? `This week's focus includes: ${topics.slice(0, 3).join("; ")}.`
      : "Weekly curriculum focus (please review the details below).";
  return {
    focus: {
      title: topics[0] ? topics[0].slice(0, 120) : "This week's lessons",
      subject,
      weekStart: isoDateOrNull(input.hintedWeekStart),
      weekEnd: isoDateOrNull(input.hintedWeekEnd),
      topics,
      keywords: [],
      standards,
      skills: [],
      summary,
      confidence: 0,
    },
    rawText: text,
    usedFallback: true,
  };
}

/** Parse a syllabus into a structured CurriculumFocus (AI with local fallback). */
export async function parseCurriculumFocus(input: ParseInput): Promise<ParseResult> {
  const aiUrl = serverEnv.AI_SVC_URL;
  const token = serverEnv.INTERNAL_AI_TOKEN;
  // No token configured → don't attempt the upstream call; use the heuristic.
  // In production this is a misconfiguration worth surfacing (the AI parse is
  // the intended path), but we still degrade gracefully so the human-reviewed
  // upload flow never hard-fails.
  if (!token) {
    logger.warn(
      { feature: "weekly-curriculum-parse" },
      "[curriculum-parse] INTERNAL_AI_TOKEN unset — using local heuristic fallback",
    );
    return heuristicParse(input);
  }

  try {
    const res = await fetch(`${aiUrl}/api/ai/curriculum/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth": token,
      },
      body: JSON.stringify({
        text: input.text ? input.text.slice(0, MAX_TEXT_LEN) : null,
        image_base64: input.imageBase64 || null,
        mime_type: input.mimeType || "image/jpeg",
        hinted_subject: input.hintedSubject ? normalizeSubject(input.hintedSubject) : null,
        hinted_week_start: input.hintedWeekStart || null,
        hinted_week_end: input.hintedWeekEnd || null,
      }),
      signal: AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(
        { feature: "weekly-curriculum-parse", status: res.status },
        "[curriculum-parse] ai-svc returned non-OK — using local heuristic fallback",
      );
      return heuristicParse(input);
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      focus: {
        title:
          typeof data.title === "string" && data.title.trim()
            ? data.title.trim()
            : "This week's lessons",
        subject: normalizeSubject(data.subject ?? input.hintedSubject),
        weekStart: isoDateOrNull(data.weekStart ?? input.hintedWeekStart),
        weekEnd: isoDateOrNull(data.weekEnd ?? input.hintedWeekEnd),
        topics: strList(data.topics, 50),
        keywords: strList(data.keywords, 100),
        standards: strList(data.standards, 50),
        skills: strList(data.skills, 50),
        summary: typeof data.summary === "string" ? data.summary.slice(0, 2000) : "",
        confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
      },
      rawText:
        typeof data.raw_text === "string"
          ? data.raw_text
          : (input.text ?? "").slice(0, MAX_TEXT_LEN),
      usedFallback: false,
    };
  } catch (err) {
    logger.warn(
      {
        feature: "weekly-curriculum-parse",
        err: err instanceof Error ? err.message : String(err),
      },
      "[curriculum-parse] ai-svc call failed — using local heuristic fallback",
    );
    return heuristicParse(input);
  }
}

/**
 * Normalize a client-edited focus (from the preview step) into a safe,
 * clamped CurriculumFocus before persisting. Confidence is forced to 1 since a
 * human reviewed it.
 */
export function sanitizeEditedFocus(raw: unknown, subjectHint: string): CurriculumFocus {
  const pf = (raw ?? {}) as Record<string, unknown>;
  return {
    title:
      typeof pf.title === "string" && pf.title.trim()
        ? pf.title.trim().slice(0, 200)
        : "This week's lessons",
    subject: normalizeSubject(pf.subject ?? subjectHint),
    weekStart: isoDateOrNull(pf.weekStart),
    weekEnd: isoDateOrNull(pf.weekEnd),
    topics: strList(pf.topics, 50),
    keywords: strList(pf.keywords, 100),
    standards: strList(pf.standards, 50),
    skills: strList(pf.skills, 50),
    summary: typeof pf.summary === "string" ? pf.summary.slice(0, 2000) : "",
    confidence: 1,
  };
}
