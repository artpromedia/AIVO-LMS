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
  ConsentVersion,
  DataDeletionRequest,
  DataExportRequest,
  DataInventoryItem,
  DataRetentionPolicy,
  DisclosureLog,
  IEPDocument,
  IEPDocumentAccessLog,
  PolicyVersion,
  SubprocessorRecord,
  TermsAcceptance,
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
        c.parentUserId === parentUserId && c.learnerId === learnerId && c.tenantId === tenantId,
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

  // ── Sprint 5: privacy / DSAR / terms ──────────────────────────────
  async listConsentVersions(): Promise<ConsentVersion[]> {
    return Array.from(getStore().consentVersions.values());
  },
  async appendTermsAcceptance(acceptance): Promise<TermsAcceptance> {
    getStore().termsAcceptances.push(acceptance);
    return acceptance;
  },
  async listDataInventory(): Promise<DataInventoryItem[]> {
    return Array.from(getStore().dataInventory.values());
  },
  async listRetentionPolicies(): Promise<DataRetentionPolicy[]> {
    return Array.from(getStore().dataRetentionPolicies.values());
  },
  async getRetentionPolicy(id): Promise<DataRetentionPolicy | null> {
    return getStore().dataRetentionPolicies.get(id) ?? null;
  },
  async upsertRetentionPolicy(policy): Promise<DataRetentionPolicy> {
    getStore().dataRetentionPolicies.set(policy.id, policy);
    return policy;
  },
  async appendDisclosure(entry): Promise<DisclosureLog> {
    getStore().disclosureLogs.push(entry);
    return entry;
  },
  async listDisclosures(tenantId): Promise<DisclosureLog[]> {
    return getStore()
      .disclosureLogs.filter((d) => d.tenantId === tenantId)
      .sort((a, b) => b.disclosedAt.localeCompare(a.disclosedAt));
  },
  async upsertExportRequest(request): Promise<DataExportRequest> {
    getStore().dataExportRequests.set(request.id, request);
    return request;
  },
  async getExportRequestById(id): Promise<DataExportRequest | null> {
    return getStore().dataExportRequests.get(id) ?? null;
  },
  async listExportRequests(): Promise<DataExportRequest[]> {
    return Array.from(getStore().dataExportRequests.values());
  },
  async upsertDeletionRequest(request): Promise<DataDeletionRequest> {
    getStore().dataDeletionRequests.set(request.id, request);
    return request;
  },
  async getDeletionRequestById(id): Promise<DataDeletionRequest | null> {
    return getStore().dataDeletionRequests.get(id) ?? null;
  },
  async listDeletionRequests(): Promise<DataDeletionRequest[]> {
    return Array.from(getStore().dataDeletionRequests.values());
  },
  async appendIepAccessLog(entry): Promise<IEPDocumentAccessLog> {
    getStore().iepDocumentAccessLogs.push(entry);
    return entry;
  },
  async listIepAccessForLearner(learnerId, tenantId): Promise<IEPDocumentAccessLog[]> {
    return getStore()
      .iepDocumentAccessLogs.filter((r) => r.learnerId === learnerId && r.tenantId === tenantId)
      .sort((a, b) => b.accessedAt.localeCompare(a.accessedAt));
  },
};
