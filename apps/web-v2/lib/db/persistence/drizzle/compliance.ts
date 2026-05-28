/**
 * Drizzle-backed ComplianceStore — stub.
 *
 * `packages/db/src/schema/data-governance.ts` ships the consent +
 * IEP + age-gate tables. The Drizzle implementation needs:
 *
 *   1. getActiveConsentForUser — index on (parent_user_id, tenant_id,
 *      consent_type, learner_id) WHERE revoked_at IS NULL.
 *   2. listPolicyVersions + listSubprocessors — platform-wide reads;
 *      consider a per-process cache.
 *   3. upsertIEP / deleteIEP — wrap in a transaction with the
 *      LearnerProfile.iepDecision side-effect that lives in
 *      lib/db/repos.ts.
 */
import type { ComplianceStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.compliance.${method}] not implemented. ` +
      `Wire packages/db/src/schema/data-governance.ts into the adapter ` +
      `before flipping AIVO_PERSISTENCE_COMPLIANCE=postgres.`,
  );
}

export const drizzleCompliance: ComplianceStore = {
  async getActiveConsentForUser() {
    return notImplemented("getActiveConsentForUser");
  },
  async listConsentsForUser() {
    return notImplemented("listConsentsForUser");
  },
  async listConsentsForLearner() {
    return notImplemented("listConsentsForLearner");
  },
  async upsertConsent() {
    return notImplemented("upsertConsent");
  },
  async getIEPForLearner() {
    return notImplemented("getIEPForLearner");
  },
  async upsertIEP() {
    return notImplemented("upsertIEP");
  },
  async deleteIEP() {
    return notImplemented("deleteIEP");
  },
  async getAgeGateForLearner() {
    return notImplemented("getAgeGateForLearner");
  },
  async upsertAgeGate() {
    return notImplemented("upsertAgeGate");
  },
  async listPolicyVersions() {
    return notImplemented("listPolicyVersions");
  },
  async listSubprocessors() {
    return notImplemented("listSubprocessors");
  },
};
