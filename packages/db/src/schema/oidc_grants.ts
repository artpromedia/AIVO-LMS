import { pgTable, text, uuid, timestamp, varchar, index } from "drizzle-orm/pg-core";

/**
 * OIDC ephemeral grant storage (Phase 2 — multi-replica).
 *
 * The OIDC provider's auth codes, access tokens, and refresh tokens were
 * previously held in process-local `Map`s, which only works on a single
 * replica (a code issued on one pod can't be redeemed on another, and a
 * rolling deploy drops every in-flight grant). These tables move that state
 * into Postgres so the provider is correct under horizontal scaling.
 *
 * Only the SHA-256 *hash* of each code/token is stored — never the raw value
 * — mirroring how `sessions.refresh_token` and `password_reset_tokens` are
 * handled, so a database compromise does not yield usable credentials.
 */

export const oidcAuthCodes = pgTable(
  "oidc_auth_codes",
  {
    // sha256(rawCode) hex — 64 chars.
    codeHash: varchar("code_hash", { length: 64 }).primaryKey(),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull(),
    userId: uuid("user_id").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    nonce: text("nonce"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    expiresIdx: index("oidc_auth_codes_expires_idx").on(t.expiresAt),
  }),
);

export const oidcAccessTokens = pgTable(
  "oidc_access_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id").notNull(),
    clientId: text("client_id").notNull(),
    scope: text("scope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    expiresIdx: index("oidc_access_tokens_expires_idx").on(t.expiresAt),
  }),
);

export const oidcRefreshTokens = pgTable(
  "oidc_refresh_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id").notNull(),
    clientId: text("client_id").notNull(),
    scope: text("scope").notNull(),
    // Nullable: the provider does not currently expire refresh tokens.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    expiresIdx: index("oidc_refresh_tokens_expires_idx").on(t.expiresAt),
  }),
);

export type OidcAuthCode = typeof oidcAuthCodes.$inferSelect;
export type OidcAccessToken = typeof oidcAccessTokens.$inferSelect;
export type OidcRefreshToken = typeof oidcRefreshTokens.$inferSelect;
