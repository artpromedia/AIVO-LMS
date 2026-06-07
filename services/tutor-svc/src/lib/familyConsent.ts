/**
 * Speech Buddy parent-consent gate.
 *
 * Calls family-svc's internal consent endpoint with the tutor-svc internal
 * key. Returns the consent record id on success or throws a typed error.
 *
 * The full consent management UI + storage table land in the next task
 * (Speech Buddy child UI + consent + dashboards). This client deliberately
 * keeps the surface minimal so swapping in the real store is a no-op for
 * tutor-svc.
 *
 * Local dev / tests can short-circuit with `SPEECH_BUDDY_DEV_CONSENTS`,
 * format: "tenant1:learner1:consent1,tenant2:learner2:consent2".
 */

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`tutor-svc: ${name} must be set in production`);
  return devDefault;
}
const FAMILY_SVC_URL = requireUrl("FAMILY_SVC_URL", "http://localhost:3007");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

export class ConsentError extends Error {
  status: number;
  constructor(msg: string, status = 403) {
    super(msg);
    this.status = status;
  }
}

function devLookup(tenantId: string, learnerId: string, tutorKey?: string): string | null {
  // SPEECH_BUDDY_DEV_CONSENTS is the legacy single-tutor format kept for
  // backward compatibility. TUTOR_DEV_CONSENTS adds an optional 4th
  // segment scoping the consent to a specific tutor key.
  const buddyRaw = process.env.SPEECH_BUDDY_DEV_CONSENTS || "";
  const tutorRaw = process.env.TUTOR_DEV_CONSENTS || "";
  for (const raw of [tutorRaw, buddyRaw]) {
    if (!raw) continue;
    for (const entry of raw.split(",")) {
      const [t, l, c, k] = entry.trim().split(":");
      if (t === tenantId && l === learnerId && c) {
        // If the entry pins a tutor key, only honour it for that tutor.
        if (k && tutorKey && k !== tutorKey) continue;
        return c;
      }
    }
  }
  return null;
}

export async function verifyConsent(args: {
  tenantId: string;
  learnerId: string;
  ageBand: "3-5" | "6-9" | "10-12" | "13-15";
}): Promise<string> {
  const dev = devLookup(args.tenantId, args.learnerId);
  if (dev) return dev;
  const url = `${FAMILY_SVC_URL}/api/family/internal/speech-buddy/consent/verify`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-key": INTERNAL_KEY,
    },
    body: JSON.stringify(args),
  });
  if (res.status === 404) {
    throw new ConsentError("No Speech Buddy consent on file for this learner.", 403);
  }
  if (!res.ok) {
    throw new ConsentError(`Consent check failed (status ${res.status})`, 502);
  }
  const body = (await res.json()) as { consentRecordId?: string; granted?: boolean };
  if (!body.granted || !body.consentRecordId) {
    throw new ConsentError("Speech Buddy consent has been revoked.", 403);
  }
  return body.consentRecordId;
}

/**
 * Generic per-tutor consent gate.
 *
 * Used by the generic `/api/tutors/:tutorKey/plan` route to verify that
 * a consent-required tutor (Harmony, Compass, Pixel, Vigor, Echo, …)
 * has an active family consent on file. The contract intentionally
 * mirrors `verifyConsent` so existing family-svc infra is reused.
 *
 * Returns the consent record id on success; throws `ConsentError` on
 * any failure (the route maps that to HTTP 403/502).
 *
 * Dev / test short-circuit: set `TUTOR_DEV_CONSENTS` to a comma-list
 * of `tenant:learner:consentId[:tutorKey]` entries. The optional 4th
 * segment scopes a record to a single tutor key.
 */
export async function verifyTutorConsent(args: {
  tenantId: string;
  learnerId: string;
  tutorKey: string;
  ageBand?: "3-5" | "6-9" | "10-12" | "13-15";
}): Promise<string> {
  const dev = devLookup(args.tenantId, args.learnerId, args.tutorKey);
  if (dev) return dev;
  const url = `${FAMILY_SVC_URL}/api/family/internal/tutor/consent/verify`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": INTERNAL_KEY,
      },
      body: JSON.stringify(args),
    });
  } catch (err) {
    throw new ConsentError(
      `Consent check failed: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }
  if (res.status === 404) {
    throw new ConsentError(`No consent on file for tutor "${args.tutorKey}".`, 403);
  }
  if (!res.ok) {
    throw new ConsentError(`Consent check failed (status ${res.status})`, 502);
  }
  const body = (await res.json()) as { consentRecordId?: string; granted?: boolean };
  if (!body.granted || !body.consentRecordId) {
    throw new ConsentError(`Consent for tutor "${args.tutorKey}" has been revoked.`, 403);
  }
  return body.consentRecordId;
}

export const __testing = { devLookup };
