/**
 * Notification contract — ADR 0020 Phase 3, slice 3.3.
 *
 * Notifications are produced by many services (assignment-svc,
 * billing-svc, safety-svc, …) and consumed by two shells (web SW
 * push + in-app inbox; mobile Expo notifications + in-app inbox).
 * Before Phase 3 the payload only carried the recipient `userId`
 * and an `href`; the consuming shell had to guess which role the
 * notification was meant for and routed off the user's current
 * `activeRole`. That broke for multi-role users — a parent who is
 * also a teacher would tap a "consent needed" notification while
 * acting as a teacher and land on a forbidden page.
 *
 * The Phase 3 contract adds `targetRole` (required) and
 * `targetLearnerId` (optional). The fan-out service stamps
 * `targetRole` based on which role the recipient must be in to act
 * on the notification (e.g. consent → parent, assignment → teacher,
 * IEP review → therapist). Both shells pass the URL through
 * `resolveDeepLink` and, when `targetRole !== activeRole`, route to
 * `/role-switch?to=<role>&next=<url>&reason=notification` before
 * navigating — auto-switching the user's role (with step-up if
 * required) so the slice they land on is the one that matches the
 * notification.
 */
import type { Role } from "./roles.js";

/**
 * The portable, role-aware notification payload every shell + every
 * fan-out service agrees on. Service-specific fields (assignment id,
 * invoice id, etc.) ride on `data` rather than growing this contract.
 */
export interface RoleAwareNotificationPayload {
  /** Stable notification id (matches the backing DB row). */
  id: string;
  /** Recipient user id; the server has already filtered fan-out. */
  userId: string;
  /** Tenant the notification was emitted in. */
  tenantId: string;
  /** Short title shown in the notification chrome. */
  title: string;
  /** Plain-text body shown in the notification chrome. */
  body: string;
  /** Where the user should land when they tap / click. Must be a
   *  path or universal link that {@link resolveDeepLink} can parse. */
  href: string;
  /**
   * The role the recipient must be in to act on this notification.
   * Set by the producer based on who the notification was *for*
   * (e.g. `parent` for a consent request, `teacher` for an assignment
   * reminder, `therapist` for an IEP review). Always present on
   * notifications produced after Phase 3.
   */
  targetRole: Role;
  /**
   * Optional learner the notification refers to. Carried separately
   * from `href` so an inbox can render the learner chip without
   * re-parsing the URL.
   */
  targetLearnerId?: string;
  /** Notification type name from the service that produced it. */
  type: string;
  /** ISO 8601 emit time. */
  createdAt: string;
  /** ISO 8601 read time, or null when unread. */
  readAt: string | null;
  /** Free-form per-service metadata. Keep it small — it ships on
   *  every push. */
  data?: Record<string, unknown>;
}

/**
 * Lightweight runtime validation for an incoming push payload. The
 * SW / Expo handler calls this before routing so a malformed
 * payload from a misconfigured producer can't crash the navigation
 * pipeline.
 */
export function isRoleAwareNotificationPayload(
  value: unknown,
): value is RoleAwareNotificationPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id) return false;
  if (typeof v.userId !== "string" || !v.userId) return false;
  if (typeof v.tenantId !== "string" || !v.tenantId) return false;
  if (typeof v.title !== "string") return false;
  if (typeof v.body !== "string") return false;
  if (typeof v.href !== "string" || !v.href) return false;
  if (typeof v.targetRole !== "string") return false;
  if (typeof v.type !== "string") return false;
  if (typeof v.createdAt !== "string") return false;
  if (v.readAt !== null && typeof v.readAt !== "string") return false;
  if (v.targetLearnerId !== undefined && typeof v.targetLearnerId !== "string") return false;
  if (v.data !== undefined && (typeof v.data !== "object" || v.data === null)) return false;
  return true;
}

/**
 * Producer-side helper: stamp a `targetRole` (and optional
 * `targetLearnerId`) onto a legacy notification payload. Pure
 * function — services use this in their fan-out path so the
 * stamping logic is consistent.
 */
export function withTargetRole<T extends { href: string }>(
  base: T,
  targetRole: Role,
  targetLearnerId?: string,
): T & { targetRole: Role; targetLearnerId?: string } {
  return targetLearnerId ? { ...base, targetRole, targetLearnerId } : { ...base, targetRole };
}
