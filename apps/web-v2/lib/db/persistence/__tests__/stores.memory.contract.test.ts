/**
 * Runs the shared store contracts against the in-memory adapters. These
 * are the reference semantics every postgres adapter must match
 * (see stores.postgres.contract.test.ts, which runs the same contracts
 * against Drizzle when AIVO_TEST_DATABASE_URL is set).
 */
import { resetStore } from "@/lib/db/store";
import { memoryBrainProfiles } from "../memory/brain-profiles";
import { memoryLessonRuns } from "../memory/lesson-runs";
import { brainProfileStoreContract } from "./contract/brain-profiles.contract";
import { lessonRunStoreContract } from "./contract/lesson-runs.contract";

brainProfileStoreContract("memory", () => memoryBrainProfiles, resetStore);
lessonRunStoreContract("memory", () => memoryLessonRuns, resetStore);
