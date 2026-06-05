/**
 * Enterprise admin hardening feature flags (Sprint 0).
 *
 * Centralized, typed parsing of ADMIN_ENTERPRISE_* environment variables.
 * All flags default OFF so adding this module is a no-op for existing
 * deployments. Sprints 1-11 will read these flags to gate behaviour.
 *
 * Flags are resolved once per process at import time. Services should call
 * `logAdminEnterpriseFlags(logger)` during bootstrap so operators can see
 * the effective configuration in startup logs.
 */

export interface AdminEnterpriseFlags {
  /** Require WebAuthn / phishing-resistant MFA for admin logins (Sprint 2). */
  STRONG_MFA: boolean;
  /** Require fresh re-auth before high-risk admin actions (Sprint 3). */
  STEP_UP_AUTH: boolean;
  /** Enable delegated-admin permission enforcement for RBAC v2. */
  DELEGATED_ADMIN_RBAC_V2: boolean;
  /** Enable SAML SSO + SCIM provisioning for districts (Sprint 6). */
  DISTRICT_SSO: boolean;
  /** Make audit log entries append-only / hash-chained (Sprint 4). */
  AUDIT_IMMUTABLE: boolean;
  /** Idle-timeout (in seconds) for admin sessions; 0 disables (Sprint 5). */
  ADMIN_SESSION_IDLE: number;
}

const PREFIX = "ADMIN_ENTERPRISE_";

export function parseBoolFlag(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "") return defaultValue;
  if (["1", "true", "yes", "on", "enabled"].includes(v)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(v)) return false;
  return defaultValue;
}

export function parseIntFlag(raw: string | undefined, defaultValue: number): number {
  if (raw === undefined) return defaultValue;
  const v = raw.trim();
  if (v === "") return defaultValue;
  if (!/^\d+$/.test(v)) return defaultValue;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return defaultValue;
  return n;
}

export function loadAdminEnterpriseFlags(
  env: NodeJS.ProcessEnv = process.env,
): AdminEnterpriseFlags {
  return {
    STRONG_MFA: parseBoolFlag(env[`${PREFIX}STRONG_MFA`], false),
    STEP_UP_AUTH: parseBoolFlag(env[`${PREFIX}STEP_UP_AUTH`], false),
    DELEGATED_ADMIN_RBAC_V2: parseBoolFlag(env[`${PREFIX}DELEGATED_ADMIN_RBAC_V2`], false),
    DISTRICT_SSO: parseBoolFlag(env[`${PREFIX}DISTRICT_SSO`], false),
    AUDIT_IMMUTABLE: parseBoolFlag(env[`${PREFIX}AUDIT_IMMUTABLE`], false),
    ADMIN_SESSION_IDLE: parseIntFlag(env[`${PREFIX}ADMIN_SESSION_IDLE`], 0),
  };
}

export const ADMIN_ENTERPRISE: AdminEnterpriseFlags = loadAdminEnterpriseFlags();

/* ----------------------------------------------------------------------------
 * Speech Buddy feature flag
 *
 * `speech_buddy.enabled` is scoped per tenant and per age band so a tenant can
 * roll out one band at a time. Defaults OFF for every (tenant, band) tuple.
 *
 * Configuration source (env, parsed at import time):
 *   SPEECH_BUDDY_ENABLED_TENANTS = "tenantA:6-9,10-12;tenantB:13-15"
 *   SPEECH_BUDDY_ENABLED_GLOBAL  = "" | "all" | "6-9,10-12,13-15"
 *
 * SPEECH_BUDDY_ENABLED_GLOBAL is for staging / canary only; in production it
 * should remain unset. A future flag service may replace this env-based store.
 * ----------------------------------------------------------------------------
 */

export const SPEECH_BUDDY_AGE_BANDS = ["6-9", "10-12", "13-15"] as const;
export type SpeechBuddyAgeBand = (typeof SPEECH_BUDDY_AGE_BANDS)[number];

export interface SpeechBuddyFlags {
  /** Bands enabled for every tenant. Empty in production. */
  globalBands: ReadonlySet<SpeechBuddyAgeBand>;
  /** Per-tenant enabled bands. */
  perTenantBands: ReadonlyMap<string, ReadonlySet<SpeechBuddyAgeBand>>;
}

function parseBandList(raw: string | undefined): Set<SpeechBuddyAgeBand> {
  const out = new Set<SpeechBuddyAgeBand>();
  if (!raw) return out;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "" || trimmed === "off" || trimmed === "disabled") return out;
  if (trimmed === "all") {
    for (const b of SPEECH_BUDDY_AGE_BANDS) out.add(b);
    return out;
  }
  for (const part of trimmed.split(",")) {
    const v = part.trim();
    if ((SPEECH_BUDDY_AGE_BANDS as readonly string[]).includes(v)) {
      out.add(v as SpeechBuddyAgeBand);
    }
  }
  return out;
}

function parseTenantBands(raw: string | undefined): Map<string, Set<SpeechBuddyAgeBand>> {
  const out = new Map<string, Set<SpeechBuddyAgeBand>>();
  if (!raw) return out;
  for (const entry of raw.split(";")) {
    const e = entry.trim();
    if (!e) continue;
    const idx = e.indexOf(":");
    if (idx <= 0) continue;
    const tenantId = e.slice(0, idx).trim();
    const bands = parseBandList(e.slice(idx + 1));
    if (tenantId && bands.size > 0) out.set(tenantId, bands);
  }
  return out;
}

export function loadSpeechBuddyFlags(env: NodeJS.ProcessEnv = process.env): SpeechBuddyFlags {
  return {
    globalBands: parseBandList(env.SPEECH_BUDDY_ENABLED_GLOBAL),
    perTenantBands: parseTenantBands(env.SPEECH_BUDDY_ENABLED_TENANTS),
  };
}

export const SPEECH_BUDDY_FLAGS: SpeechBuddyFlags = loadSpeechBuddyFlags();

/**
 * Returns true iff Speech Buddy is enabled for this (tenant, ageBand).
 * Defaults to false for every unconfigured input.
 */
export function isSpeechBuddyEnabled(
  tenantId: string,
  ageBand: SpeechBuddyAgeBand,
  flags: SpeechBuddyFlags = SPEECH_BUDDY_FLAGS,
): boolean {
  if (!tenantId) return false;
  if (flags.globalBands.has(ageBand)) return true;
  const t = flags.perTenantBands.get(tenantId);
  return t ? t.has(ageBand) : false;
}

interface BootstrapLogger {
  info: {
    (message: string, data?: Record<string, unknown>): void;
    (data: Record<string, unknown>, message?: string): void;
  };
}

/**
 * Emit a single structured log line summarizing the resolved flag values.
 * Call once during service bootstrap.
 */
export function logAdminEnterpriseFlags(
  logger: BootstrapLogger,
  flags: AdminEnterpriseFlags = ADMIN_ENTERPRISE,
): void {
  logger.info("admin enterprise feature flags", { adminEnterpriseFlags: flags });
}
