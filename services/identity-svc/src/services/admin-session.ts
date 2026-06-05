/**
 * Sprint 5 — admin session hygiene helpers.
 *
 * Internal-role sessions get a much shorter refresh-token TTL (12h vs 30d),
 * an idle timeout (`ADMIN_SESSION_IDLE` minutes, default 240), a 12h
 * MFA freshness window, and device-fingerprint binding. The
 * `adminSessions` table tracks the per-session activity the refresh
 * handler needs to enforce all four.
 */
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { adminSessions } from "@aivo/db";
import { ADMIN_ENTERPRISE } from "@aivo/security";

export const INTERNAL_ROLES = new Set([
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
  "ENGINEERING",
]);

export const INTERNAL_REFRESH_TTL_MS = 12 * 60 * 60 * 1000;
export const MFA_FRESHNESS_MS = 12 * 60 * 60 * 1000;

export function isInternalRole(role: string): boolean {
  return INTERNAL_ROLES.has(role);
}

export function refreshTtlMs(role: string): number {
  return isInternalRole(role) ? INTERNAL_REFRESH_TTL_MS : 30 * 24 * 60 * 60 * 1000;
}

export function deviceFingerprint(headers: Record<string, string | string[] | undefined>): string {
  const ua = String(headers["user-agent"] || "");
  const lang = String(headers["accept-language"] || "");
  const ch = String(headers["sec-ch-ua"] || "");
  return crypto.createHash("sha256").update(`${ua}|${lang}|${ch}`).digest("hex");
}

function idleTimeoutMs(): number {
  const minutes =
    ADMIN_ENTERPRISE.ADMIN_SESSION_IDLE > 0 ? ADMIN_ENTERPRISE.ADMIN_SESSION_IDLE : 240;
  return minutes * 60_000;
}

export async function recordAdminLogin(
  db: any,
  userId: string,
  sessionId: string,
  headers: Record<string, string | string[] | undefined>,
  ipAddress: string | null,
): Promise<void> {
  const now = new Date();
  await db.insert(adminSessions).values({
    userId,
    sessionId,
    lastActivityAt: now,
    mfaVerifiedAt: now,
    deviceFingerprint: deviceFingerprint(headers),
    ipAddress,
  });
}

export type RefreshGate = { ok: true; session: any } | { ok: false; status: number; body: any };

/**
 * Idle, MFA-freshness, and fingerprint checks against `adminSessions`.
 * Returns ok:false with a 401 body the route can return verbatim when
 * the session must be re-authenticated.
 */
export async function gateAdminRefresh(
  db: any,
  sessionId: string,
  userId: string,
  headers: Record<string, string | string[] | undefined>,
  ipAddress: string | null,
): Promise<RefreshGate> {
  let [row] = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.sessionId, sessionId))
    .limit(1);
  if (!row) {
    // Lenient backfill: a session that pre-dates Sprint 5 (or was minted by
    // a code path that hasn't been hardened yet) is bootstrapped on first
    // refresh. This ensures every subsequent refresh is gated.
    await recordAdminLogin(db, userId, sessionId, headers, ipAddress);
    [row] = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.sessionId, sessionId))
      .limit(1);
    return { ok: true, session: row };
  }
  const now = Date.now();
  if (now - new Date(row.lastActivityAt).getTime() > idleTimeoutMs()) {
    await db.delete(adminSessions).where(eq(adminSessions.sessionId, sessionId));
    return { ok: false, status: 401, body: { error: "Session idle timeout", reason: "idle" } };
  }
  if (now - new Date(row.mfaVerifiedAt).getTime() > MFA_FRESHNESS_MS) {
    return {
      ok: false,
      status: 401,
      body: { error: "MFA verification required", mfaPending: true, reason: "mfa_freshness" },
    };
  }
  const fp = deviceFingerprint(headers);
  if (fp !== row.deviceFingerprint) {
    return {
      ok: false,
      status: 401,
      body: { error: "Device changed", mfaPending: true, reason: "device" },
    };
  }
  return { ok: true, session: row };
}

export async function bumpAdminActivity(db: any, sessionId: string): Promise<Date> {
  const now = new Date();
  await db
    .update(adminSessions)
    .set({ lastActivityAt: now })
    .where(eq(adminSessions.sessionId, sessionId));
  return now;
}

export function idleDeadline(lastActivityAt: Date): number {
  return new Date(lastActivityAt).getTime() + idleTimeoutMs();
}

export function mfaDeadline(mfaVerifiedAt: Date): number {
  return new Date(mfaVerifiedAt).getTime() + MFA_FRESHNESS_MS;
}
