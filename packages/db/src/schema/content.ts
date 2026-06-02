import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

/**
 * Content CMS pack registry (Sprint 5 — durable storage).
 *
 * Replaces admin-svc's process-local Map so validate/publish state survives a
 * restart and is shared across replicas. `pack_key` is the logical pack id the
 * API addresses (e.g. "k-math-fall-2026"); `pack` holds the full authored
 * ContentPack JSON. `tenant_id` is nullable for platform-global packs.
 */
export const contentPacks = pgTable(
  "content_packs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    packKey: varchar("pack_key", { length: 200 }).notNull().unique(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    title: varchar("title", { length: 255 }).notNull(),
    version: varchar("version", { length: 40 }).notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    gradeBand: varchar("grade_band", { length: 40 }).notNull(),
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    /** Full authored ContentPack payload. */
    pack: jsonb("pack").notNull(),
    /** Last validator run summary: { ok, issueCount, ranAt }. */
    lastValidation: jsonb("last_validation"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("content_packs_status_idx").on(t.status),
  }),
);
