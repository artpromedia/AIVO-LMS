/**
 * Consent ledger (Sprint 5). Append-style: each grant/revoke is a new
 * record; the current state for a (subject, consentType) is the latest
 * row. Models COPPA verifiable parental consent — the `actorId`/`method`
 * capture who verified and how. In-memory like the other Sprint-5 stores;
 * the Postgres `consents` table backs it in production.
 */
import { randomUUID } from "node:crypto";

export interface ConsentRecord {
  id: string;
  tenantId: string | null;
  subjectId: string;
  subjectType: string;
  consentType: string;
  granted: boolean;
  actorId: string | null;
  actorRole: string | null;
  method: string | null;
  policyVersion: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface RecordConsentInput {
  tenantId?: string | null;
  subjectId: string;
  subjectType?: string;
  consentType: string;
  granted: boolean;
  actorId?: string | null;
  actorRole?: string | null;
  method?: string | null;
  policyVersion?: string | null;
}

const ledger: ConsentRecord[] = [];

export function clearConsentStoreForTest(): void {
  ledger.length = 0;
}

export function recordConsent(input: RecordConsentInput): ConsentRecord {
  const rec: ConsentRecord = {
    id: randomUUID(),
    tenantId: input.tenantId ?? null,
    subjectId: input.subjectId,
    subjectType: input.subjectType ?? "learner",
    consentType: input.consentType,
    granted: input.granted,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    method: input.method ?? null,
    policyVersion: input.policyVersion ?? null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };
  ledger.push(rec);
  return rec;
}

/** Revoke the latest active grant for (subject, consentType). */
export function revokeConsent(args: {
  subjectId: string;
  consentType: string;
  actorId?: string | null;
  actorRole?: string | null;
}): ConsentRecord | null {
  const revocation = recordConsent({
    subjectId: args.subjectId,
    consentType: args.consentType,
    granted: false,
    actorId: args.actorId,
    actorRole: args.actorRole,
    method: "revocation",
  });
  revocation.revokedAt = revocation.createdAt;
  return revocation;
}

export interface ConsentSearch {
  subjectId?: string;
  consentType?: string;
  tenantScope?: string[];
}

export function searchConsents(search: ConsentSearch = {}): ConsentRecord[] {
  return ledger
    .filter((c) => (search.subjectId ? c.subjectId === search.subjectId : true))
    .filter((c) => (search.consentType ? c.consentType === search.consentType : true))
    .filter((c) =>
      search.tenantScope ? c.tenantId !== null && search.tenantScope.includes(c.tenantId) : true,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Current effective grant state per consentType for a subject. */
export function currentConsents(subjectId: string): Record<string, boolean> {
  const latest = new Map<string, ConsentRecord>();
  for (const c of ledger.filter((c) => c.subjectId === subjectId)) {
    const prev = latest.get(c.consentType);
    if (!prev || c.createdAt > prev.createdAt) latest.set(c.consentType, c);
  }
  const out: Record<string, boolean> = {};
  for (const [type, rec] of latest) out[type] = rec.granted;
  return out;
}
