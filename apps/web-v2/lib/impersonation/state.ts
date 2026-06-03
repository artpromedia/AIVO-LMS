import { cookies } from "next/headers";

/**
 * Secure Impersonation ("View As") active-session state.
 *
 * web-v2 uses mock sessions, so the active impersonation is modelled with an
 * HTTP cookie named `aivo_impersonation` containing the JSON shape below. The
 * START BFF sets it (httpOnly:false so the banner countdown can read endsAt);
 * the STOP BFF clears it.
 */
export const IMPERSONATION_COOKIE = "aivo_impersonation";

export type ImpersonationState = {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  subjectRole: string;
  /** ISO-8601 timestamp at which the impersonation session expires. */
  endsAt: string;
  allowWrites: boolean;
  reason: string;
};

function parseState(raw: string | undefined): ImpersonationState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ImpersonationState>;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.subjectId !== "string" ||
      typeof parsed.endsAt !== "string"
    ) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      subjectId: parsed.subjectId,
      subjectName: parsed.subjectName ?? parsed.subjectId,
      subjectRole: parsed.subjectRole ?? "unknown",
      endsAt: parsed.endsAt,
      allowWrites: Boolean(parsed.allowWrites),
      reason: parsed.reason ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Read the active impersonation state from the `aivo_impersonation` cookie.
 * Returns null when the cookie is absent, malformed, or already expired.
 */
export async function getImpersonationState(): Promise<ImpersonationState | null> {
  const jar = await cookies();
  const state = parseState(jar.get(IMPERSONATION_COOKIE)?.value);
  if (!state) return null;
  const endsAtMs = new Date(state.endsAt).getTime();
  if (Number.isNaN(endsAtMs) || endsAtMs <= Date.now()) return null;
  return state;
}
