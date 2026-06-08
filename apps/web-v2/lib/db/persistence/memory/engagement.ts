/**
 * In-memory EngagementStore — wraps homeworkHelpSessions / calmSessions /
 * learnerEngagement / learnerBadges / learnerSensoryProfiles Maps. Test-only;
 * the repo layer owns filtering/sorting + message-append + sensory-merge logic.
 * Engagement + sensory profiles are keyed by learnerId.
 */
import { getStore } from "@/lib/db/store";
import type {
  CalmSessionRecord,
  HomeworkHelpSession,
  LearnerBadge,
  LearnerEngagement,
  LearnerSensoryProfile,
} from "@/lib/db/types";
import type { EngagementStore } from "../types";

export const memoryEngagement: EngagementStore = {
  async upsertHomeworkSession(session) {
    getStore().homeworkHelpSessions.set(session.id, session);
    return session;
  },
  async getHomeworkSession(id) {
    return getStore().homeworkHelpSessions.get(id) ?? null;
  },
  async listHomeworkSessions(): Promise<HomeworkHelpSession[]> {
    return Array.from(getStore().homeworkHelpSessions.values());
  },
  async appendCalmSession(session) {
    getStore().calmSessions.set(session.id, session);
    return session;
  },
  async listCalmSessions(): Promise<CalmSessionRecord[]> {
    return Array.from(getStore().calmSessions.values());
  },
  async getEngagement(learnerId): Promise<LearnerEngagement | null> {
    return getStore().learnerEngagement.get(learnerId) ?? null;
  },
  async listBadges(): Promise<LearnerBadge[]> {
    return Array.from(getStore().learnerBadges.values());
  },
  async getSensoryProfile(learnerId): Promise<LearnerSensoryProfile | null> {
    return getStore().learnerSensoryProfiles.get(learnerId) ?? null;
  },
  async upsertSensoryProfile(profile) {
    getStore().learnerSensoryProfiles.set(profile.learnerId, profile);
    return profile;
  },
};
