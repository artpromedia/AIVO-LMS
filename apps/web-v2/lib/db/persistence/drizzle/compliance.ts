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
} from "@aivo/db";
import type {
  AgeGateRecord,
  ConsentRecord,
  IEPDocument,
  PolicyVersion,
  SubprocessorRecord,
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
};
