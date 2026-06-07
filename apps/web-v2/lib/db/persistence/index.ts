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
import { memoryCurriculum } from "./memory/curriculum";
import { drizzleCurriculum } from "./drizzle/curriculum";
import { memoryCompliance } from "./memory/compliance";
import { drizzleCompliance } from "./drizzle/compliance";
import { memoryQuests } from "./memory/quests";
import { drizzleQuests } from "./drizzle/quests";
import { memoryAdmin } from "./memory/admin";
import { drizzleAdmin } from "./drizzle/admin";

type DomainKey =
  | "notifications"
  | "audit"
  | "identity"
  | "learners"
  | "assessments"
  | "lessonRuns"
  | "brainProfiles"
  | "curriculum"
  | "compliance"
  | "quests"
  | "admin";

function resolveMode(domain: DomainKey): PersistenceMode {
  const overrides: Record<DomainKey, PersistenceMode | undefined> = {
    notifications: serverEnv.AIVO_PERSISTENCE_NOTIFICATIONS,
    audit: serverEnv.AIVO_PERSISTENCE_AUDIT,
    identity: serverEnv.AIVO_PERSISTENCE_IDENTITY,
    learners: serverEnv.AIVO_PERSISTENCE_LEARNERS,
    assessments: serverEnv.AIVO_PERSISTENCE_ASSESSMENTS,
    lessonRuns: serverEnv.AIVO_PERSISTENCE_LESSON_RUNS,
    brainProfiles: serverEnv.AIVO_PERSISTENCE_BRAIN_PROFILES,
    curriculum: serverEnv.AIVO_PERSISTENCE_CURRICULUM,
    compliance: serverEnv.AIVO_PERSISTENCE_COMPLIANCE,
    quests: serverEnv.AIVO_PERSISTENCE_QUESTS,
    admin: serverEnv.AIVO_PERSISTENCE_ADMIN,
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
  const curriculumMode = resolveMode("curriculum");
  const complianceMode = resolveMode("compliance");
  const questsMode = resolveMode("quests");
  const adminMode = resolveMode("admin");
  warnOnModeMismatch(assessmentsMode, brainProfilesMode);
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
    curriculum: curriculumMode === "postgres" ? drizzleCurriculum : memoryCurriculum,
    compliance: complianceMode === "postgres" ? drizzleCompliance : memoryCompliance,
    quests: questsMode === "postgres" ? drizzleQuests : memoryQuests,
    admin: adminMode === "postgres" ? drizzleAdmin : memoryAdmin,
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
