import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  text,
  integer,
  bigint,
  index,
} from "drizzle-orm/pg-core";
import { userRoleEnum } from "./enums.js";
import { tenants } from "./tenants.js";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  email: varchar("email", { length: 255 }),
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  pin: varchar("pin", { length: 10 }),
  emailVerified: boolean("email_verified").default(false),
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaMethod: varchar("mfa_method", { length: 20 }).default("email"),
  totpSecretEncrypted: text("totp_secret_encrypted"),
  mfaLockedUntil: timestamp("mfa_locked_until"),
  mfaFailedAttempts: integer("mfa_failed_attempts").default(0).notNull(),
  mfaFailedLastAt: timestamp("mfa_failed_last_at"),
  avatarUrl: text("avatar_url"),
  googleId: varchar("google_id", { length: 255 }),
  appleId: varchar("apple_id", { length: 255 }),
  deactivatedAt: timestamp("deactivated_at"),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: varchar("last_login_ip", { length: 45 }),
  schoolId: uuid("school_id"),
  lastDashboardVisit: timestamp("last_dashboard_visit"),
  /** Sprint 7: drives 365-day rotation enforcement for internal roles. */
  passwordChangedAt: timestamp("password_changed_at").defaultNow(),
  /** Sprint 7: invited team members must change their temp password before any
   *  refresh/heartbeat succeeds. Cleared by a successful change-password call. */
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  /** Sprint A8: IANA timezone every rendered date/time respects for this
   *  user. `tzSource` records whether it was auto-detected from the
   *  browser (overwritable) or explicitly chosen (never auto-overwritten). */
  timezone: varchar("timezone", { length: 64 }),
  tzSource: varchar("tz_source", { length: 8 }),
  /** Sprint 6: set when this user was auto-provisioned through SCIM or SAML JIT. */
  provisionedBy: varchar("provisioned_by", { length: 20 }),
  externalId: varchar("external_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Learner PIN credentials.
 *
 * `users.pin` is a legacy plaintext column kept only for backwards-compatible
 * migrations; production auth must read this table instead. The hash is an
 * Argon2id encoded string, so all verifier parameters travel with the hash.
 */
export const learnerPinCredentials = pgTable(
  "learner_pin_credentials",
  {
    learnerUserId: uuid("learner_user_id")
      .references(() => users.id)
      .primaryKey(),
    pinHash: text("pin_hash").notNull(),
    pinSetAt: timestamp("pin_set_at").defaultNow().notNull(),
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    failedLastAt: timestamp("failed_last_at"),
    lockedUntil: timestamp("locked_until"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("learner_pin_credentials_locked_until_idx").on(table.lockedUntil),
    index("learner_pin_credentials_updated_at_idx").on(table.updatedAt),
  ],
);

/**
 * Sprint 7: prior password hashes. We keep the last N (default 5) so a user
 * cannot rotate back into a recently-used credential.
 */
export const passwordHistory = pgTable(
  "password_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_password_history_user").on(table.userId, table.createdAt)],
);

export const mfaCodes = pgTable(
  "mfa_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    purpose: varchar("purpose", { length: 20 }).default("login").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    resends: integer("resends").default(0).notNull(),
    used: boolean("used").default(false).notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("mfa_codes_user_id_idx").on(table.userId),
    index("mfa_codes_expires_at_idx").on(table.expiresAt),
  ],
);

export const webauthnCredentials = pgTable(
  "webauthn_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    counter: bigint("counter", { mode: "number" }).default(0).notNull(),
    transports: text("transports"),
    label: varchar("label", { length: 120 }).default("Passkey").notNull(),
    deviceType: varchar("device_type", { length: 32 }),
    backedUp: boolean("backed_up").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [index("webauthn_credentials_user_id_idx").on(table.userId)],
);

export const mfaRecoveryCodes = pgTable(
  "mfa_recovery_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("mfa_recovery_codes_user_id_idx").on(table.userId)],
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("password_reset_tokens_token_hash_idx").on(table.tokenHash),
    index("password_reset_tokens_user_id_idx").on(table.userId),
  ],
);

/**
 * Sprint 5: Admin session hygiene.
 * Tracks per-internal-user session activity so we can enforce idle timeouts,
 * periodic re-MFA, and device-binding for high-privilege accounts.
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    mfaVerifiedAt: timestamp("mfa_verified_at").defaultNow().notNull(),
    /** sha256 hex of UA + Accept-Language + sec-ch-ua. */
    deviceFingerprint: varchar("device_fingerprint", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_admin_sessions_user").on(table.userId),
    index("idx_admin_sessions_activity").on(table.lastActivityAt),
  ],
);

export const consentRecords = pgTable("consent_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id")
    .references(() => users.id)
    .notNull(),
  childId: uuid("child_id").references(() => users.id),
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});
