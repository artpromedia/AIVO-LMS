import type { ReactNode } from "react";

export type StatusTone = "positive" | "warning" | "danger" | "neutral" | "info";

/**
 * Maps an arbitrary backend status string to a pill tone. Falls back to
 * "neutral" so an unknown status still renders a legible (non-broken) pill.
 * Status pills carry a text label + a leading dot (see `.admin-status` in
 * globals.css), so they never rely on colour alone (WCAG 1.4.1).
 */
const TONE_BY_STATUS: Record<string, StatusTone> = {
  // positive
  active: "positive",
  enabled: "positive",
  healthy: "positive",
  passed: "positive",
  pass: "positive",
  granted: "positive",
  approved: "positive",
  paid: "positive",
  resolved: "positive",
  closed: "positive",
  completed: "positive",
  complete: "positive",
  succeeded: "positive",
  success: "positive",
  live: "positive",
  verified: "positive",
  accepted: "positive",
  ok: "positive",
  up: "positive",
  // warning
  pending: "warning",
  draft: "warning",
  trial: "warning",
  trialing: "warning",
  due: "warning",
  review: "warning",
  in_review: "warning",
  "in-review": "warning",
  open: "warning",
  running: "warning",
  in_progress: "warning",
  "in-progress": "warning",
  queued: "warning",
  processing: "warning",
  warning: "warning",
  warn: "warning",
  degraded: "warning",
  scheduled: "warning",
  paused: "warning",
  // danger
  failed: "danger",
  fail: "danger",
  error: "danger",
  expired: "danger",
  revoked: "danger",
  blocked: "danger",
  rejected: "danger",
  overdue: "danger",
  retired: "danger",
  cancelled: "danger",
  canceled: "danger",
  critical: "danger",
  down: "danger",
  flagged: "danger",
  // neutral
  inactive: "neutral",
  disabled: "neutral",
  deprecated: "neutral",
  archived: "neutral",
  unknown: "neutral",
  none: "neutral",
  // info
  new: "info",
  info: "info",
  submitted: "info",
};

export function statusTone(status: string): StatusTone {
  return TONE_BY_STATUS[status.trim().toLowerCase()] ?? "neutral";
}

/** Title-cases a raw status token ("in_progress" → "In progress"). */
function humanize(status: string): string {
  const cleaned = status.replace(/[_-]+/g, " ").trim();
  if (!cleaned) return status;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function StatusPill({
  status,
  tone,
  label,
  testId,
}: {
  status: string;
  /** Override the auto-detected tone when the status string is ambiguous. */
  tone?: StatusTone;
  /** Override the displayed label; defaults to a humanized status. */
  label?: ReactNode;
  testId?: string;
}) {
  const resolved = tone ?? statusTone(status);
  return (
    <span
      className={`admin-status admin-status-${resolved}`}
      data-testid={testId}
      data-status={status}
    >
      {label ?? humanize(status)}
    </span>
  );
}
