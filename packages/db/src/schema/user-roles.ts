import { pgTable, uuid, varchar, timestamp, index, unique } from "drizzle-orm/pg-core";

/**
 * Additional roles a user may act as, beyond their primary `users.role`
 * (ADR 0020 — single shell, multi-role). The unified app lets a user who
 * holds multiple roles (e.g. a parent who is also a teacher at their child's
 * school) switch the active role without logging out.
 *
 * `availableRoles` in the access-token JWT is computed as
 * `users.role ∪ user_roles.role`. The active-role header the clients send is
 * validated against that set (see `@aivo/security` `checkActiveRole`).
 */
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    role: varchar("role", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("user_roles_user_idx").on(t.userId),
    uniqueRole: unique("user_roles_user_role_key").on(t.userId, t.role),
  }),
);

export type UserRoleRow = typeof userRoles.$inferSelect;
