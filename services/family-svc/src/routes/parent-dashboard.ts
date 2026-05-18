import { FastifyInstance } from "fastify";
import { eq, and, desc, isNull, asc, sql } from "drizzle-orm";
import {
  learners,
  learnerSettings,
  parentNotifications,
  learnerMilestones,
  learnerStreaks,
  learnerBadges,
  users,
  parentInAppNotifications,
} from "@aivo/db";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import {
  getLearnerSettingsByLearnerIdSchema,
  updateLearnerSettingsByLearnerIdSchema,
  getInboxByParentIdSchema,
  updateInboxByNotificationIdReadSchema,
  updateInboxByNotificationIdDismissSchema,
  getActivityFeedByParentIdSchema,
  getMilestonesByLearnerIdSchema,
  getStreaksByLearnerIdSchema,
  getSummaryByParentIdSchema,
} from "./schemas.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export async function registerParentDashboardRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get(
    "/api/family/learner-settings/:learnerId",
    { schema: getLearnerSettingsByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { learnerId } = req.params as { learnerId: string };
      const owns = await verifyParentOwnership(db, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const [existing] = await db
        .select()
        .from(learnerSettings)
        .where(eq(learnerSettings.learnerId, learnerId));
      if (existing) return existing;

      return {
        learnerId,
        accommodations: {
          readAloud: true,
          simplifiedUI: false,
          extendedTime: false,
          breakReminders: true,
          visualSupports: false,
          reducedAnimations: false,
          highContrast: false,
          fontSize: "normal",
        },
        learningGoals: {
          dailyGoalMinutes: 30,
          weeklySessionTarget: 5,
          preferredSessionTime: "afternoon",
        },
        notifications: {
          milestoneAlerts: true,
          struggleAlerts: true,
          weeklyDigest: true,
          sessionReminders: false,
          iepReminders: true,
        },
        tutorPreferences: {
          preferredTutorKey: null,
          sessionLengthPreference: "medium",
          musicDuringSessions: false,
          celebrationAnimations: true,
        },
      };
    },
  );

  app.put(
    "/api/family/learner-settings/:learnerId",
    { schema: updateLearnerSettingsByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { learnerId } = req.params as { learnerId: string };
      const owns = await verifyParentOwnership(db, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const body = req.body as any;
      const [existing] = await db
        .select()
        .from(learnerSettings)
        .where(eq(learnerSettings.learnerId, learnerId));

      if (existing) {
        await db
          .update(learnerSettings)
          .set({
            accommodations: body.accommodations ?? existing.accommodations,
            learningGoals: body.learningGoals ?? existing.learningGoals,
            notifications: body.notifications ?? existing.notifications,
            tutorPreferences: body.tutorPreferences ?? existing.tutorPreferences,
            updatedAt: new Date(),
            updatedBy: auth.sub,
          })
          .where(eq(learnerSettings.learnerId, learnerId));
      } else {
        await db.insert(learnerSettings).values({
          learnerId,
          accommodations: body.accommodations ?? {},
          learningGoals: body.learningGoals ?? {},
          notifications: body.notifications ?? {},
          tutorPreferences: body.tutorPreferences ?? {},
          updatedBy: auth.sub,
        });
      }

      const [updated] = await db
        .select()
        .from(learnerSettings)
        .where(eq(learnerSettings.learnerId, learnerId));
      return updated;
    },
  );

  // The parent inbox is a merged feed: legacy `parent_notifications` rows
  // (milestones, progress, recommendations, brain_review etc.) plus the
  // newer `parent_in_app_notifications` rows the IEP Phase D pipeline
  // creates when a parent has `inApp: true` for a category. This way the
  // bell badge in the dashboard header reflects every unread item across
  // every learner, not just the per-learner Updates tab.
  app.get(
    "/api/family/inbox/:parentId",
    { schema: getInboxByParentIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { parentId } = req.params as { parentId: string };
      if (!isUuid(parentId) || !isUuid(auth.sub)) return { items: [], unreadCount: 0 };
      if (auth.sub !== parentId && auth.role !== "PLATFORM_ADMIN")
        return reply.code(403).send({ error: "Forbidden" });

      const { filter, limit: lim } = req.query as { filter?: string; limit?: string };
      const pageSize = Math.min(parseInt(lim || "50"), 100);
      const onlyUnread = filter === "unread";

      try {
        const legacyConds: any[] = [
          eq(parentNotifications.parentId, parentId),
          isNull(parentNotifications.dismissedAt),
        ];
        if (onlyUnread) legacyConds.push(isNull(parentNotifications.readAt));

        const iepConds: any[] = [eq(parentInAppNotifications.parentId, parentId)];
        if (onlyUnread) iepConds.push(isNull(parentInAppNotifications.readAt));

        const [legacyRows, iepRows, legacyUnread, iepUnread] = await Promise.all([
          db
            .select()
            .from(parentNotifications)
            .where(and(...legacyConds))
            .orderBy(desc(parentNotifications.createdAt))
            .limit(pageSize),
          db
            .select()
            .from(parentInAppNotifications)
            .where(and(...iepConds))
            .orderBy(desc(parentInAppNotifications.createdAt))
            .limit(pageSize),
          db
            .select({ count: sql<number>`count(*)` })
            .from(parentNotifications)
            .where(
              and(
                eq(parentNotifications.parentId, parentId),
                isNull(parentNotifications.readAt),
                isNull(parentNotifications.dismissedAt),
              ),
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(parentInAppNotifications)
            .where(
              and(
                eq(parentInAppNotifications.parentId, parentId),
                isNull(parentInAppNotifications.readAt),
              ),
            ),
        ]);

        const legacyMapped = legacyRows.map((n: any) => ({
          id: n.id,
          source: "family" as const,
          parentId: n.parentId,
          learnerId: n.learnerId,
          type: n.type,
          title: n.title,
          body: n.body,
          actionUrl: n.actionUrl,
          urgency: n.urgency || "normal",
          readAt: n.readAt,
          dismissedAt: n.dismissedAt,
          createdAt: n.createdAt,
        }));
        const iepMapped = iepRows.map((n: any) => ({
          id: n.id,
          source: "iep" as const,
          parentId: n.parentId,
          learnerId: n.learnerId,
          // The inbox UI keys icons off `type`. Map every IEP category to the
          // existing iep_reminder visual so we don't have to teach the UI new
          // icons; the actual category is preserved on the row for clients
          // that care.
          type: "iep_reminder",
          category: n.category,
          title: n.title,
          body: n.body,
          actionUrl: n.link,
          urgency: "normal" as const,
          readAt: n.readAt,
          dismissedAt: null,
          createdAt: n.createdAt,
        }));

        const items = [...legacyMapped, ...iepMapped]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, pageSize);

        const unreadCount = Number(legacyUnread[0]?.count || 0) + Number(iepUnread[0]?.count || 0);
        return { items, unreadCount };
      } catch (_err) {
        return { items: [], unreadCount: 0 };
      }
    },
  );

  // Mark-read / dismiss accept either source. We look the id up in the
  // legacy table first (the common case — most parent inbox traffic still
  // flows through it), then fall back to the IEP in-app table. UUIDs are
  // globally unique so there's no realistic collision between the two.
  // For IEP rows, dismiss is treated as mark-read since the table has no
  // dismissed_at column — we don't want to block a parent from clearing
  // an item just because it came from the IEP pipeline.
  async function findInboxRow(notificationId: string) {
    if (!isUuid(notificationId)) return null;
    const [legacy] = await db
      .select()
      .from(parentNotifications)
      .where(eq(parentNotifications.id, notificationId));
    if (legacy) return { source: "family" as const, row: legacy };
    const [iep] = await db
      .select()
      .from(parentInAppNotifications)
      .where(eq(parentInAppNotifications.id, notificationId));
    if (iep) return { source: "iep" as const, row: iep };
    return null;
  }

  app.put(
    "/api/family/inbox/:notificationId/read",
    { schema: updateInboxByNotificationIdReadSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { notificationId } = req.params as { notificationId: string };

      const found = await findInboxRow(notificationId);
      if (!found) return reply.code(404).send({ error: "Not found" });
      if (found.row.parentId !== auth.sub && auth.role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "Forbidden" });
      }

      if (found.source === "family") {
        await db
          .update(parentNotifications)
          .set({ readAt: new Date() })
          .where(eq(parentNotifications.id, notificationId));
      } else {
        await db
          .update(parentInAppNotifications)
          .set({ readAt: new Date() })
          .where(eq(parentInAppNotifications.id, notificationId));
      }
      return { success: true };
    },
  );

  app.put(
    "/api/family/inbox/:notificationId/dismiss",
    { schema: updateInboxByNotificationIdDismissSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { notificationId } = req.params as { notificationId: string };

      const found = await findInboxRow(notificationId);
      if (!found) return reply.code(404).send({ error: "Not found" });
      if (found.row.parentId !== auth.sub && auth.role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "Forbidden" });
      }

      if (found.source === "family") {
        await db
          .update(parentNotifications)
          .set({ dismissedAt: new Date() })
          .where(eq(parentNotifications.id, notificationId));
      } else {
        // IEP rows have no dismissed_at — mark read so they leave the
        // unread-only feed and the bell badge.
        await db
          .update(parentInAppNotifications)
          .set({ readAt: new Date() })
          .where(eq(parentInAppNotifications.id, notificationId));
      }
      return { success: true };
    },
  );

  app.get(
    "/api/family/activity-feed/:parentId",
    { schema: getActivityFeedByParentIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { parentId } = req.params as { parentId: string };
      if (!isUuid(parentId) || !isUuid(auth.sub)) return { activities: [], learners: [] };
      if (auth.sub !== parentId && auth.role !== "PLATFORM_ADMIN")
        return reply.code(403).send({ error: "Forbidden" });

      const { since } = req.query as { since?: string };
      let sinceDate: Date | null = null;
      if (since) {
        const parsed = new Date(since);
        if (!Number.isNaN(parsed.getTime())) {
          sinceDate = parsed;
        }
      }

      let parentLearners: Array<{ id: string; name: string }> = [];
      try {
        parentLearners = await db
          .select({ id: learners.id, name: learners.name })
          .from(learners)
          .where(eq(learners.parentId, parentId));
      } catch (_err) {
        return { activities: [], learners: [] };
      }
      const learnerIds = parentLearners.map((l: { id: string; name: string }) => l.id);

      if (learnerIds.length === 0) return { activities: [], learners: [] };

      let milestones: any[] = [];
      try {
        for (const lid of learnerIds) {
          let conditions: any[] = [eq(learnerMilestones.learnerId, lid)];
          if (sinceDate) conditions.push(sql`${learnerMilestones.createdAt} > ${sinceDate}`);
          const m = await db
            .select()
            .from(learnerMilestones)
            .where(and(...conditions))
            .orderBy(desc(learnerMilestones.createdAt))
            .limit(20);
          milestones.push(
            ...m.map((item: any) => ({
              ...item,
              learnerName: parentLearners.find((l: { id: string; name: string }) => l.id === lid)
                ?.name,
            })),
          );
        }
      } catch (err) {
        app.log.error({ err, parentId }, "Failed to build parent activity feed");
        return { activities: [], learners: parentLearners };
      }

      milestones.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return { activities: milestones.slice(0, 20), learners: parentLearners };
    },
  );

  app.get(
    "/api/family/milestones/:learnerId",
    { schema: getMilestonesByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { learnerId } = req.params as { learnerId: string };
      const owns = await verifyParentOwnership(db, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const milestones = await db
        .select()
        .from(learnerMilestones)
        .where(eq(learnerMilestones.learnerId, learnerId))
        .orderBy(desc(learnerMilestones.createdAt));

      const badges = await db
        .select()
        .from(learnerBadges)
        .where(eq(learnerBadges.learnerId, learnerId))
        .orderBy(desc(learnerBadges.earnedAt));

      const [streak] = await db
        .select()
        .from(learnerStreaks)
        .where(eq(learnerStreaks.learnerId, learnerId));

      return { milestones, badges, streak: streak || { currentStreak: 0, longestStreak: 0 } };
    },
  );

  app.get(
    "/api/family/streaks/:learnerId",
    { schema: getStreaksByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { learnerId } = req.params as { learnerId: string };
      const owns = await verifyParentOwnership(db, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const [streak] = await db
        .select()
        .from(learnerStreaks)
        .where(eq(learnerStreaks.learnerId, learnerId));
      return streak || { learnerId, currentStreak: 0, longestStreak: 0, lastActiveDate: null };
    },
  );

  app.get(
    "/api/family/summary/:parentId",
    { schema: getSummaryByParentIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { parentId } = req.params as { parentId: string };
      if (!isUuid(parentId) || !isUuid(auth.sub)) return { parent: null, learners: [] };
      if (auth.sub !== parentId && auth.role !== "PLATFORM_ADMIN")
        return reply.code(403).send({ error: "Forbidden" });

      let parent: { lastDashboardVisit: Date | null; name: string | null } | undefined;
      let parentLearners: any[] = [];
      try {
        [parent] = await db
          .select({ lastDashboardVisit: users.lastDashboardVisit, name: users.name })
          .from(users)
          .where(eq(users.id, parentId));
        parentLearners = await db.select().from(learners).where(eq(learners.parentId, parentId));
      } catch (_err) {
        return { parent: null, learners: [] };
      }

      let learnerSummaries: any[] = [];
      try {
        learnerSummaries = await Promise.all(
          parentLearners.map(async (l: any) => {
            const [streak] = await db
              .select()
              .from(learnerStreaks)
              .where(eq(learnerStreaks.learnerId, l.id));
            const [badge_count] = await db
              .select({ count: sql<number>`count(*)` })
              .from(learnerBadges)
              .where(eq(learnerBadges.learnerId, l.id));
            const recentMilestones = await db
              .select()
              .from(learnerMilestones)
              .where(eq(learnerMilestones.learnerId, l.id))
              .orderBy(desc(learnerMilestones.createdAt))
              .limit(3);

            return {
              ...l,
              streak: streak || { currentStreak: 0, longestStreak: 0 },
              badgeCount: Number(badge_count?.count || 0),
              recentMilestones,
            };
          }),
        );
      } catch (err) {
        app.log.error({ err, parentId }, "Failed to build parent summary");
        learnerSummaries = parentLearners.map((l: any) => ({
          ...l,
          streak: { currentStreak: 0, longestStreak: 0 },
          badgeCount: 0,
          recentMilestones: [],
        }));
      }

      try {
        await db
          .update(users)
          .set({ lastDashboardVisit: new Date() })
          .where(eq(users.id, parentId));
      } catch (_err) {
        // Ignore non-critical update failures so dashboard data can still be returned.
      }

      return {
        parent: { name: parent?.name, lastDashboardVisit: parent?.lastDashboardVisit },
        learners: learnerSummaries,
      };
    },
  );
}
