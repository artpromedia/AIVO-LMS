import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * TTS pronunciation overrides — an admin-curated dictionary mapping a source
 * token to an SSML phoneme / grapheme replacement used by the read-aloud TTS
 * adapter. Owned by admin-svc, surfaced in the web-admin platform console.
 * Replaces the in-memory store the legacy web-v2 admin used.
 *
 * `encoding` ∈ ipa | x-sampa | plain. `scope` ∈ platform | tenant
 * (platform-scope rows apply to every tenant and carry a NULL tenant_id).
 */
export const pronunciationOverrides = pgTable(
  "pronunciation_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** NULL for platform-scope overrides (apply to all tenants). */
    tenantId: uuid("tenant_id"),
    token: varchar("token", { length: 256 }).notNull(),
    replacement: varchar("replacement", { length: 512 }).notNull(),
    encoding: varchar("encoding", { length: 16 }).notNull().default("plain"),
    scope: varchar("scope", { length: 16 }).notNull().default("tenant"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pronunciation_overrides_tenant").on(table.tenantId),
    index("idx_pronunciation_overrides_token").on(table.token),
  ],
);
