import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    tenantId: text("tenant_id").notNull(),
    route: text("route").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    responseBody: jsonb("response_body").notNull(),
    responseStatus: integer("response_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_keys_tenant_route_key_uq").on(
      table.tenantId,
      table.route,
      table.idempotencyKey,
    ),
    index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  ],
);
