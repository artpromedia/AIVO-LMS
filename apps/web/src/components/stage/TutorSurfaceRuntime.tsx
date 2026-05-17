/**
 * TutorSurfaceRuntime — Sprint 04 web client bridge.
 *
 * Replaces the lesson stage's local ``generateDemoBeats`` with a real
 * fetch against tutor-svc's ``POST /api/tutor/:tutorKey/surface-beats``.
 *
 * No demo fallback ever: on any failure this function throws so the
 * caller can surface a real error UI. Returning hardcoded beats here
 * would re-introduce the production-scan regression Sprint 04 closes.
 */

import type { Beat } from "./types";

export interface FetchTutorSurfaceBeatsArgs {
  tutorKey: string;
  learnerId: string;
  functioningLevel?: string;
  accessToken?: string;
  maxActivities?: number;
  signal?: AbortSignal;
  /** Override for tests / SSR. Defaults to "" (same-origin proxy). */
  baseUrl?: string;
}

export interface TutorSurfaceBeatsRationale {
  skillId: string;
  reason: string;
}

export interface TutorSurfaceBeatsResult {
  beats: Beat[];
  meta: {
    tutorId: string;
    learnerId: string;
    functioningLevel: string;
    activityCount: number;
    rationale: TutorSurfaceBeatsRationale[];
  };
}

/**
 * Fetch beats for a real tutor session from tutor-svc. Throws on any
 * non-2xx response or on malformed payloads. Callers MUST handle the
 * error — there is no demo fallback in production.
 */
export async function fetchTutorSurfaceBeats(
  args: FetchTutorSurfaceBeatsArgs,
): Promise<TutorSurfaceBeatsResult> {
  const { tutorKey, learnerId, functioningLevel, accessToken, maxActivities, signal } = args;
  if (!tutorKey) throw new Error("fetchTutorSurfaceBeats: tutorKey is required");
  if (!learnerId) throw new Error("fetchTutorSurfaceBeats: learnerId is required");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const base = args.baseUrl ?? "";
  const url = `${base}/api/tutor/${encodeURIComponent(tutorKey)}/surface-beats`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    signal,
    body: JSON.stringify({
      learnerId,
      functioningLevel,
      maxActivities,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = typeof errBody?.error === "string" ? errBody.error : JSON.stringify(errBody);
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(
      `tutor surface beats request failed (${response.status}): ${detail || "unknown error"}`,
    );
  }

  const payload = (await response.json()) as TutorSurfaceBeatsResult | undefined;
  if (!payload || !Array.isArray(payload.beats) || payload.beats.length === 0) {
    throw new Error("tutor surface beats response was empty");
  }
  return payload;
}
