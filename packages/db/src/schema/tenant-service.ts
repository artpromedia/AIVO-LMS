import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const tenantServiceDistricts = pgTable(
  "tenant_service_districts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("tenant_service_district_external_id_uq").on(table.externalId)],
);

export const tenantServiceSchools = pgTable(
  "tenant_service_schools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id")
      .references(() => tenantServiceDistricts.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tenant_service_schools_district_idx").on(table.districtId),
    uniqueIndex("tenant_service_school_external_id_uq").on(table.districtId, table.externalId),
  ],
);

export const tenantServiceClasses = pgTable(
  "tenant_service_classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id")
      .references(() => tenantServiceDistricts.id, { onDelete: "cascade" })
      .notNull(),
    schoolId: uuid("school_id")
      .references(() => tenantServiceSchools.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("tenant_service_classes_school_idx").on(table.schoolId),
    uniqueIndex("tenant_service_class_external_id_uq").on(table.districtId, table.externalId),
  ],
);

export const tenantRosterStudents = pgTable(
  "tenant_roster_students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id")
      .references(() => tenantServiceDistricts.id, { onDelete: "cascade" })
      .notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    givenName: varchar("given_name", { length: 255 }).notNull(),
    familyName: varchar("family_name", { length: 255 }).notNull(),
    schoolExternalId: varchar("school_external_id", { length: 255 }).notNull(),
    grade: varchar("grade", { length: 32 }),
    parentOwnedFields: jsonb("parent_owned_fields").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenant_roster_student_external_id_uq").on(table.districtId, table.externalId),
  ],
);

export const tenantRosterTeachers = pgTable(
  "tenant_roster_teachers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id")
      .references(() => tenantServiceDistricts.id, { onDelete: "cascade" })
      .notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    givenName: varchar("given_name", { length: 255 }).notNull(),
    familyName: varchar("family_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    schoolExternalIds: jsonb("school_external_ids").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenant_roster_teacher_external_id_uq").on(table.districtId, table.externalId),
  ],
);

export const tenantRosterEnrollments = pgTable(
  "tenant_roster_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id")
      .references(() => tenantServiceDistricts.id, { onDelete: "cascade" })
      .notNull(),
    classExternalId: varchar("class_external_id", { length: 255 }).notNull(),
    studentExternalId: varchar("student_external_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenant_roster_enrollment_external_ids_uq").on(
      table.districtId,
      table.classExternalId,
      table.studentExternalId,
    ),
    index("tenant_roster_enrollment_student_idx").on(table.districtId, table.studentExternalId),
  ],
);

export const serviceRuntimeState = pgTable("service_runtime_state", {
  service: text("service").primaryKey(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
