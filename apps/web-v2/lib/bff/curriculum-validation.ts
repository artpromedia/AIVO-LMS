/**
 * Syllabus ↔ jurisdiction validation client (Sprint 7, G8).
 *
 * Calls curriculum-svc `POST /api/curriculum/validate` to check an uploaded
 * syllabus's topics/standards against the learner's jurisdiction-approved
 * packs. Off-curriculum items come back flagged so the UI can badge them.
 *
 * Best-effort: a curriculum-svc outage returns `null` and the caller marks
 * units `unvalidated` rather than blocking the save.
 */
import { serverEnv } from "@/lib/env";

export interface JurisdictionLocator {
  country?: string;
  region?: string;
  postalCode?: string;
  districtId?: string;
  zipCode?: string;
}

export interface ValidationResponse {
  jurisdictionDistrictId: string;
  frameworkCode: string;
  matched: Array<{ kind: string; input: string; skillId: string }>;
  unmatched: Array<{ kind: string; input: string; reason: string }>;
  suggestions: Array<{ input: string; candidates: string[] }>;
  offCurriculumCount: number;
}

function serviceHeaders(): Record<string, string> {
  const token = serverEnv.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token";
  return { "content-type": "application/json", "X-Service-Token": token };
}

/** True when the locator can identify a jurisdiction (US zip/district or a country). */
export function hasJurisdiction(loc: JurisdictionLocator): boolean {
  return Boolean(loc.country || loc.postalCode || loc.zipCode || loc.districtId);
}

/**
 * Validate topics/standards against the jurisdiction's approved packs.
 * Returns `null` if the jurisdiction is unknown or curriculum-svc is
 * unreachable (caller degrades to `unvalidated`).
 */
export async function validateAgainstJurisdiction(input: {
  jurisdiction: JurisdictionLocator;
  subject: string;
  gradeBand: string;
  topics: string[];
  standards: string[];
}): Promise<ValidationResponse | null> {
  if (!hasJurisdiction(input.jurisdiction)) return null;
  if (input.topics.length === 0 && input.standards.length === 0) return null;

  try {
    const res = await fetch(`${serverEnv.CURRICULUM_SVC_URL}/api/curriculum/validate`, {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({
        country: input.jurisdiction.country,
        region: input.jurisdiction.region,
        postalCode: input.jurisdiction.postalCode,
        zipCode: input.jurisdiction.zipCode,
        districtId: input.jurisdiction.districtId,
        subject: input.subject,
        gradeBand: input.gradeBand,
        topics: input.topics,
        standards: input.standards,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ValidationResponse;
  } catch {
    return null;
  }
}
