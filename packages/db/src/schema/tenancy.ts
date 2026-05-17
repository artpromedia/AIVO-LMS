import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const enterpriseDistricts = pgTable(
  "enterprise_districts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    externalId: varchar("external_id", { length: 120 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_enterprise_districts_external").on(table.externalId)],
);

export const enterpriseSchools = pgTable(
  "enterprise_schools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id").notNull(),
    name: text("name").notNull(),
    externalId: varchar("external_id", { length: 120 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_enterprise_schools_district").on(table.districtId),
    index("idx_enterprise_schools_external").on(table.externalId),
  ],
);

export const enterpriseClasses = pgTable(
  "enterprise_classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: uuid("school_id").notNull(),
    name: text("name").notNull(),
    externalId: varchar("external_id", { length: 120 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_enterprise_classes_school").on(table.schoolId),
    index("idx_enterprise_classes_external").on(table.externalId),
  ],
);

export const classEnrollments = pgTable(
  "class_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id").notNull(),
    learnerId: uuid("learner_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_class_enrollments_class").on(table.classId),
    index("idx_class_enrollments_learner").on(table.learnerId),
  ],
);

export const teacherAssignments = pgTable(
  "teacher_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id").notNull(),
    teacherUserId: uuid("teacher_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_teacher_assignments_class").on(table.classId),
    index("idx_teacher_assignments_teacher").on(table.teacherUserId),
  ],
);

export const districtAdminAssignments = pgTable(
  "district_admin_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 40 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_district_admin_assignments_district").on(table.districtId),
    index("idx_district_admin_assignments_user").on(table.userId),
  ],
);
