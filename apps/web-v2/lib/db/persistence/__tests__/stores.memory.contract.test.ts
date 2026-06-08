/**
 * Runs every shared store contract against the in-memory adapters —
 * the reference semantics each postgres adapter must match (see
 * stores.postgres.contract.test.ts).
 */
import { resetStore } from "@/lib/db/store";
import { memoryBrainProfiles } from "../memory/brain-profiles";
import { memoryLessonRuns } from "../memory/lesson-runs";
import { memoryNotifications } from "../memory/notifications";
import { memoryAudit } from "../memory/audit";
import { memoryIdentity } from "../memory/identity";
import { memoryLearners } from "../memory/learners";
import { memoryAssessments } from "../memory/assessments";
import { memoryCurriculum } from "../memory/curriculum";
import { memoryCompliance } from "../memory/compliance";
import { memoryQuests } from "../memory/quests";
import { memoryAdmin } from "../memory/admin";
import { memoryCollaboration } from "../memory/collaboration";
import { brainProfileStoreContract } from "./contract/brain-profiles.contract";
import { lessonRunStoreContract } from "./contract/lesson-runs.contract";
import { assessmentSubmitContract } from "./contract/assessments.contract";
import { collaborationStoreContract } from "./contract/collaboration.contract";
import {
  notificationStoreContract,
  auditStoreContract,
  identityStoreContract,
  learnerStoreContract,
  assessmentStoreContract,
  curriculumStoreContract,
  complianceStoreContract,
  questStoreContract,
  adminStoreContract,
} from "./contract/stores.contract";

const M = "memory";
brainProfileStoreContract(M, () => memoryBrainProfiles, resetStore);
lessonRunStoreContract(M, () => memoryLessonRuns, resetStore);
notificationStoreContract(M, () => memoryNotifications, resetStore);
auditStoreContract(M, () => memoryAudit, resetStore);
identityStoreContract(M, () => memoryIdentity, resetStore);
learnerStoreContract(M, () => memoryLearners, resetStore);
assessmentStoreContract(M, () => memoryAssessments, resetStore);
assessmentSubmitContract(M, () => memoryAssessments, resetStore);
curriculumStoreContract(M, () => memoryCurriculum, resetStore);
complianceStoreContract(M, () => memoryCompliance, resetStore);
questStoreContract(M, () => memoryQuests, resetStore);
adminStoreContract(M, () => memoryAdmin, resetStore);
collaborationStoreContract(M, () => memoryCollaboration, resetStore);
