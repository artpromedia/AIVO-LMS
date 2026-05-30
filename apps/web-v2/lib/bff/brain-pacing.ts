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

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter((s) => s.trim().length > 0) : [];
}

function isoDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Map an instructional pacing week into a CurriculumFocus. Returns null for a
 * non-instructional week (e.g. `kind="break"` — holidays are handled by the
 * Phase 4 holiday-prep track, not by syncing a normal lesson).
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
    summary: topics.length
      ? `This week's school plan: ${topics.slice(0, 3).join("; ")}.`
      : title,
    // District-aligned pacing is authoritative, not an AI guess.
    confidence: 1,
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
  const data = (await res.json()) as { current?: PacingWeek | null };
  return weekToFocus(data.current ?? null, subject);
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
