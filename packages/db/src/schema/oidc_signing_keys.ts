import { pgTable, uuid, text, jsonb, timestamp, boolean, index } from "drizzle-orm/pg-core";

/**
 * OIDC provider signing key set (Sprint 12.7).
 *
 * The active row is used for new ID-token signatures. Inactive rows
 * remain published via the JWKS endpoint for a grace window so existing
 * tokens stay verifiable across rotations.
 */
export const oidcSigningKeys = pgTable(
  "oidc_signing_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kid: text("kid").notNull().unique(),
    jwk: jsonb("jwk").notNull(),
    publicJwk: jsonb("public_jwk").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    active: boolean("active").default(true).notNull(),
  },
  (t) => ({
    activeIdx: index("oidc_signing_keys_active_idx").on(t.active, t.createdAt),
  }),
);

export type OidcSigningKey = typeof oidcSigningKeys.$inferSelect;
export type NewOidcSigningKey = typeof oidcSigningKeys.$inferInsert;
