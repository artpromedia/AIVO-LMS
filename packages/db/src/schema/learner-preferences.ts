/**
 * Sprint 15D — learner_preferences (drizzle schema).
 *
 * Companion to packages/db/migrations/0048_learner_accessibility_preferences.sql.
 * The `accessibility` column persists the toggle bag set by the
 * AccessibilityPanel. Shape matches
 * packages/learner-ui/src/inclusive-mode/useAccessibilityPreferences.ts:
 *
 *   {
 *     highContrast: boolean,
 *     dyslexiaFont: boolean,
 *     reducedMotion: boolean,
 *     captionsByDefault: boolean,
 *     readAloudAutoplay: boolean,
 *     aacQuickAccess: boolean,
 *     largerTouchTargets: boolean,
 *     preferredLocale?: string,
 *   }
 */
import { pgTable, uuid, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { learners } from "./learners.js";

export const learnerPreferences = pgTable(
  "learner_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .references(() => learners.id, { onDelete: "cascade" })
      .notNull(),
    accessibility: jsonb("accessibility").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    learnerIdUniq: uniqueIndex("learner_preferences_learner_id_uniq").on(t.learnerId),
  }),
);

export type LearnerPreferences = typeof learnerPreferences.$inferSelect;
export type NewLearnerPreferences = typeof learnerPreferences.$inferInsert;
