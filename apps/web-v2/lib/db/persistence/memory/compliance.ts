/**
 * In-memory ComplianceStore — wraps consentRecords / iepDocuments /
 * ageGateRecords / policyVersions / subprocessors from the legacy
 * Map store.
 *
 * The "active consent" filter mirrors the legacy precedence:
 * per-learner consent wins over account-wide consent, both must be
 * non-revoked, and only the most recent non-revoked record counts.
 */
import { getStore } from "@/lib/db/store";
import type {
  AgeGateRecord,
  ConsentRecord,
  IEPDocument,
  PolicyVersion,
  SubprocessorRecord,
} from "@/lib/db/types";
import type { ComplianceStore } from "../types";

function isActive(c: ConsentRecord): boolean {
  return c.revokedAt === null;
}

export const memoryCompliance: ComplianceStore = {
  async getActiveConsentForUser(parentUserId, consentType, tenantId, learnerId) {
    let best: ConsentRecord | null = null;
    for (const c of getStore().consentRecords) {
      if (c.parentUserId !== parentUserId) continue;
      if (c.tenantId !== tenantId) continue;
      if (c.consentType !== consentType) continue;
      // Scope match: learner-specific vs account-wide.
      if (c.learnerId !== (learnerId ?? null)) continue;
      if (!isActive(c)) continue;
      if (!best || c.acceptedAt > best.acceptedAt) best = c;
    }
    return best;
  },

  async listConsentsForUser(parentUserId, tenantId) {
    return getStore().consentRecords.filter(
      (c) => c.parentUserId === parentUserId && c.tenantId === tenantId,
    );
  },

  async listConsentsForLearner(parentUserId, learnerId, tenantId) {
    return getStore().consentRecords.filter(
      (c) =>
        c.parentUserId === parentUserId &&
        c.learnerId === learnerId &&
        c.tenantId === tenantId,
    );
  },

  async upsertConsent(record) {
    const store = getStore();
    const idx = store.consentRecords.findIndex((c) => c.id === record.id);
    if (idx >= 0) {
      store.consentRecords[idx] = record;
    } else {
      store.consentRecords.push(record);
    }
    return record;
  },

  async getIEPForLearner(learnerId, tenantId) {
    for (const doc of getStore().iepDocuments.values()) {
      if (doc.learnerId === learnerId && doc.tenantId === tenantId) return doc;
    }
    return null;
  },

  async upsertIEP(doc: IEPDocument) {
    getStore().iepDocuments.set(doc.id, doc);
    return doc;
  },

  async deleteIEP(learnerId, tenantId) {
    const store = getStore();
    for (const [id, doc] of store.iepDocuments) {
      if (doc.learnerId === learnerId && doc.tenantId === tenantId) {
        store.iepDocuments.delete(id);
        return true;
      }
    }
    return false;
  },

  async getAgeGateForLearner(learnerId, tenantId) {
    // The legacy Map is keyed by learnerId, not by record id.
    const r = getStore().ageGateRecords.get(learnerId);
    if (!r || r.tenantId !== tenantId) return null;
    return r;
  },

  async upsertAgeGate(record: AgeGateRecord) {
    // Match the legacy keying: by learnerId, not record id.
    getStore().ageGateRecords.set(record.learnerId, record);
    return record;
  },

  async listPolicyVersions(): Promise<PolicyVersion[]> {
    return Array.from(getStore().policyVersions.values()).sort((a, b) =>
      a.kind.localeCompare(b.kind),
    );
  },

  async listSubprocessors(): Promise<SubprocessorRecord[]> {
    return Array.from(getStore().subprocessors.values());
  },
};
