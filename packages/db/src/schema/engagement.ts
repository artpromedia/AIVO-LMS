import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  jsonb,
  boolean,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { learners } from "./learners.js";
import { users } from "./users.js";
import { tenants } from "./tenants.js";

export const xpEvents = pgTable("xp_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  xpAmount: integer("xp_amount").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const badges = pgTable("badges", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  badgeType: varchar("badge_type", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  rarity: varchar("rarity", { length: 20 }).default("common"),
  iconUrl: varchar("icon_url", { length: 500 }),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
});

export const streaks = pgTable(
  "streaks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .references(() => learners.id)
      .notNull(),
    currentStreak: integer("current_streak").default(0),
    longestStreak: integer("longest_streak").default(0),
    lastActivityDate: timestamp("last_activity_date"),
    freezesUsed: integer("freezes_used").default(0),
    streakTier: varchar("streak_tier", { length: 20 }).default("grey"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("uq_streaks_learner").on(t.learnerId)],
);

export const virtualCurrency = pgTable(
  "virtual_currency",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .references(() => learners.id)
      .notNull(),
    coins: integer("coins").default(0).notNull(),
    gems: integer("gems").default(0).notNull(),
    totalCoinsEarned: integer("total_coins_earned").default(0).notNull(),
    totalGemsEarned: integer("total_gems_earned").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("uq_virtual_currency_learner").on(t.learnerId)],
);

export const currencyTransactions = pgTable("currency_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  currencyType: varchar("currency_type", { length: 10 }).notNull(),
  amount: integer("amount").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const avatarItems = pgTable("avatar_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  rarity: varchar("rarity", { length: 20 }).default("common"),
  coinPrice: integer("coin_price").default(0),
  gemPrice: integer("gem_price").default(0),
  levelRequired: integer("level_required").default(1),
  gradeBandMin: varchar("grade_band_min", { length: 20 }),
  gradeBandMax: varchar("grade_band_max", { length: 20 }),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  isFree: boolean("is_free").default(false),
  isDefault: boolean("is_default").default(false),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const avatarInventory = pgTable(
  "avatar_inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .references(() => learners.id)
      .notNull(),
    itemId: uuid("item_id")
      .references(() => avatarItems.id)
      .notNull(),
    equipped: boolean("equipped").default(false),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  },
  (t) => [unique("uq_avatar_inventory_learner_item").on(t.learnerId, t.itemId)],
);

export const quests = pgTable(
  "quests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldKey: varchar("world_key", { length: 50 }).notNull(),
    chapterNumber: integer("chapter_number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    narrativeIntro: text("narrative_intro"),
    narrativeOutro: text("narrative_outro"),
    subject: varchar("subject", { length: 100 }).notNull(),
    xpReward: integer("xp_reward").default(50),
    coinReward: integer("coin_reward").default(10),
    bossAssessment: jsonb("boss_assessment").default({}),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("uq_quests_world_chapter").on(t.worldKey, t.chapterNumber)],
);

export const questProgress = pgTable("quest_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  questId: uuid("quest_id")
    .references(() => quests.id)
    .notNull(),
  status: varchar("status", { length: 20 }).default("LOCKED").notNull(),
  score: integer("score").default(0),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  challengeType: varchar("challenge_type", { length: 30 }).notNull(),
  subject: varchar("subject", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  inviteCode: varchar("invite_code", { length: 8 }),
  status: varchar("status", { length: 20 }).default("WAITING").notNull(),
  maxParticipants: integer("max_participants").default(2),
  questionBank: jsonb("question_bank").default([]),
  settings: jsonb("settings").default({}),
  createdBy: uuid("created_by").references(() => learners.id),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const challengeParticipants = pgTable("challenge_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id")
    .references(() => challenges.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  score: integer("score").default(0),
  answersCorrect: integer("answers_correct").default(0),
  answersTotal: integer("answers_total").default(0),
  completedAt: timestamp("completed_at"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .references(() => learners.id)
      .notNull(),
    scope: varchar("scope", { length: 20 }).notNull(),
    scopeId: varchar("scope_id", { length: 100 }),
    totalXp: integer("total_xp").default(0).notNull(),
    level: integer("level").default(1).notNull(),
    rank: integer("rank"),
    weeklyXp: integer("weekly_xp").default(0),
    monthlyXp: integer("monthly_xp").default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("uq_leaderboard_learner_scope").on(t.learnerId, t.scope, t.scopeId)],
);

export const siblingLinks = pgTable("sibling_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerAId: uuid("learner_a_id")
    .references(() => learners.id)
    .notNull(),
  learnerBId: uuid("learner_b_id")
    .references(() => learners.id)
    .notNull(),
  familyLeaderboard: boolean("family_leaderboard").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const selCheckins = pgTable("sel_checkins", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  emotion: varchar("emotion", { length: 50 }).notNull(),
  intensity: integer("intensity").default(3),
  notes: text("notes"),
  xpAwarded: integer("xp_awarded").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const breakActivities = pgTable("break_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  durationSeconds: integer("duration_seconds").default(0),
  trigger: varchar("trigger", { length: 50 }),
  xpAwarded: integer("xp_awarded").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lessonPlans = pgTable("lesson_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  teacherUserId: uuid("teacher_user_id")
    .references(() => users.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  gradeLevel: varchar("grade_level", { length: 20 }),
  content: jsonb("content").default({}),
  accommodations: jsonb("accommodations").default([]),
  activities: jsonb("activities").default([]),
  formativeAssessments: jsonb("formative_assessments").default([]),
  status: varchar("status", { length: 20 }).default("DRAFT"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
