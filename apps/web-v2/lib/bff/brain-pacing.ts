/**
 * Phase 2b — automated weekly pacing as a curriculum-focus source.
 *
 * brain-svc owns the dated `learner_pacing_*` plan (generated from the district
 * scope-&-sequence). This module is web-v2's server-side client for brain-svc's
 * pacing endpoints: when no parent/teacher has uploaded a "this week at school"
 * plan (Phase 1), lesson generation falls back to the current pacing week so the
 * tutor still teaches the right topics for the learner's school week.
 *
 * Authenticates as a trusted service via the shared `INTERNAL_SERVICE_TOKEN`
 * (`x-service-token`); brain-svc resolves the learner's tenant itself.
 *
 * Browser code MUST NOT import this module (it references the service token).
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import type { CurriculumFocus } from "@/lib/db/types";

export function isPacingLive(): boolean {
  return Boolean(serverEnv.INTERNAL_SERVICE_TOKEN);
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-service-token": serverEnv.INTERNAL_SERVICE_TOKEN ?? "",
  };
}

function base(): string {
  return serverEnv.BRAIN_SVC_URL.replace(/\/$/, "");
}

type PacingWeek = {
  weekIndex: number;
  weekStart: string | null;
  weekEnd: string | null;
  kind: string;
  termNumber: number | null;
  unitTitle: string | null;
  topics: unknown;
  standards: unknown;
  objectives: unknown;
  vocabulary: unknown;
  status: string;
};

type HolidayPrep = {
  review_topics?: unknown;
  review_standards?: unknown;
  review_vocabulary?: unknown;
  preview_topics?: unknown;
  preview_standards?: unknown;
  preview_vocabulary?: unknown;
  prior_unit_title?: string | null;
  next_unit_title?: string | null;
};

type SummerBridge = HolidayPrep & {
  /** The NEXT grade band the preview units belong to (Wave D, G6). */
  next_grade_band?: string | null;
};

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter((s) => s.trim().length > 0) : [];
}

function isoDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Build a holiday-prep CurriculumFocus from a break week's review/preview
 * payload: review recent units + preview the next so the learner stays ready
 * for school resumption. Returns null when there's nothing to prep with.
 */
export function holidayPrepToFocus(
  prep: HolidayPrep | null | undefined,
  week: PacingWeek | null,
  subject: string,
): CurriculumFocus | null {
  if (!prep) return null;
  const reviewTopics = strList(prep.review_topics);
  const previewTopics = strList(prep.preview_topics);
  if (reviewTopics.length === 0 && previewTopics.length === 0) return null;
  const nextUnit = (prep.next_unit_title ?? "").trim();
  const title = nextUnit ? `Holiday prep: get ready for ${nextUnit}` : "Holiday prep";
  const summaryParts: string[] = [];
  if (reviewTopics.length) summaryParts.push(`review ${reviewTopics.slice(0, 3).join("; ")}`);
  if (previewTopics.length) summaryParts.push(`preview ${previewTopics.slice(0, 2).join("; ")}`);
  return {
    title,
    subject,
    weekStart: isoDate(week?.weekStart),
    weekEnd: isoDate(week?.weekEnd),
    // Topics blend review (first, to warm up) then preview (to look ahead).
    topics: [...reviewTopics, ...previewTopics],
    keywords: [...strList(prep.review_vocabulary), ...strList(prep.preview_vocabulary)],
    standards: [...strList(prep.review_standards), ...strList(prep.preview_standards)],
    skills: previewTopics,
    summary: summaryParts.length ? `School's on a break — ${summaryParts.join(", and ")}.` : title,
    confidence: 1,
    mode: "holiday_prep",
  };
}

/**
 * Build a summer-bridge CurriculumFocus from a summer-break payload
 * (Wave D, G6): review the closing grade's recent work, then preview the
 * NEXT grade band's opening catalogue units, framed as next-grade
 * readiness. Returns null when there's no next-grade preview — the
 * caller then uses the plain holiday-prep focus.
 */
export function summerBridgeToFocus(
  bridge: SummerBridge | null | undefined,
  week: PacingWeek | null,
  subject: string,
): CurriculumFocus | null {
  if (!bridge) return null;
  const previewTopics = strList(bridge.preview_topics);
  if (previewTopics.length === 0) return null;
  const reviewTopics = strList(bridge.review_topics);
  const band = (bridge.next_grade_band ?? "").trim();
  const title = band ? `Summer bridge: get ready for Grade ${band}` : "Summer bridge";
  const summaryParts: string[] = [];
  if (reviewTopics.length) summaryParts.push(`review ${reviewTopics.slice(0, 3).join("; ")}`);
  summaryParts.push(
    `get a head start on ${band ? `Grade ${band}` : "next grade"}: ${previewTopics.slice(0, 2).join("; ")}`,
  );
  return {
    title,
    subject,
    weekStart: isoDate(week?.weekStart),
    weekEnd: isoDate(week?.weekEnd),
    // Review first (warm up on the closing grade), then the next-grade preview.
    topics: [...reviewTopics, ...previewTopics],
    keywords: [...strList(bridge.review_vocabulary), ...strList(bridge.preview_vocabulary)],
    standards: [...strList(bridge.review_standards), ...strList(bridge.preview_standards)],
    skills: previewTopics,
    summary: `School's out for summer — ${summaryParts.join(", and ")}.`,
    confidence: 1,
    mode: "summer_bridge",
  };
}

/**
 * Map an instructional pacing week into a CurriculumFocus. Returns null for a
 * non-instructional week (break weeks are handled by `holidayPrepToFocus`).
 */
export function weekToFocus(week: PacingWeek | null, subject: string): CurriculumFocus | null {
  if (!week || week.kind !== "instruction") return null;
  const topics = strList(week.topics);
  const objectives = strList(week.objectives);
  if (topics.length === 0 && !week.unitTitle) return null;
  const title = week.unitTitle?.trim() || topics[0] || "This week's lessons";
  return {
    title,
    subject,
    weekStart: isoDate(week.weekStart),
    weekEnd: isoDate(week.weekEnd),
    topics,
    keywords: strList(week.vocabulary),
    standards: strList(week.standards),
    skills: objectives,
    summary: topics.length ? `This week's school plan: ${topics.slice(0, 3).join("; ")}.` : title,
    // District-aligned pacing is authoritative, not an AI guess.
    confidence: 1,
    mode: "school_sync",
  };
}

/** Fetch the current pacing week for a (learner, subject) from brain-svc. */
export async function brainPacingFocus(
  learnerId: string,
  subject: string,
  on?: string,
): Promise<CurriculumFocus | null> {
  const params = new URLSearchParams({ subject });
  if (on) params.set("on", on);
  const res = await fetch(
    `${base()}/api/brain/pacing/${encodeURIComponent(learnerId)}/pacing/current?${params}`,
    { headers: headers(), signal: AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS) },
  );
  if (!res.ok) throw new Error(`brain-svc pacing/current failed (${res.status})`);
  const data = (await res.json()) as {
    current?: PacingWeek | null;
    holidayPrep?: HolidayPrep | null;
    summerBridge?: SummerBridge | null;
  };
  const current = data.current ?? null;
  // A break week becomes a holiday-prep lesson (review + preview); during
  // an opted-in SUMMER break the next-grade bridge wins (Wave D, G6); an
  // instructional week syncs to the school topic.
  if (current && current.kind !== "instruction") {
    return (
      summerBridgeToFocus(data.summerBridge, current, subject) ??
      holidayPrepToFocus(data.holidayPrep, current, subject)
    );
  }
  return weekToFocus(current, subject);
}

/**
 * Best-effort pacing focus for lesson generation — never throws. Returns null
 * when pacing isn't configured (no service token) or brain-svc is unreachable,
 * so a lesson always generates (just without school sync).
 */
export async function brainPacingFocusSafe(
  learnerId: string,
  subject: string,
  on?: string,
): Promise<CurriculumFocus | null> {
  if (!isPacingLive()) return null;
  try {
    return await brainPacingFocus(learnerId, subject, on);
  } catch (err) {
    logger.warn(
      {
        feature: "weekly-pacing",
        learnerId,
        subject,
        err: err instanceof Error ? err.message : String(err),
      },
      "[brain-pacing] pacing focus read failed — generating without pacing sync",
    );
    return null;
  }
}
