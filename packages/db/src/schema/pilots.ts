/**
 * Named district pilot programs + the daily learner-progress snapshot that
 * powers the district overview (apps/web-admin/app/district). These are real,
 * district-scoped tables: a district runs several named pilots (each spanning
 * one or more schools with an enrolled learner count and a lifecycle status),
 * and `district_mastery_daily` records one truthful per-day learner-progress
 * point so the 90-day multi-series trend reads from stored history rather than
 * being recomputed (and drifting) on every request.
 */
import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { schools } from "./district.js";

/** A named pilot initiative scoped to a district tenant. */
export const pilotPrograms = pgTable(
  "pilot_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    /** active | starting_soon | completed | paused */
    status: varchar("status", { length: 32 }).notNull().default("active"),
    focusArea: varchar("focus_area", { length: 120 }),
    description: text("description"),
    /** Lead school for the "Lead School +N more" label; null for cohort pilots. */
    leadSchoolId: uuid("lead_school_id").references(() => schools.id),
    /** Learners enrolled in this pilot (the per-pilot count shown in the list). */
    enrolledLearners: integer("enrolled_learners").notNull().default(0),
    startedAt: timestamp("started_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_pilot_programs_tenant").on(table.tenantId, table.status)],
);

/** Join: which schools participate in a pilot (drives the "+N more" count). */
export const pilotProgramSchools = pgTable(
  "pilot_program_schools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    programId: uuid("program_id")
      .references(() => pilotPrograms.id, { onDelete: "cascade" })
      .notNull(),
    schoolId: uuid("school_id")
      .references(() => schools.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_pilot_program_schools_unique").on(table.programId, table.schoolId)],
);

/**
 * One row per district per day: the learner-progress snapshot. All values are
 * percentages (0–100): `mastery` is the district average mastery; `onTrack` /
 * `atRisk` / `needsSupport` are the share of learners in each status band.
 */
export const districtMasteryDaily = pgTable(
  "district_mastery_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    day: date("day").notNull(),
    mastery: integer("mastery").notNull().default(0),
    onTrack: integer("on_track").notNull().default(0),
    atRisk: integer("at_risk").notNull().default(0),
    needsSupport: integer("needs_support").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_district_mastery_daily_unique").on(table.tenantId, table.day)],
);
