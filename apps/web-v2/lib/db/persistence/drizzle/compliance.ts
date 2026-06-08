/**
 * Drizzle-backed ComplianceStore. Consent reads are the hot path (every
 * BFF guard). Mirrors the memory store's active-consent precedence
 * (scope match on learnerId, non-revoked, most-recent acceptedAt wins)
 * and the learnerId-keyed age-gate table.
 */
import { and, eq } from "drizzle-orm";
import {
  webConsentRecords,
  webIepDocuments,
  webAgeGateRecords,
  webPolicyVersions,
  webSubprocessors,
  webConsentVersions,
  webTermsAcceptances,
  webDataInventory,
  webDataRetentionPolicies,
  webDisclosureLogs,
  webDataExportRequests,
  webDataDeletionRequests,
  webIepDocAccessLogs,
} from "@aivo/db";
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
import { getDb } from "./client";

export const drizzleCompliance: ComplianceStore = {
  async getActiveConsentForUser(parentUserId, consentType, tenantId, learnerId) {
    const rows = await getDb()
      .select()
      .from(webConsentRecords)
      .where(
        and(
          eq(webConsentRecords.parentUserId, parentUserId),
          eq(webConsentRecords.tenantId, tenantId),
        ),
      );
    let best: ConsentRecord | null = null;
    for (const r of rows) {
      const c = r.data as ConsentRecord;
      if (c.consentType !== consentType) continue;
      if (c.learnerId !== (learnerId ?? null)) continue;
      if (c.revokedAt !== null) continue;
      if (!best || c.acceptedAt > best.acceptedAt) best = c;
    }
    return best;
  },

  async listConsentsForUser(parentUserId, tenantId) {
    const rows = await getDb()
      .select()
      .from(webConsentRecords)
      .where(
        and(
          eq(webConsentRecords.parentUserId, parentUserId),
          eq(webConsentRecords.tenantId, tenantId),
        ),
      );
    return rows.map((r) => r.data as ConsentRecord);
  },

  async listConsentsForLearner(parentUserId, learnerId, tenantId) {
    const rows = await getDb()
      .select()
      .from(webConsentRecords)
      .where(
        and(
          eq(webConsentRecords.parentUserId, parentUserId),
          eq(webConsentRecords.tenantId, tenantId),
        ),
      );
    return rows.map((r) => r.data as ConsentRecord).filter((c) => c.learnerId === learnerId);
  },

  async upsertConsent(record) {
    const db = getDb();
    await db
      .insert(webConsentRecords)
      .values({
        id: record.id,
        parentUserId: record.parentUserId,
        learnerId: record.learnerId,
        tenantId: record.tenantId,
        data: record,
      })
      .onConflictDoUpdate({
        target: webConsentRecords.id,
        set: {
          parentUserId: record.parentUserId,
          learnerId: record.learnerId,
          tenantId: record.tenantId,
          data: record,
        },
      });
    return record;
  },

  async getIEPForLearner(learnerId, tenantId) {
    const [row] = await getDb()
      .select()
      .from(webIepDocuments)
      .where(and(eq(webIepDocuments.learnerId, learnerId), eq(webIepDocuments.tenantId, tenantId)))
      .limit(1);
    return row ? (row.data as IEPDocument) : null;
  },

  async upsertIEP(doc) {
    const db = getDb();
    await db
      .insert(webIepDocuments)
      .values({ id: doc.id, learnerId: doc.learnerId, tenantId: doc.tenantId, data: doc })
      .onConflictDoUpdate({
        target: webIepDocuments.id,
        set: { learnerId: doc.learnerId, tenantId: doc.tenantId, data: doc },
      });
    return doc;
  },

  async deleteIEP(learnerId, tenantId) {
    const deleted = await getDb()
      .delete(webIepDocuments)
      .where(and(eq(webIepDocuments.learnerId, learnerId), eq(webIepDocuments.tenantId, tenantId)))
      .returning({ id: webIepDocuments.id });
    return deleted.length > 0;
  },

  async getAgeGateForLearner(learnerId, tenantId) {
    const [row] = await getDb()
      .select()
      .from(webAgeGateRecords)
      .where(
        and(eq(webAgeGateRecords.learnerId, learnerId), eq(webAgeGateRecords.tenantId, tenantId)),
      )
      .limit(1);
    return row ? (row.data as AgeGateRecord) : null;
  },

  async upsertAgeGate(record) {
    const db = getDb();
    await db
      .insert(webAgeGateRecords)
      .values({ learnerId: record.learnerId, tenantId: record.tenantId, data: record })
      .onConflictDoUpdate({
        target: webAgeGateRecords.learnerId,
        set: { tenantId: record.tenantId, data: record },
      });
    return record;
  },

  async listPolicyVersions() {
    const rows = await getDb().select().from(webPolicyVersions);
    return rows.map((r) => r.data as PolicyVersion).sort((a, b) => a.kind.localeCompare(b.kind));
  },

  async listSubprocessors() {
    const rows = await getDb().select().from(webSubprocessors);
    return rows.map((r) => r.data as SubprocessorRecord);
  },

  // ── Sprint 5: privacy / DSAR / terms (platform/admin, no RLS) ──────
  async listConsentVersions(): Promise<ConsentVersion[]> {
    const rows = await getDb().select().from(webConsentVersions);
    return rows.map((r) => r.data as ConsentVersion);
  },
  async appendTermsAcceptance(acceptance): Promise<TermsAcceptance> {
    await getDb()
      .insert(webTermsAcceptances)
      .values({ id: acceptance.id, data: acceptance })
      .onConflictDoNothing({ target: webTermsAcceptances.id });
    return acceptance;
  },
  async listDataInventory(): Promise<DataInventoryItem[]> {
    const rows = await getDb().select().from(webDataInventory);
    return rows.map((r) => r.data as DataInventoryItem);
  },
  async listRetentionPolicies(): Promise<DataRetentionPolicy[]> {
    const rows = await getDb().select().from(webDataRetentionPolicies);
    return rows.map((r) => r.data as DataRetentionPolicy);
  },
  async getRetentionPolicy(id): Promise<DataRetentionPolicy | null> {
    const [row] = await getDb()
      .select()
      .from(webDataRetentionPolicies)
      .where(eq(webDataRetentionPolicies.id, id))
      .limit(1);
    return row ? (row.data as DataRetentionPolicy) : null;
  },
  async upsertRetentionPolicy(policy): Promise<DataRetentionPolicy> {
    await getDb()
      .insert(webDataRetentionPolicies)
      .values({ id: policy.id, data: policy })
      .onConflictDoUpdate({ target: webDataRetentionPolicies.id, set: { data: policy } });
    return policy;
  },
  async appendDisclosure(entry): Promise<DisclosureLog> {
    await getDb()
      .insert(webDisclosureLogs)
      .values({ id: entry.id, tenantId: entry.tenantId, data: entry })
      .onConflictDoNothing({ target: webDisclosureLogs.id });
    return entry;
  },
  async listDisclosures(tenantId): Promise<DisclosureLog[]> {
    const rows = await getDb()
      .select()
      .from(webDisclosureLogs)
      .where(eq(webDisclosureLogs.tenantId, tenantId));
    return rows
      .map((r) => r.data as DisclosureLog)
      .sort((a, b) => b.disclosedAt.localeCompare(a.disclosedAt));
  },
  async upsertExportRequest(request): Promise<DataExportRequest> {
    await getDb()
      .insert(webDataExportRequests)
      .values({ id: request.id, data: request })
      .onConflictDoUpdate({ target: webDataExportRequests.id, set: { data: request } });
    return request;
  },
  async getExportRequestById(id): Promise<DataExportRequest | null> {
    const [row] = await getDb()
      .select()
      .from(webDataExportRequests)
      .where(eq(webDataExportRequests.id, id))
      .limit(1);
    return row ? (row.data as DataExportRequest) : null;
  },
  async listExportRequests(): Promise<DataExportRequest[]> {
    const rows = await getDb().select().from(webDataExportRequests);
    return rows.map((r) => r.data as DataExportRequest);
  },
  async upsertDeletionRequest(request): Promise<DataDeletionRequest> {
    await getDb()
      .insert(webDataDeletionRequests)
      .values({ id: request.id, data: request })
      .onConflictDoUpdate({ target: webDataDeletionRequests.id, set: { data: request } });
    return request;
  },
  async getDeletionRequestById(id): Promise<DataDeletionRequest | null> {
    const [row] = await getDb()
      .select()
      .from(webDataDeletionRequests)
      .where(eq(webDataDeletionRequests.id, id))
      .limit(1);
    return row ? (row.data as DataDeletionRequest) : null;
  },
  async listDeletionRequests(): Promise<DataDeletionRequest[]> {
    const rows = await getDb().select().from(webDataDeletionRequests);
    return rows.map((r) => r.data as DataDeletionRequest);
  },
  async appendIepAccessLog(entry): Promise<IEPDocumentAccessLog> {
    await getDb()
      .insert(webIepDocAccessLogs)
      .values({ id: entry.id, learnerId: entry.learnerId, tenantId: entry.tenantId, data: entry })
      .onConflictDoNothing({ target: webIepDocAccessLogs.id });
    return entry;
  },
  async listIepAccessForLearner(learnerId, tenantId): Promise<IEPDocumentAccessLog[]> {
    const rows = await getDb()
      .select()
      .from(webIepDocAccessLogs)
      .where(
        and(eq(webIepDocAccessLogs.learnerId, learnerId), eq(webIepDocAccessLogs.tenantId, tenantId)),
      );
    return rows
      .map((r) => r.data as IEPDocumentAccessLog)
      .sort((a, b) => b.accessedAt.localeCompare(a.accessedAt));
  },
};
