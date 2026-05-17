import { pgTable, uuid, varchar, timestamp, integer, jsonb, text, date, boolean } from "drizzle-orm/pg-core";
import { learners } from "./learners.js";
import { users } from "./users.js";

export const learnerSettings = pgTable("learner_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull().unique(),
  accommodations: jsonb("accommodations").default({}),
  learningGoals: jsonb("learning_goals").default({}),
  notifications: jsonb("notifications").default({}),
  tutorPreferences: jsonb("tutor_preferences").default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

export const parentNotifications = pgTable("parent_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id").references(() => users.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  actionUrl: varchar("action_url", { length: 500 }),
  urgency: varchar("urgency", { length: 20 }).default("normal"),
  readAt: timestamp("read_at"),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const learnerMilestones = pgTable("learner_milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  shared: boolean("shared").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const learnerStreaks = pgTable("learner_streaks", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull().unique(),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastActiveDate: date("last_active_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const learnerBadges = pgTable("learner_badges", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  badgeKey: varchar("badge_key", { length: 50 }).notNull(),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
});
