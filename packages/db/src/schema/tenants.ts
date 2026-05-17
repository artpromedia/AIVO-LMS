import { pgTable, uuid, varchar, timestamp, jsonb, text, integer } from "drizzle-orm/pg-core";
import { tenantTypeEnum } from "./enums.js";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: tenantTypeEnum("type").notNull().default("B2C_FAMILY"),
  // Licensing model (sprint task #12). Distinguishes:
  //   - B2C_PARENT_PAY: parent-pay, single-learner, no district seat
  //     allotment. Default for B2C_FAMILY tenants.
  //   - B2B_SEAT_LICENSED: district-licensed, multi-learner, capped
  //     by seat_limit. Default for B2B_SCHOOL / B2B_DISTRICT tenants.
  // Stored as varchar so we can grow the model without migrating an
  // enum. Default backfilled from `type` for existing rows.
  licensingTier: varchar("licensing_tier", { length: 30 }),
  // Maximum learner seats allowed under this tenant. NULL means
  // unlimited (used for B2C_PARENT_PAY where the cap is enforced
  // separately as 1 learner per parent).
  seatLimit: integer("seat_limit"),
  settings: jsonb("settings").default({}),
  status: varchar("status", { length: 20 }).default("active"),
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
