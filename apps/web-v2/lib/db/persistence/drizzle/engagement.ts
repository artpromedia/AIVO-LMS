/**
 * Drizzle-backed EngagementStore — the web_* engagement / learning-session
 * tables. Filtering/sorting + message-append + sensory-merge live in the repo
 * layer; engagement + sensory profiles are keyed by learnerId. Live
 * gradebook/leaderboard reads from engagement-svc over REST (ADR 0015).
 */
import { eq } from "drizzle-orm";
import {
  webHomeworkHelpSessions,
  webCalmSessions,
  webLearnerEngagement,
  webLearnerBadges,
  webLearnerSensoryProfiles,
} from "@aivo/db";
import type {
  CalmSessionRecord,
  HomeworkHelpSession,
  LearnerBadge,
  LearnerEngagement,
  LearnerSensoryProfile,
} from "@/lib/db/types";
import type { EngagementStore } from "../types";
import { getDb } from "./client";

export const drizzleEngagement: EngagementStore = {
  async upsertHomeworkSession(session) {
    await getDb()
      .insert(webHomeworkHelpSessions)
      .values({ id: session.id, tenantId: session.tenantId, data: session })
      .onConflictDoUpdate({
        target: webHomeworkHelpSessions.id,
        set: { tenantId: session.tenantId, data: session },
      });
    return session;
  },
  async getHomeworkSession(id) {
    const [row] = await getDb()
      .select()
      .from(webHomeworkHelpSessions)
      .where(eq(webHomeworkHelpSessions.id, id))
      .limit(1);
    return row ? (row.data as HomeworkHelpSession) : null;
  },
  async listHomeworkSessions(): Promise<HomeworkHelpSession[]> {
    const rows = await getDb().select().from(webHomeworkHelpSessions);
    return rows.map((r) => r.data as HomeworkHelpSession);
  },
  async appendCalmSession(session) {
    await getDb()
      .insert(webCalmSessions)
      .values({ id: session.id, tenantId: session.tenantId, data: session })
      .onConflictDoNothing({ target: webCalmSessions.id });
    return session;
  },
  async listCalmSessions(): Promise<CalmSessionRecord[]> {
    const rows = await getDb().select().from(webCalmSessions);
    return rows.map((r) => r.data as CalmSessionRecord);
  },
  async getEngagement(learnerId): Promise<LearnerEngagement | null> {
    const [row] = await getDb()
      .select()
      .from(webLearnerEngagement)
      .where(eq(webLearnerEngagement.learnerId, learnerId))
      .limit(1);
    return row ? (row.data as LearnerEngagement) : null;
  },
  async upsertEngagement(engagement) {
    await getDb()
      .insert(webLearnerEngagement)
      .values({ learnerId: engagement.learnerId, tenantId: engagement.tenantId, data: engagement })
      .onConflictDoUpdate({
        target: webLearnerEngagement.learnerId,
        set: { data: engagement },
      });
    return engagement;
  },
  async listBadges(): Promise<LearnerBadge[]> {
    const rows = await getDb().select().from(webLearnerBadges);
    return rows.map((r) => r.data as LearnerBadge);
  },
  async getSensoryProfile(learnerId): Promise<LearnerSensoryProfile | null> {
    const [row] = await getDb()
      .select()
      .from(webLearnerSensoryProfiles)
      .where(eq(webLearnerSensoryProfiles.learnerId, learnerId))
      .limit(1);
    return row ? (row.data as LearnerSensoryProfile) : null;
  },
  async upsertSensoryProfile(profile) {
    await getDb()
      .insert(webLearnerSensoryProfiles)
      .values({ learnerId: profile.learnerId, tenantId: profile.tenantId, data: profile })
      .onConflictDoUpdate({
        target: webLearnerSensoryProfiles.learnerId,
        set: { tenantId: profile.tenantId, data: profile },
      });
    return profile;
  },
};
