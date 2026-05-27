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

type DomainKey =
  | "notifications"
  | "audit"
  | "identity"
  | "learners"
  | "assessments"
  | "lessonRuns"
  | "brainProfiles";

function resolveMode(domain: DomainKey): PersistenceMode {
  const overrides: Record<DomainKey, PersistenceMode | undefined> = {
    notifications: serverEnv.AIVO_PERSISTENCE_NOTIFICATIONS,
    audit: serverEnv.AIVO_PERSISTENCE_AUDIT,
    identity: serverEnv.AIVO_PERSISTENCE_IDENTITY,
    learners: serverEnv.AIVO_PERSISTENCE_LEARNERS,
    assessments: serverEnv.AIVO_PERSISTENCE_ASSESSMENTS,
    lessonRuns: serverEnv.AIVO_PERSISTENCE_LESSON_RUNS,
    brainProfiles: serverEnv.AIVO_PERSISTENCE_BRAIN_PROFILES,
  };
  return overrides[domain] ?? serverEnv.AIVO_PERSISTENCE;
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
  cached = {
    // The aggregate `mode` is the global value; per-domain modes are
    // visible on the individual stores at construction time (above).
    // Callers that want to branch on mode should branch per-domain.
    mode: serverEnv.AIVO_PERSISTENCE,
    notifications:
      notificationsMode === "postgres" ? drizzleNotifications : memoryNotifications,
    audit: auditMode === "postgres" ? drizzleAudit : memoryAudit,
    identity: identityMode === "postgres" ? drizzleIdentity : memoryIdentity,
    learners: learnersMode === "postgres" ? drizzleLearners : memoryLearners,
    assessments:
      assessmentsMode === "postgres" ? drizzleAssessments : memoryAssessments,
    lessonRuns:
      lessonRunsMode === "postgres" ? drizzleLessonRuns : memoryLessonRuns,
    brainProfiles:
      brainProfilesMode === "postgres" ? drizzleBrainProfiles : memoryBrainProfiles,
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
