/**
 * In-memory Speech Buddy consent store — the dev/mock fallback used by the
 * parent consent UI when family-svc is not wired (mirrors the dual-path the
 * billing surface uses). In production (`AIVO_USE_FAMILY_SVC` /
 * `AIVO_USE_SERVICE_STACK` on, real token present) the BFF talks to
 * family-svc's `speech_buddy_consents` table instead.
 *
 * Process-local and lost on restart — acceptable for the demo/dev path,
 * which is the only place this store is read.
 */

export type SpeechBuddyConsentRecord = {
  id: string;
  tenantId: string;
  learnerId: string;
  ageBand: string;
  scope: "speech_buddy";
  grantedAt: string;
};

const AGE_BANDS = ["6-9", "10-12", "13-15"];

// Keyed by `${tenantId}:${learnerId}` — only the active grant is retained.
const store = new Map<string, SpeechBuddyConsentRecord>();

function key(tenantId: string, learnerId: string): string {
  return `${tenantId}:${learnerId}`;
}

export function isValidAgeBand(value: unknown): value is string {
  return typeof value === "string" && AGE_BANDS.includes(value);
}

export function getStoredConsent(
  tenantId: string,
  learnerId: string,
): SpeechBuddyConsentRecord | null {
  return store.get(key(tenantId, learnerId)) ?? null;
}

export function grantStoredConsent(
  tenantId: string,
  learnerId: string,
  ageBand: string,
): SpeechBuddyConsentRecord {
  const record: SpeechBuddyConsentRecord = {
    id: `sbc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    learnerId,
    ageBand,
    scope: "speech_buddy",
    grantedAt: new Date().toISOString(),
  };
  store.set(key(tenantId, learnerId), record);
  return record;
}

export function revokeStoredConsent(tenantId: string, learnerId: string): void {
  store.delete(key(tenantId, learnerId));
}
