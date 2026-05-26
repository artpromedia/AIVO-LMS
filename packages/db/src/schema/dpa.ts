import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Sprint 12.5 DPA acceptance records.
 *
 * The Postgres-backed DPA store in `services/data-governance-svc` writes
 * here. Fields match `packages/db/migrations/0041_dpa_acceptance_records.sql`.
 *
 * `ipAddress` is `inet` in Postgres; Drizzle has no native inet column type
 * so it is mapped through `text` here — values are still validated /
 * stored by Postgres as inet because of the underlying column type.
 *
 * `addenda` holds the list of optional addendum names accepted alongside
 * the main DPA (e.g. `["coppa", "ferpa"]`). `stateAddendumVersions` maps
 * US state codes (or international jurisdiction codes) to the version of
 * the state-specific addendum that was in effect at acceptance time
 * (e.g. `{ "CA": "2024-09", "NY": "2024-03" }`).
 */
export const dpaAcceptanceRecords = pgTable(
  "dpa_acceptance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    schoolId: uuid("school_id"),
    districtId: uuid("district_id"),
    templateVersion: text("template_version").notNull(),
    acceptedByUserId: uuid("accepted_by_user_id").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    signatureHash: text("signature_hash").notNull(),
    addenda: jsonb("addenda").default([]).notNull(),
    stateAddendumVersions: jsonb("state_addendum_versions").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_dpa_acceptance_records_tenant_accepted").on(table.tenantId, table.acceptedAt),
    index("idx_dpa_acceptance_records_school").on(table.schoolId),
    index("idx_dpa_acceptance_records_district").on(table.districtId),
  ],
);

export type DpaAcceptanceRecordRow = typeof dpaAcceptanceRecords.$inferSelect;
export type DpaAcceptanceRecordInsert = typeof dpaAcceptanceRecords.$inferInsert;
