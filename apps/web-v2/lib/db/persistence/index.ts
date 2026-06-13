/**
 * Persistence adapter — factory + selection.
 *
 * Per ADR 0007, every web-v2 domain that wants to migrate off the
 * process-local `Map` store routes through this module. `getPersistence()`
 * caches a single adapter per Node worker, lazily constructed from the
 * relevant env flags.
 *
 * The default mode is `memory` (existing behaviour). Each domain has an
 * override flag (e.g. AIVO_PERSISTENCE_NOTIFICATIONS) that wins over
 * the global AIVO_PERSISTENCE knob — flipping a single domain to
 * postgres while the rest stays in-memory is the supported path.
 */
import { serverEnv } from "@/lib/env";
import { ensureSeeded } from "@/lib/db/seed";
import { logger } from "@/lib/observability/logger";
import type { Persistence, PersistenceMode } from "./types";
import { memoryNotifications } from "./memory/notifications";
import { drizzleNotifications } from "./drizzle/notifications";
import { memoryAudit } from "./memory/audit";
import { drizzleAudit } from "./drizzle/audit";
import { memoryIdentity } from "./memory/identity";
import { drizzleIdentity } from "./drizzle/identity";
import { memoryLearners } from "./memory/learners";
import { drizzleLearners } from "./drizzle/learners";
import { memoryAssessments } from "./memory/assessments";
import { drizzleAssessments } from "./drizzle/assessments";
import { memoryLessonRuns } from "./memory/lesson-runs";
import { drizzleLessonRuns } from "./drizzle/lesson-runs";
import { memoryBrainProfiles } from "./memory/brain-profiles";
import { drizzleBrainProfiles } from "./drizzle/brain-profiles";
import { memoryBrainProfileApprovals } from "./memory/brain-profile-approvals";
import { drizzleBrainProfileApprovals } from "./drizzle/brain-profile-approvals";
import { memoryBrainProfileChanges } from "./memory/brain-profile-changes";
import { drizzleBrainProfileChanges } from "./drizzle/brain-profile-changes";
import { memoryCurriculum } from "./memory/curriculum";
import { drizzleCurriculum } from "./drizzle/curriculum";
import { memoryCompliance } from "./memory/compliance";
import { drizzleCompliance } from "./drizzle/compliance";
import { memoryQuests } from "./memory/quests";
import { drizzleQuests } from "./drizzle/quests";
import { memoryAdmin } from "./memory/admin";
import { drizzleAdmin } from "./drizzle/admin";
import { memoryCollaboration } from "./memory/collaboration";
import { drizzleCollaboration } from "./drizzle/collaboration";
import { memoryBilling } from "./memory/billing";
import { drizzleBilling } from "./drizzle/billing";
import { memoryClinical } from "./memory/clinical";
import { drizzleClinical } from "./drizzle/clinical";
import { memorySecurity } from "./memory/security";
import { drizzleSecurity } from "./drizzle/security";
import { memoryRostering } from "./memory/rostering";
import { drizzleRostering } from "./drizzle/rostering";
import { memoryAudio } from "./memory/audio";
import { drizzleAudio } from "./drizzle/audio";
import { memorySafety } from "./memory/safety";
import { drizzleSafety } from "./drizzle/safety";
import { memorySupport, memorySettings } from "./memory/support-settings";
import { drizzleSupport, drizzleSettings } from "./drizzle/support-settings";
import { memoryEngagement } from "./memory/engagement";
import { drizzleEngagement } from "./drizzle/engagement";
import { memoryStandards } from "./memory/standards";
import { drizzleStandards } from "./drizzle/standards";

type DomainKey =
  | "notifications"
  | "audit"
  | "identity"
  | "learners"
  | "assessments"
  | "lessonRuns"
  | "brainProfiles"
  | "brainProfileApprovals"
  | "brainProfileChanges"
  | "curriculum"
  | "compliance"
  | "quests"
  | "admin"
  | "collaboration"
  | "billing"
  | "clinical"
  | "security"
  | "rostering"
  | "audio"
  | "safety"
  | "support"
  | "settings"
  | "engagement"
  | "standards";

/**
 * Test-only global mode override. Set by the parity harness
 * (`__tests__/parity.harness.ts`) to force every domain to `memory` or
 * `postgres` so the same suite can be replayed against both backends. It
 * is `null` in production — `resolveMode` ignores it — so this changes no
 * production code path. Mirrors the `__setDbClient` test seam in
 * `drizzle/client.ts`.
 */
let modeOverride: PersistenceMode | null = null;

/** Test-only — force (or clear with `null`) the resolved mode for all domains. */
export function __setPersistenceModeOverride(mode: PersistenceMode | null): void {
  modeOverride = mode;
  cached = null;
}

function resolveMode(domain: DomainKey): PersistenceMode {
  if (modeOverride) return modeOverride;
  const overrides: Record<DomainKey, PersistenceMode | undefined> = {
    notifications: serverEnv.AIVO_PERSISTENCE_NOTIFICATIONS,
    audit: serverEnv.AIVO_PERSISTENCE_AUDIT,
    identity: serverEnv.AIVO_PERSISTENCE_IDENTITY,
    learners: serverEnv.AIVO_PERSISTENCE_LEARNERS,
    assessments: serverEnv.AIVO_PERSISTENCE_ASSESSMENTS,
    lessonRuns: serverEnv.AIVO_PERSISTENCE_LESSON_RUNS,
    brainProfiles: serverEnv.AIVO_PERSISTENCE_BRAIN_PROFILES,
    // C-06: approval records are written in the same flow as brain profiles,
    // so they co-locate — the override defaults to the brain-profiles knob
    // (which itself must match assessments, asserted below).
    brainProfileApprovals:
      serverEnv.AIVO_PERSISTENCE_BRAIN_PROFILE_APPROVALS ?? serverEnv.AIVO_PERSISTENCE_BRAIN_PROFILES,
    // C-13: change records are written in the same flow as brain profiles
    // (every structural mutation captures one), so they co-locate too — the
    // override defaults to the brain-profiles knob.
    brainProfileChanges:
      serverEnv.AIVO_PERSISTENCE_BRAIN_PROFILE_CHANGES ?? serverEnv.AIVO_PERSISTENCE_BRAIN_PROFILES,
    curriculum: serverEnv.AIVO_PERSISTENCE_CURRICULUM,
    compliance: serverEnv.AIVO_PERSISTENCE_COMPLIANCE,
    quests: serverEnv.AIVO_PERSISTENCE_QUESTS,
    admin: serverEnv.AIVO_PERSISTENCE_ADMIN,
    collaboration: serverEnv.AIVO_PERSISTENCE_COLLABORATION,
    billing: serverEnv.AIVO_PERSISTENCE_BILLING,
    clinical: serverEnv.AIVO_PERSISTENCE_CLINICAL,
    security: serverEnv.AIVO_PERSISTENCE_SECURITY,
    rostering: serverEnv.AIVO_PERSISTENCE_ROSTERING,
    audio: serverEnv.AIVO_PERSISTENCE_AUDIO,
    safety: serverEnv.AIVO_PERSISTENCE_SAFETY,
    support: serverEnv.AIVO_PERSISTENCE_SUPPORT,
    settings: serverEnv.AIVO_PERSISTENCE_SETTINGS,
    engagement: serverEnv.AIVO_PERSISTENCE_ENGAGEMENT,
    standards: serverEnv.AIVO_PERSISTENCE_STANDARDS,
  };
  return overrides[domain] ?? serverEnv.AIVO_PERSISTENCE;
}

/**
 * Public read of a single domain's resolved persistence mode. Lets callers
 * (e.g. the assessment submit trace) report whether they ran against
 * `memory` or `postgres` without reaching into env directly.
 */
export function resolvePersistenceMode(domain: DomainKey): PersistenceMode {
  return resolveMode(domain);
}

// PERSISTENCE_MODE_PARITY_ANCHOR — assessments and brainProfiles MUST resolve
// to the same mode in production. A clone written to an empty in-memory map
// while the assessment lives in postgres (or vice-versa) is the failure that
// makes the brain build look "broken" downstream. See scripts/
// check-persistence-mode-parity.mjs and docs/runbooks/persistence-postgres.md.
function warnOnModeMismatch(assessmentsMode: PersistenceMode, brainProfilesMode: PersistenceMode) {
  if (assessmentsMode !== brainProfilesMode) {
    logger.warn({
      event: "persistence.mode_mismatch",
      assessments: assessmentsMode,
      brainProfiles: brainProfilesMode,
      message:
        "assessments and brainProfiles resolved to different persistence modes; " +
        "the brain clone may be written to a store the assessment never reaches.",
    });
  }
}

/**
 * Sprint 1 — a divergent assessments/brainProfiles mode is no longer a soft
 * warning: it is a fail-fast misconfiguration. The brain clone produced by
 * `submitParentAssessment` / `completeBaseline` is written through
 * `brainProfiles` and must land in the SAME backend the assessment lives in,
 * or the downstream build reads an empty store and "looks broken". This guard
 * throws so a bad `AIVO_PERSISTENCE_ASSESSMENTS` / `AIVO_PERSISTENCE_BRAIN_PROFILES`
 * combination is caught at the first `getPersistence()` rather than at a
 * learner's brain build. `warnOnModeMismatch` is retained for the structured
 * log line; this is the hard stop.
 */
export function assertAssessmentsBrainSameMode(
  assessmentsMode: PersistenceMode,
  brainProfilesMode: PersistenceMode,
): void {
  if (assessmentsMode !== brainProfilesMode) {
    throw new Error(
      `[persistence] assessments (${assessmentsMode}) and brainProfiles ` +
        `(${brainProfilesMode}) resolved to different modes. They MUST share a ` +
        `mode — the brain clone is written through brainProfiles and must land ` +
        `in the same backend the assessment lives in. Set ` +
        `AIVO_PERSISTENCE_ASSESSMENTS and AIVO_PERSISTENCE_BRAIN_PROFILES to the ` +
        `same value (or rely on AIVO_PERSISTENCE for both).`,
    );
  }
}

/**
 * Sprint 9 — the in-memory Map is a TEST-ONLY fixture. The persistence adapter
 * must never select a memory store in production: data would be lost on restart
 * and fragmented across replicas (the original Sev-2 this whole migration
 * fixed). The env schema (lib/env.ts) already refuses `memory` in production,
 * so this is defense-in-depth at the adapter layer — a second, independent
 * line that throws the moment any domain would resolve to `memory` under a
 * production process. Exported so `no-memory-in-prod.test.ts` can prove it.
 */
export function assertNoMemoryAdapterInProduction(modes: PersistenceMode[]): void {
  const inProduction =
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.AIVO_TEST_MODE !== "1";
  if (inProduction && modes.some((m) => m === "memory")) {
    throw new Error(
      "[persistence] the in-memory adapter is forbidden in production — every " +
        "domain MUST resolve to postgres. The Map store is a test-only fixture " +
        "(ADR 0007, Sprint 9). Set AIVO_PERSISTENCE / AIVO_PERSISTENCE_* to " +
        "postgres and configure DATABASE_URL.",
    );
  }
}

let cached: Persistence | null = null;

export function getPersistence(): Persistence {
  if (cached) return cached;
  const notificationsMode = resolveMode("notifications");
  const auditMode = resolveMode("audit");
  const identityMode = resolveMode("identity");
  const learnersMode = resolveMode("learners");
  const assessmentsMode = resolveMode("assessments");
  const lessonRunsMode = resolveMode("lessonRuns");
  const brainProfilesMode = resolveMode("brainProfiles");
  const brainProfileApprovalsMode = resolveMode("brainProfileApprovals");
  const brainProfileChangesMode = resolveMode("brainProfileChanges");
  const curriculumMode = resolveMode("curriculum");
  const complianceMode = resolveMode("compliance");
  const questsMode = resolveMode("quests");
  const adminMode = resolveMode("admin");
  const collaborationMode = resolveMode("collaboration");
  const billingMode = resolveMode("billing");
  const clinicalMode = resolveMode("clinical");
  const securityMode = resolveMode("security");
  const rosteringMode = resolveMode("rostering");
  const audioMode = resolveMode("audio");
  const safetyMode = resolveMode("safety");
  const supportMode = resolveMode("support");
  const settingsMode = resolveMode("settings");
  const engagementMode = resolveMode("engagement");
  const standardsMode = resolveMode("standards");
  warnOnModeMismatch(assessmentsMode, brainProfilesMode);
  assertAssessmentsBrainSameMode(assessmentsMode, brainProfilesMode);
  assertNoMemoryAdapterInProduction([
    notificationsMode,
    auditMode,
    identityMode,
    learnersMode,
    assessmentsMode,
    lessonRunsMode,
    brainProfilesMode,
    brainProfileApprovalsMode,
    brainProfileChangesMode,
    curriculumMode,
    complianceMode,
    questsMode,
    adminMode,
    collaborationMode,
    billingMode,
    clinicalMode,
    securityMode,
    rosteringMode,
    audioMode,
    safetyMode,
    supportMode,
    settingsMode,
    engagementMode,
    standardsMode,
  ]);
  // Memory mode serves the seeded demo fixtures — that is its entire
  // premise (mock auth mints MOCK_USERS whose learners/tenants must exist
  // in the store). Without this, the first adapter-routed read on a fresh
  // worker sees an empty store and pages guard-redirect to /login, which
  // is exactly how the visual suite once captured blank/login baselines.
  // Postgres-only processes never reach this branch, and production env
  // validation refuses memory adapters outright.
  if (
    [
      notificationsMode,
      auditMode,
      identityMode,
      learnersMode,
      assessmentsMode,
      lessonRunsMode,
      brainProfilesMode,
      curriculumMode,
      complianceMode,
      questsMode,
      adminMode,
      collaborationMode,
      billingMode,
      clinicalMode,
      securityMode,
      rosteringMode,
      audioMode,
      safetyMode,
      supportMode,
      settingsMode,
      engagementMode,
      standardsMode,
    ].includes("memory")
  ) {
    ensureSeeded();
  }
  cached = {
    // The aggregate `mode` is the global value; per-domain modes are
    // visible on the individual stores at construction time (above).
    // Callers that want to branch on mode should branch per-domain.
    mode: serverEnv.AIVO_PERSISTENCE,
    notifications: notificationsMode === "postgres" ? drizzleNotifications : memoryNotifications,
    audit: auditMode === "postgres" ? drizzleAudit : memoryAudit,
    identity: identityMode === "postgres" ? drizzleIdentity : memoryIdentity,
    learners: learnersMode === "postgres" ? drizzleLearners : memoryLearners,
    assessments: assessmentsMode === "postgres" ? drizzleAssessments : memoryAssessments,
    lessonRuns: lessonRunsMode === "postgres" ? drizzleLessonRuns : memoryLessonRuns,
    brainProfiles: brainProfilesMode === "postgres" ? drizzleBrainProfiles : memoryBrainProfiles,
    brainProfileApprovals:
      brainProfileApprovalsMode === "postgres"
        ? drizzleBrainProfileApprovals
        : memoryBrainProfileApprovals,
    brainProfileChanges:
      brainProfileChangesMode === "postgres"
        ? drizzleBrainProfileChanges
        : memoryBrainProfileChanges,
    curriculum: curriculumMode === "postgres" ? drizzleCurriculum : memoryCurriculum,
    compliance: complianceMode === "postgres" ? drizzleCompliance : memoryCompliance,
    quests: questsMode === "postgres" ? drizzleQuests : memoryQuests,
    admin: adminMode === "postgres" ? drizzleAdmin : memoryAdmin,
    collaboration:
      collaborationMode === "postgres" ? drizzleCollaboration : memoryCollaboration,
    billing: billingMode === "postgres" ? drizzleBilling : memoryBilling,
    clinical: clinicalMode === "postgres" ? drizzleClinical : memoryClinical,
    security: securityMode === "postgres" ? drizzleSecurity : memorySecurity,
    rostering: rosteringMode === "postgres" ? drizzleRostering : memoryRostering,
    audio: audioMode === "postgres" ? drizzleAudio : memoryAudio,
    safety: safetyMode === "postgres" ? drizzleSafety : memorySafety,
    support: supportMode === "postgres" ? drizzleSupport : memorySupport,
    settings: settingsMode === "postgres" ? drizzleSettings : memorySettings,
    engagement: engagementMode === "postgres" ? drizzleEngagement : memoryEngagement,
    standards: standardsMode === "postgres" ? drizzleStandards : memoryStandards,
  };
  return cached;
}

/**
 * Reset the cached adapter — for tests only. Vitest's `resetStore()`
 * already clears the underlying `Map` data; this clears the adapter so
 * subsequent `getPersistence()` re-reads any env stubs applied via
 * `vi.stubEnv`.
 */
export function resetPersistence(): void {
  cached = null;
}

export type { Persistence, PersistenceMode } from "./types";
