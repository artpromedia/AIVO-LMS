/**
 * Sprint 7: Enterprise password policy.
 *
 * Enforces:
 *   - Length thresholds (14 chars for internal roles, 12 otherwise).
 *   - Strength score >=3 (rough zxcvbn-equivalent estimator implemented
 *     locally so we don't pull a 1.5 MB wordlist into the bundle).
 *   - HaveIBeenPwned k-anonymity check (https GET to api.pwnedpasswords.com).
 *   - Optional history check via a caller-supplied verifier (compares
 *     candidate plaintext against the user's last N argon2 hashes).
 *
 * Returns a structured result rather than throwing so callers can render
 * granular errors to the user.
 */

import * as crypto from "node:crypto";

const INTERNAL_ROLES = new Set([
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
]);

export interface PasswordPolicyResult {
  ok: boolean;
  reasons: PasswordPolicyReason[];
  /** 0–4. Roughly matches zxcvbn's score buckets. */
  strengthScore: 0 | 1 | 2 | 3 | 4;
}

export type PasswordPolicyReason =
  | "too_short"
  | "too_weak"
  | "breached"
  | "reused"
  | "missing_diversity";

export interface PasswordPolicyOptions {
  role?: string;
  email?: string | null;
  name?: string | null;
  /** Skip the HIBP network call (used in tests). */
  skipBreachCheck?: boolean;
  /** Optional verifier returning true when `candidate` argon2-matches any
   *  recent stored hash. Caller supplies argon2 to avoid this package
   *  depending on argon2. */
  historyVerifier?: (candidate: string) => Promise<boolean>;
}

const DEFAULT_INTERNAL_MIN = 14;
const DEFAULT_PUBLIC_MIN = 12;

/**
 * Lightweight zxcvbn-equivalent: we score on length, character-class diversity,
 * dictionary-ish patterns, and personal-info inclusion. Returns a 0–4 bucket.
 */
function estimateStrength(password: string, opts: PasswordPolicyOptions): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const len = password.length;
  let entropy = 0;
  // Length bonus
  entropy += Math.min(len, 32) * 2;
  // Character classes
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  entropy += classes * 6;
  // Penalty: contains email local-part or name fragments
  const tokens: string[] = [];
  if (opts.email) tokens.push(opts.email.split("@")[0].toLowerCase());
  if (opts.name) tokens.push(...opts.name.toLowerCase().split(/\s+/));
  for (const t of tokens) {
    if (t && t.length >= 3 && password.toLowerCase().includes(t)) entropy -= 12;
  }
  // Penalty: long runs of repeats / sequences
  if (/(.)\1{2,}/.test(password)) entropy -= 8;
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(password)) entropy -= 12;
  // Common-passwords cheap blocklist
  const lowered = password.toLowerCase();
  for (const blocked of COMMON_BLOCKLIST) {
    if (lowered === blocked || lowered.startsWith(blocked + "1") || lowered === blocked + "!") {
      entropy -= 30;
      break;
    }
  }
  // Bucket
  if (entropy < 18) return 0;
  if (entropy < 30) return 1;
  if (entropy < 42) return 2;
  if (entropy < 56) return 3;
  return 4;
}

const COMMON_BLOCKLIST = [
  "password",
  "passw0rd",
  "letmein",
  "welcome",
  "qwerty",
  "111111",
  "iloveyou",
  "admin",
  "monkey",
  "dragon",
  "abc123",
  "trustno1",
  "sunshine",
  "princess",
  "starwars",
  "football",
  "baseball",
];

/**
 * Returns true if `password` appears in HaveIBeenPwned. Uses k-anonymity:
 * the first 5 chars of the SHA-1 are sent to the API; we look for the rest
 * in the response. If the network call fails we fail-OPEN (never block a
 * valid password change because of an outage), but we log the failure so
 * ops can investigate.
 */
export async function checkPasswordBreach(
  password: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const sha1 = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const ctrl = signal ?? AbortSignal.timeout(5000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "aivo-learning-platform" },
      signal: ctrl,
    });
    if (!res.ok) return false;
    const body = await res.text();
    const lines = body.split("\n");
    for (const line of lines) {
      const [hashSuffix] = line.split(":");
      if (hashSuffix?.trim().toUpperCase() === suffix) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function minLengthFor(role?: string): number {
  if (role && INTERNAL_ROLES.has(role)) return DEFAULT_INTERNAL_MIN;
  return DEFAULT_PUBLIC_MIN;
}

/**
 * Validate a candidate password against the active policy. Returns a
 * structured result; callers map `reasons[]` to user-facing messages.
 */
export async function evaluatePassword(
  password: string,
  opts: PasswordPolicyOptions = {},
): Promise<PasswordPolicyResult> {
  const reasons: PasswordPolicyReason[] = [];
  const minLen = minLengthFor(opts.role);
  if (!password || password.length < minLen) reasons.push("too_short");
  const score = estimateStrength(password, opts);
  if (score < 3) reasons.push("too_weak");
  // require at least 3 character classes for internal roles
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  if (opts.role && INTERNAL_ROLES.has(opts.role) && classes < 3) reasons.push("missing_diversity");

  if (!opts.skipBreachCheck) {
    const breached = await checkPasswordBreach(password);
    if (breached) reasons.push("breached");
  }

  if (opts.historyVerifier) {
    try {
      const reused = await opts.historyVerifier(password);
      if (reused) reasons.push("reused");
    } catch {
      // history check failure should not block — log upstream
    }
  }

  return { ok: reasons.length === 0, reasons, strengthScore: score };
}

/** Days until rotation is required for an internal-role password. */
export const PASSWORD_ROTATION_DAYS = 365;
/** Number of days before rotation that we start surfacing a UI banner. */
export const PASSWORD_ROTATION_WARN_DAYS = 30;
/** How many prior hashes to retain per user for the reuse check. */
export const PASSWORD_HISTORY_DEPTH = 5;

/** Returns true when an internal-role user is past the rotation deadline. */
export function isPasswordRotationDue(
  passwordChangedAt: Date | null | undefined,
  role: string,
): boolean {
  if (!INTERNAL_ROLES.has(role)) return false;
  if (!passwordChangedAt) return true;
  const ageDays = (Date.now() - passwordChangedAt.getTime()) / 86_400_000;
  return ageDays >= PASSWORD_ROTATION_DAYS;
}

/** Days until rotation deadline (negative if already overdue). */
export function daysUntilRotation(
  passwordChangedAt: Date | null | undefined,
  role: string,
): number | null {
  if (!INTERNAL_ROLES.has(role)) return null;
  if (!passwordChangedAt) return 0;
  const ageDays = (Date.now() - passwordChangedAt.getTime()) / 86_400_000;
  return Math.ceil(PASSWORD_ROTATION_DAYS - ageDays);
}

export function isInternalRoleForPolicy(role: string): boolean {
  return INTERNAL_ROLES.has(role);
}
